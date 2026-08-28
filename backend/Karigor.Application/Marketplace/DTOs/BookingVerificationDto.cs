namespace Karigor.Application.Marketplace.DTOs;

public class GenerateVerificationCodeResponseDto
{
    public string VerificationCode { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class WorkerCheckInDto
{
    public string VerificationCode { get; set; } = string.Empty;
}
