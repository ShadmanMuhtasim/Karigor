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

    public virtual DbSet<SosAlert> SosAlerts { get; set; }

    public virtual DbSet<Payment> Payments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.Property(e => e.Id).UseIdentityColumn();
            entity.ToTable(t => t.UseSqlOutputClause(false));
            entity.HasOne(e => e.SelectedPayment).WithMany().HasForeignKey(e => new { e.SelectedPaymentId, e.Id })
                .HasPrincipalKey(e => new { e.Id, e.BookingId }).OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_PaymentAllocation_Booking");
            entity.Property(e => e.PaymentStatus).HasDefaultValue("Unpaid");
            entity.HasIndex(e => e.ServiceRequestId).IsUnique().HasDatabaseName("UX_F5_Bookings_Request");
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

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.Property(e => e.Id).UseIdentityColumn();
            entity.ToTable(t => t.UseSqlOutputClause(false));
            entity.HasAlternateKey(e => new { e.Id, e.BookingId }).HasName("UQ_Payments_Id_BookingId");
            entity.Property(e => e.RequiresReview).HasDefaultValue(false);
            entity.HasIndex(e => e.BookingId, "UX_Payment_InitiationIntent").IsUnique().HasFilter("[InitiationFingerprint] IS NOT NULL")
                .HasDatabaseName("UX_Payment_InitiationIntent");
            entity.HasIndex(e => new { e.VerifiedMerchantId, e.VerifiedEnvironment, e.VerifiedTransactionId })
                .IsUnique().HasFilter("[VerifiedTransactionId] IS NOT NULL").HasDatabaseName("UX_Payment_VerifiedIdentity");
            entity.HasKey(e => e.Id).HasName("PK_Payments");
            entity.HasAlternateKey(e => e.TransactionId).HasName("UQ_Payments_TransactionId");
            entity.Property(e => e.Currency).HasDefaultValue("BDT");
            entity.Property(e => e.Status).HasDefaultValue("Initiated");
            entity.Property(e => e.ServiceCharge).HasDefaultValue(0m);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(e => e.TotalAmount).HasPrecision(18, 2);
            entity.Property(e => e.PlatformFee).HasPrecision(18, 2);
            entity.Property(e => e.ServiceCharge).HasPrecision(18, 2);
            entity.Property(e => e.WorkerAmount).HasPrecision(18, 2);
            entity.HasOne(e => e.Booking).WithMany(b => b.Payments).HasForeignKey(e => e.BookingId)
                .OnDelete(DeleteBehavior.Cascade).HasConstraintName("FK_Payments_Bookings_BookingId");
        });

        modelBuilder.Entity<Quotation>(entity =>
        {
            entity.ToTable(t =>
            {
                t.UseSqlOutputClause(false);
                t.HasTrigger("TR_F5_Quotation_Immutable");
                t.HasCheckConstraint("CK_F5_Quotation_Status", "[Status] IN (N'Pending',N'Countered',N'Accepted',N'Rejected')");
            });
            entity.HasOne<ApplicationUser>().WithMany().HasForeignKey(e => e.ProposedByUserId)
                .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_F5_Quotation_Proposer");
            entity.HasIndex(e => new { e.ServiceRequestId, e.WorkerId }).IsUnique()
                .HasFilter("[Status] = N'Pending'").HasDatabaseName("UX_F5_Quotations_Pending");
            entity.HasIndex(e => e.ParentQuotationId).IsUnique()
                .HasFilter("[ParentQuotationId] IS NOT NULL").HasDatabaseName("UX_F5_Quotations_Child");
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

        modelBuilder.Entity<SosAlert>(entity =>
        {
            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(50)
                .HasDefaultValue(SosAlertStatus.Open);

            entity.Property(e => e.TriggeredAt)
                .HasDefaultValueSql("(sysutcdatetime())");

            entity.HasOne(d => d.Booking)
                .WithMany(p => p.SosAlerts)
                .HasForeignKey(d => d.BookingId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Customer)
                .WithMany()
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.Worker)
                .WithMany()
                .HasForeignKey(d => d.WorkerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(d => d.ResolvedByAdmin)
                .WithMany()
                .HasForeignKey(d => d.ResolvedByAdminId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
