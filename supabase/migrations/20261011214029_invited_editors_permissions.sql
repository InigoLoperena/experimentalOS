begin;
-- Existing members retain their grants. New editors start with read access until the owner grants specific actions.
alter table public.members alter column permissions set default '{}'::text[];
notify pgrst,'reload schema';
commit;
