using System.Net;
using System.Net.Mail;

namespace WUD2026.Auth;

public sealed class AccountEmailSender(IConfiguration configuration)
{
    public bool Available => !string.IsNullOrWhiteSpace(configuration["Email:Smtp:Host"]);

    public async Task SendAsync(string recipient, string subject, string text)
    {
        if (!Available) throw new InvalidOperationException("SMTP is not configured.");
        using var message = new MailMessage(configuration["Email:From"]!, recipient, subject, text);
        using var client = new SmtpClient(configuration["Email:Smtp:Host"], configuration.GetValue("Email:Smtp:Port", 587))
        {
            EnableSsl = configuration.GetValue("Email:Smtp:EnableSsl", true)
        };
        if (!string.IsNullOrWhiteSpace(configuration["Email:Smtp:Username"]))
            client.Credentials = new NetworkCredential(configuration["Email:Smtp:Username"], configuration["Email:Smtp:Password"]);
        await client.SendMailAsync(message);
    }
}
