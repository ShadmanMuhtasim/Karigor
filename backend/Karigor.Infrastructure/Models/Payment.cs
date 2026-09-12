using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

[Table("Payments")]
[Index(nameof(BookingId), Name = "IX_Payments_BookingId")]
[Index(nameof(Status), Name = "IX_Payments_Status")]
[Index(nameof(TransactionId), Name = "UQ_Payments_TransactionId", IsUnique = true)]
public partial class Payment
{
    [Key]
    public int Id { get; set; }

    public int BookingId { get; set; }

    [StringLength(100)]
    public string TransactionId { get; set; } = null!;

    [StringLength(100)]
    public string? ValId { get; set; }

    [StringLength(100)]
    public string? BankTranId { get; set; }

    [StringLength(100)]
    public string? CardType { get; set; }

    [StringLength(10)]
    public string Currency { get; set; } = "BDT";

    [Column(TypeName = "decimal(18, 2)")]
    public decimal TotalAmount { get; set; }

    [Column(TypeName = "decimal(18, 2)")]
    public decimal PlatformFee { get; set; }

    [Column(TypeName = "decimal(18, 2)")]
    public decimal WorkerAmount { get; set; }

    [StringLength(50)]
    public string Status { get; set; } = "Initiated";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? PaidAt { get; set; }

    public string? GatewayResponse { get; set; }

    [ForeignKey("BookingId")]
    [InverseProperty("Payments")]
    public virtual Booking Booking { get; set; } = null!;
}
