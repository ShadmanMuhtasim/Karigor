using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Karigor.Infrastructure.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SosAlertStatus
{
    Open,
    Contacted,
    Resolved,
    Escalated
}

public partial class SosAlert
{
    [Key]
    public int Id { get; set; }

    public int BookingId { get; set; }

    public int CustomerId { get; set; }

    public int WorkerId { get; set; }

    public DateTime TriggeredAt { get; set; } = DateTime.UtcNow;

    public SosAlertStatus Status { get; set; } = SosAlertStatus.Open;

    public string? AdminNotes { get; set; }

    public DateTime? ResolvedAt { get; set; }

    [StringLength(450)]
    public string? ResolvedByAdminId { get; set; }

    [ForeignKey("BookingId")]
    [InverseProperty("SosAlerts")]
    public virtual Booking Booking { get; set; } = null!;

    [ForeignKey("CustomerId")]
    public virtual CustomerProfile Customer { get; set; } = null!;

    [ForeignKey("WorkerId")]
    public virtual WorkerProfile Worker { get; set; } = null!;

    [ForeignKey("ResolvedByAdminId")]
    public virtual ApplicationUser? ResolvedByAdmin { get; set; }
}
