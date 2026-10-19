using System.Net;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;

namespace WUD2026.Services;

public static class ProductionHosting
{
    public static void AddProductionHosting(this WebApplicationBuilder builder)
    {
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            foreach (var address in builder.Configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [])
                options.KnownProxies.Add(IPAddress.Parse(address));
        });
        var protection = builder.Services.AddDataProtection().SetApplicationName("Filharmonia.Identity");
        if (builder.Configuration["DataProtection:KeysPath"] is { Length: > 0 } path)
            protection.PersistKeysToFileSystem(new DirectoryInfo(path));
        builder.Services.AddHsts(options => { options.MaxAge = TimeSpan.FromDays(180); });
    }
}
