using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

[Index("CategoryId", Name = "IX_ServiceRequests_CategoryId")]
[Index("Status", Name = "IX_ServiceRequests_Status")]
public partial class ServiceRequest
{
    [Key]
    public int Id { get; set; }

    public int CustomerId { get; set; }

    public int CategoryId { get; set; }

    public string Description { get; set; } = null!;

    [StringLength(200)]
    public string Address { get; set; } = null!;

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public DateTime PreferredDate { get; set; }

    [StringLength(50)]
    public string Status { get; set; } = null!;

    public string? PhotoUrls { get; set; }

    [InverseProperty("ServiceRequest")]
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    [ForeignKey("CategoryId")]
    [InverseProperty("ServiceRequests")]
    public virtual ServiceCategory Category { get; set; } = null!;

    [ForeignKey("CustomerId")]
    [InverseProperty("ServiceRequests")]
    public virtual CustomerProfile Customer { get; set; } = null!;

    [InverseProperty("ServiceRequest")]
    public virtual ICollection<Quotation> Quotations { get; set; } = new List<Quotation>();
}
