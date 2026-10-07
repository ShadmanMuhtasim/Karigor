using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

[Index("UserId", Name = "IX_RefreshTokens_UserId")]
public partial class RefreshToken
{
    [Key]
    public int Id { get; set; }

    [MaxLength(64)]
    public string TokenHash { get; set; } = null!;

    // Null only for explicitly revoked pre-F6 history. Never authenticated.
    public Guid? SessionId { get; set; }
    public int? ParentTokenId { get; set; }
    [Timestamp] public byte[] RowVersion { get; set; } = null!;

    public string UserId { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    [MaxLength(64)] public string? ReplacedByToken { get; set; }

    public DateTime CreatedAt { get; set; }

    [ForeignKey("UserId")]
    [InverseProperty("RefreshTokens")]
    public virtual ApplicationUser User { get; set; } = null!;
}
