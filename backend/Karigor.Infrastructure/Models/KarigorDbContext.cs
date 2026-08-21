using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace Karigor.Infrastructure.Models;

public partial class KarigorDbContext : IdentityDbContext<ApplicationUser>
{
    public KarigorDbContext()
    {
    }

    public KarigorDbContext(DbContextOptions<KarigorDbContext> options)
        : base(options)
    {
    }



    public virtual DbSet<Booking> Bookings { get; set; }

    public virtual DbSet<CustomerProfile> CustomerProfiles { get; set; }

    public virtual DbSet<Message> Messages { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<Quotation> Quotations { get; set; }

    public virtual DbSet<RefreshToken> RefreshTokens { get; set; }

    public virtual DbSet<Review> Reviews { get; set; }

    public virtual DbSet<ServiceCategory> ServiceCategories { get; set; }

    public virtual DbSet<ServiceRequest> ServiceRequests { get; set; }

    public virtual DbSet<WorkerAvailability> WorkerAvailabilities { get; set; }

    public virtual DbSet<WorkerDocument> WorkerDocuments { get; set; }

    public virtual DbSet<WorkerProfile> WorkerProfiles { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
        => optionsBuilder.UseSqlServer("Server=.\\SQLEXPRESS;Database=KarigorDev;Trusted_Connection=True;TrustServerCertificate=True;");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.Property(e => e.Status).HasDefaultValue("Scheduled");

            entity.HasOne(d => d.Customer).WithMany(p => p.Bookings).OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.Worker).WithMany(p => p.Bookings).OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.Property(e => e.SentAt).HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Receiver).WithMany(p => p.MessageReceivers).OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.Sender).WithMany(p => p.MessageSenders).OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
        });

        modelBuilder.Entity<Quotation>(entity =>
        {
            entity.Property(e => e.Status).HasDefaultValue("Pending");

            entity.HasOne(d => d.Worker).WithMany(p => p.Quotations).OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(sysutcdatetime())");
        });

        modelBuilder.Entity<ServiceRequest>(entity =>
        {
            entity.Property(e => e.Status).HasDefaultValue("Open");

            entity.HasOne(d => d.Category).WithMany(p => p.ServiceRequests).OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<WorkerDocument>(entity =>
        {
            entity.Property(e => e.Status).HasDefaultValue("Pending");
        });

        modelBuilder.Entity<WorkerProfile>(entity =>
        {
            entity.Property(e => e.ServiceRadiusKm).HasDefaultValue(10.0);
            entity.Property(e => e.VerificationStatus).HasDefaultValue("Pending");

            entity.HasMany(d => d.Categories).WithMany(p => p.Workers)
                .UsingEntity<Dictionary<string, object>>(
                    "WorkerSkill",
                    r => r.HasOne<ServiceCategory>().WithMany().HasForeignKey("CategoryId"),
                    l => l.HasOne<WorkerProfile>().WithMany().HasForeignKey("WorkerId"),
                    j =>
                    {
                        j.HasKey("WorkerId", "CategoryId");
                        j.ToTable("WorkerSkills");
                    });
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
