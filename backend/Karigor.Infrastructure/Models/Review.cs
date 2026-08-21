using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

[Index("BookingId", Name = "UQ_Reviews_BookingId", IsUnique = true)]
public partial class Review
{
    [Key]
    public int Id { get; set; }

    public int BookingId { get; set; }

    public int Rating { get; set; }

    public string? Comment { get; set; }

    public string? WorkerResponse { get; set; }

    [ForeignKey("BookingId")]
    [InverseProperty("Review")]
    public virtual Booking Booking { get; set; } = null!;
}
