using Npgsql;
namespace WUD2026.Data;

public static class DatabaseConnection
{
    public static string FromConfiguration(IConfiguration configuration)
    {
        // Optional compatibility with existing deployments; this value must also be supplied via env.
        var connection = configuration.GetConnectionString("ContentDatabase");
        if (!string.IsNullOrWhiteSpace(connection)) return connection;
        string Required(string name) => !string.IsNullOrWhiteSpace(configuration["Database:" + name])
            ? configuration["Database:" + name]! : throw new InvalidOperationException("Missing environment variable Database__" + name + ".");
        return new NpgsqlConnectionStringBuilder
        {
            Host = Required("Host"), Port = configuration.GetValue("Database:Port", 5432),
            Database = Required("Name"), Username = Required("Username"), Password = Required("Password"),
            SslMode = Enum.Parse<SslMode>(configuration["Database:SslMode"] ?? "Prefer", true),
            ["GSS Encryption Mode"] = configuration["Database:GssEncryptionMode"] ?? "Disable"
        }.ConnectionString;
    }
}
