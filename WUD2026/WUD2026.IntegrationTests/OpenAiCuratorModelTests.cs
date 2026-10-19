using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using WUD2026.Chat;
using WUD2026.Models;

namespace WUD2026.IntegrationTests;

public sealed class OpenAiCuratorModelTests
{
    [Fact]
    public async Task ResponsesRequestUsesStructuredSchemaManualContextAndNoProviderStorage()
    {
        var answer = new { reply = "Poznajmy muzykę.", recommendations = new[] { new { eventId = "real-event", reason = "Jazz", insight = "Improwizacja" } }, memory = "Lubi jazz", followUps = new[] { "Program?" } };
        string? payload = null;
        var handler = new StubHandler(async request =>
        {
            Assert.Equal("https://api.openai.com/v1/responses", request.RequestUri!.ToString());
            Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
            Assert.Equal("test-only-key", request.Headers.Authorization.Parameter);
            payload = await request.Content!.ReadAsStringAsync();
            return Response("completed", "output_text", JsonSerializer.Serialize(answer));
        });
        using var client = new HttpClient(handler);
        var model = new OpenAiCuratorModel(client, Settings("test-only-key"), NullLogger<OpenAiCuratorModel>.Instance);
        var context = new CuratorContext("Budżet 80 zł", [], [new EventContent { Id = "real-event", Title = "Jazz" }], 1, DateTimeOffset.UtcNow, "Lubię jazz");
        var result = await model.AnswerAsync(context, default);
        Assert.Equal("Lubi jazz", result.Memory);
        using var json = JsonDocument.Parse(payload!);
        Assert.False(json.RootElement.GetProperty("store").GetBoolean());
        Assert.Equal("json_schema", json.RootElement.GetProperty("text").GetProperty("format").GetProperty("type").GetString());
        Assert.True(json.RootElement.GetProperty("text").GetProperty("format").GetProperty("strict").GetBoolean());
        var properties = json.RootElement.GetProperty("text").GetProperty("format").GetProperty("schema").GetProperty("properties");
        Assert.Equal(0, properties.GetProperty("recommendations").GetProperty("maxItems").GetInt32());
        Assert.Equal(3, properties.GetProperty("followUps").GetProperty("maxItems").GetInt32());
        Assert.Contains("kustoszem", json.RootElement.GetProperty("instructions").GetString());
        var developerContent = json.RootElement.GetProperty("input")[0].GetProperty("content").GetString()!;
        using var suppliedContext = JsonDocument.Parse(developerContent[(developerContent.IndexOf('\n') + 1)..]);
        Assert.Equal("Budżet 80 zł", suppliedContext.RootElement.GetProperty("memory").GetString());
        Assert.Equal("Lubię jazz", json.RootElement.GetProperty("input")[1].GetProperty("content").GetString());
        Assert.Contains("real-event", payload);
    }

    [Fact]
    public async Task FollowUpSchemaAllowsOnlyOneRecommendation()
    {
        using var client = new HttpClient(new StubHandler(async request =>
        {
            using var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync());
            var properties = payload.RootElement.GetProperty("text").GetProperty("format").GetProperty("schema").GetProperty("properties");
            Assert.Equal(1, properties.GetProperty("recommendations").GetProperty("maxItems").GetInt32());
            return Response("completed", "output_text", JsonSerializer.Serialize(new CuratorAnswer("Dziękuję.", [], "", ["Przyjdę samodzielnie"])));
        }));
        var model = new OpenAiCuratorModel(client, Settings("test-only-key"), NullLogger<OpenAiCuratorModel>.Instance);
        await model.AnswerAsync(new("Lubi jazz", [new ChatTurn { Question = "Jazz", Reply = "Z kim przyjdziesz?" }],
            [new EventContent { Id = "real-event" }], 1, DateTimeOffset.UtcNow, "Sam"), default);
    }

    [Theory]
    [InlineData("incomplete", "output_text", "{}", 503)]
    [InlineData("completed", "refusal", "", 422)]
    [InlineData("completed", "output_text", "not json", 502)]
    public async Task IncompleteRefusedAndInvalidRepliesAreNotShownAsSuccessfulAi(string status, string type, string text, int expected)
    {
        using var client = new HttpClient(new StubHandler(_ => Task.FromResult(Response(status, type, text))));
        var model = new OpenAiCuratorModel(client, Settings("test-only-key"), NullLogger<OpenAiCuratorModel>.Instance);
        var error = await Assert.ThrowsAsync<ChatException>(() => model.AnswerAsync(new("", [], [], 0, DateTimeOffset.UtcNow, "Pytanie"), default));
        Assert.Equal(expected, error.Status);
    }

    [Fact]
    public void EmptyLocalKeyAllowsExplicitOpenAiEnvironmentConfiguration()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Ai:ApiKey"] = "", ["OPENAI_API_KEY"] = "test-only-environment-key" }).Build();
        using var client = new HttpClient();
        Assert.True(new OpenAiCuratorModel(client, config, NullLogger<OpenAiCuratorModel>.Instance).IsConfigured);
    }

    private static IConfiguration Settings(string key) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Ai:ApiKey"] = key }).Build();
    private static HttpResponseMessage Response(string status, string type, string text) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(JsonSerializer.Serialize(new { status, output = new[] { new { type = "message", content = new[] { new { type, text } } } } }), Encoding.UTF8, "application/json")
    };
    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => send(request);
    }
}
