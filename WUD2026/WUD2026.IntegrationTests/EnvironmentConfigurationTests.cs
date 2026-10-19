using Microsoft.Extensions.Configuration;
using Npgsql;
using WUD2026.Data;

namespace WUD2026.IntegrationTests;

public sealed class EnvironmentConfigurationTests
{
    [Fact]
    public void MissingDatabaseCredentialsFailWithoutDisclosingValues()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>
        {
            ["Database:Host"]="db", ["Database:Name"]="tests", ["Database:Username"]="listener"
        }).Build();
        var error = Assert.Throws<InvalidOperationException>(() => DatabaseConnection.FromConfiguration(config));
        Assert.Equal("Missing environment variable Database__Password.",error.Message);
    }

    [Fact]
    public void SeparateEnvironmentFieldsPreserveSpecialCharactersInPassword()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>
        {
            ["Database:Host"]="db", ["Database:Port"]="5544", ["Database:Name"]="tests", ["Database:Username"]="listener",
            ["Database:Password"]="test-only;quotes=\"value\"", ["Database:SslMode"]="Require"
        }).Build();
        var parsed = new NpgsqlConnectionStringBuilder(DatabaseConnection.FromConfiguration(config));
        Assert.Equal("test-only;quotes=\"value\"",parsed.Password);
        Assert.Equal(5544,parsed.Port);
        Assert.Equal(SslMode.Require,parsed.SslMode);
    }
}
