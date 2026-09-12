---
name: db-work
description: Safely inspect and change the Tak and Rat Supabase schema and data, including migrations, backups, queries, RLS, and Edge Functions.
---

# Database work

This project uses Supabase from browser code and Supabase Edge Functions. Treat production orders, customer identifiers, payment data, and service-role credentials as sensitive.

## Locate the authority first

- Inspect `src/lib/supabase.ts`, `src/services/adminService.ts`, `src/hooks/useProductFetch.ts`, `supabase/config.toml`, `supabase/functions/`, `.env.example`, and `README.md` before writing SQL.
- Find the actual schema source and migration history. Do not assume a migration directory exists or that a local schema matches the deployed Supabase project.
- Map each table and column to its current caller. Check `src/types.ts` and function payloads before changing names or types.
- Separate public catalog access from owner-only order and administration access. Check Row Level Security policies and function authorization, not just frontend visibility.

## Safe change sequence

1. State the affected tables, data, callers, security policies, and expected rollback path.
2. Confirm the target environment. Never run a destructive command against production based on an ambiguous environment name.
3. Take or confirm a restorable backup before destructive changes. Do not print or copy production customer data into chat, logs, or a checked-in fixture.
4. Write a versioned, forward-only migration in the repository's established format. Make it safe to inspect and avoid ad hoc dashboard-only changes that cannot be reproduced.
5. Apply changes to a local or disposable environment first. Verify constraints, defaults, indexes, RLS, and old and new application paths.
6. Back up before production rollout. Apply the migration only with explicit authorization, then verify the deployed schema and application behavior.

## Query and data rules

- Select only required columns and rows. Bound exploratory queries and avoid dumping entire orders or user tables.
- Use parameters or Supabase query builders for untrusted values. Do not concatenate user input into SQL.
- Never use `SUPABASE_SERVICE_ROLE_KEY` in browser code, commit it, or expose it in logs. Keep server credentials in the relevant secret store.
- Do not weaken RLS to make a failing client query pass. Fix the policy or move the operation to an authorized server function.
- Treat browser-supplied prices, quantities, order totals, roles, and Telegram IDs as untrusted. Validate authoritative values at the server boundary.
- For backups, record scope, time, destination, access controls, retention, and a tested restore method. A backup that has not been restored is unverified.

## Verify

Run the migration against a disposable database where possible. Inspect resulting columns, constraints, policies, and representative query behavior. Run `npm run lint` and `npm run build` for app changes. Report what was tested and do not claim a backup, migration, or restore succeeded unless the operation actually completed.
