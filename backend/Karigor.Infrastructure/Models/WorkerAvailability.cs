using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

[Table("WorkerAvailability")]
public partial class WorkerAvailability
{
    [Key]
    public int Id { get; set; }

    public int WorkerId { get; set; }

    public int DayOfWeek { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }

    [ForeignKey("WorkerId")]
    [InverseProperty("WorkerAvailabilities")]
    public virtual WorkerProfile Worker { get; set; } = null!;
}
