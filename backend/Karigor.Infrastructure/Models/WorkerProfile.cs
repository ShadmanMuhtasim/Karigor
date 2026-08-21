using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

[Index("VerificationStatus", Name = "IX_WorkerProfiles_VerificationStatus")]
[Index("UserId", Name = "UQ_WorkerProfiles_UserId", IsUnique = true)]
public partial class WorkerProfile
{
    [Key]
    public int Id { get; set; }

    public string UserId { get; set; } = null!;

    public string? Bio { get; set; }

    [Column(TypeName = "decimal(18, 2)")]
    public decimal HourlyRate { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public double ServiceRadiusKm { get; set; }

    [StringLength(50)]
    public string VerificationStatus { get; set; } = null!;

    public double AverageRating { get; set; }

    [InverseProperty("Worker")]
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    [InverseProperty("Worker")]
    public virtual ICollection<Quotation> Quotations { get; set; } = new List<Quotation>();

    [ForeignKey("UserId")]
    [InverseProperty("WorkerProfile")]
    public virtual ApplicationUser User { get; set; } = null!;

    [InverseProperty("Worker")]
    public virtual ICollection<WorkerAvailability> WorkerAvailabilities { get; set; } = new List<WorkerAvailability>();

    [InverseProperty("Worker")]
    public virtual ICollection<WorkerDocument> WorkerDocuments { get; set; } = new List<WorkerDocument>();

    [ForeignKey("WorkerId")]
    [InverseProperty("Workers")]
    public virtual ICollection<ServiceCategory> Categories { get; set; } = new List<ServiceCategory>();
}
