-- Religion + household budget (owner-approved 2026-11-14), part 1 of 2.
-- New enum values can't be used in the transaction that adds them, so the dealbreaker value is
-- added here on its own and used from the next migration.

do $$ begin
  create type public.religion as enum (
    'hindu', 'muslim', 'christian', 'sikh', 'jain', 'buddhist', 'parsi', 'other', 'prefer_not_to_say'
  );
exception when duplicate_object then null; end $$;

-- Religion may be marked as a dealbreaker (same religion only).
alter type public.dealbreaker_field add value if not exists 'religion';
