using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

public partial class Message
{
    [Key]
    public int Id { get; set; }

    [StringLength(450)]
    public string SenderId { get; set; } = null!;

    [StringLength(450)]
    public string ReceiverId { get; set; } = null!;

    public int? BookingId { get; set; }

    public string Content { get; set; } = null!;

    public DateTime SentAt { get; set; }

    public bool IsRead { get; set; }

    [ForeignKey("BookingId")]
    [InverseProperty("Messages")]
    public virtual Booking? Booking { get; set; }

    [ForeignKey("ReceiverId")]
    [InverseProperty("MessageReceivers")]
    public virtual ApplicationUser Receiver { get; set; } = null!;

    [ForeignKey("SenderId")]
    [InverseProperty("MessageSenders")]
    public virtual ApplicationUser Sender { get; set; } = null!;
}
