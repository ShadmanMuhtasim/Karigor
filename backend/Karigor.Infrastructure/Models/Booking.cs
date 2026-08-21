using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

public partial class Booking
{
    [Key]
    public int Id { get; set; }

    public int ServiceRequestId { get; set; }

    public int WorkerId { get; set; }

    public int CustomerId { get; set; }

    [Column(TypeName = "decimal(18, 2)")]
    public decimal AgreedPrice { get; set; }

    public DateTime ScheduledDate { get; set; }

    [StringLength(50)]
    public string Status { get; set; } = null!;

    [ForeignKey("CustomerId")]
    [InverseProperty("Bookings")]
    public virtual CustomerProfile Customer { get; set; } = null!;

    [InverseProperty("Booking")]
    public virtual ICollection<Message> Messages { get; set; } = new List<Message>();

    [InverseProperty("Booking")]
    public virtual Review? Review { get; set; }

    [ForeignKey("ServiceRequestId")]
    [InverseProperty("Bookings")]
    public virtual ServiceRequest ServiceRequest { get; set; } = null!;

    [ForeignKey("WorkerId")]
    [InverseProperty("Bookings")]
    public virtual WorkerProfile Worker { get; set; } = null!;
}
