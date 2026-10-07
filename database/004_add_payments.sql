-- Retired development entry point. No database context or schema is changed.
-- Use the host-neutral canonical SQL path documented in docs/database/PAYMENT_SCHEMA_AUTHORITY.md.
THROW 51064, 'Payment schema is SQL-owned: run database/production/006_payment_schema_authority.sql preflight, then explicitly apply it in the intended database. Do not use retired 004.', 1;
