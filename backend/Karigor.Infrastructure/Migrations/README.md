# Historical EF migrations

These migrations and their snapshot describe an older schema. They are retained as historical artifacts, not the F5 upgrade path. Ordinary startup calls neither `Migrate` nor `EnsureCreated`.

F5 is owned exclusively by [the versioned SQL script](../../../database/production/005_f5_negotiation_integrity.sql). Its mappings are in the current models/DbContext. Do not generate or apply an independent F5 EF migration from this stale snapshot. See [schema authority and migration](../../../docs/database/F5_SCHEMA_AUTHORITY_AND_MIGRATION.md) and [ADR 0003](../../../docs/adr/0003-f5-sql-authority-and-immutable-negotiation.md).
