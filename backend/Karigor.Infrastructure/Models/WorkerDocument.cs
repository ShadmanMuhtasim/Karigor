using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

public partial class WorkerDocument
{
    [Key]
    public int Id { get; set; }

    public int WorkerId { get; set; }

    [StringLength(50)]
    public string DocumentType { get; set; } = null!;

    public string FileUrl { get; set; } = null!;

    [StringLength(50)]
    public string Status { get; set; } = null!;

    [ForeignKey("WorkerId")]
    [InverseProperty("WorkerDocuments")]
    public virtual WorkerProfile Worker { get; set; } = null!;
}
