using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

[Index(nameof(UserId))]
public sealed class RefreshSession
{
    public Guid Id { get; set; }
    [MaxLength(450)] public string UserId { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    [MaxLength(32)] public string? RevocationReason { get; set; }
    [Timestamp] public byte[] RowVersion { get; set; } = null!;
    public ApplicationUser User { get; set; } = null!;
}
