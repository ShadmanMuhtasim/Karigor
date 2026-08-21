using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

public partial class Quotation
{
    [Key]
    public int Id { get; set; }

    public int ServiceRequestId { get; set; }

    public int WorkerId { get; set; }

    [Column(TypeName = "decimal(18, 2)")]
    public decimal ProposedPrice { get; set; }

    public string? Message { get; set; }

    [StringLength(50)]
    public string Status { get; set; } = null!;

    public int? ParentQuotationId { get; set; }

    [InverseProperty("ParentQuotation")]
    public virtual ICollection<Quotation> InverseParentQuotation { get; set; } = new List<Quotation>();

    [ForeignKey("ParentQuotationId")]
    [InverseProperty("InverseParentQuotation")]
    public virtual Quotation? ParentQuotation { get; set; }

    [ForeignKey("ServiceRequestId")]
    [InverseProperty("Quotations")]
    public virtual ServiceRequest ServiceRequest { get; set; } = null!;

    [ForeignKey("WorkerId")]
    [InverseProperty("Quotations")]
    public virtual WorkerProfile Worker { get; set; } = null!;
}
