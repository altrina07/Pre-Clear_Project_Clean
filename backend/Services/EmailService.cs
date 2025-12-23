using PreClear.Api.Interfaces;

namespace PreClear.Api.Services
{
    public class EmailService : IEmailService
    {
        private readonly ILogger<EmailService> _logger;

        public EmailService(ILogger<EmailService> logger)
        {
            _logger = logger;
        }

        public Task SendEmailAsync(string toEmail, string subject, string body)
        {
            // TODO: Implement actual email sending (SMTP, SendGrid, AWS SES, etc.)
            _logger.LogInformation("Email would be sent to {Email} with subject: {Subject}", toEmail, subject);
            return Task.CompletedTask;
        }
    }
}
