-- Recovered from the verified remote migration ledger; keep fresh installs in sync.
GRANT EXECUTE ON FUNCTION public.create_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION experimental_private.create_team(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_team(text) FROM anon;
REVOKE EXECUTE ON FUNCTION experimental_private.create_team(text) FROM anon;
