using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

[Index("UserId", Name = "UQ_CustomerProfiles_UserId", IsUnique = true)]
public partial class CustomerProfile
{
    [Key]
    public int Id { get; set; }

    public string UserId { get; set; } = null!;

    [StringLength(100)]
    public string FullName { get; set; } = null!;

    [StringLength(200)]
    public string? Address { get; set; }

    public string? ProfileImageUrl { get; set; }

    [InverseProperty("Customer")]
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    [InverseProperty("Customer")]
    public virtual ICollection<ServiceRequest> ServiceRequests { get; set; } = new List<ServiceRequest>();

    [ForeignKey("UserId")]
    [InverseProperty("CustomerProfile")]
    public virtual ApplicationUser User { get; set; } = null!;
}
