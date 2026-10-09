import type { SupabaseClient } from "@supabase/supabase-js";

export async function registerAccount(client: SupabaseClient, input: { email: string; password: string; name: string; redirectTo: string }) {
  const { data, error } = await client.auth.signUp({
    email: input.email.trim(), password: input.password,
    options: { data: { name: input.name.trim() }, emailRedirectTo: input.redirectTo },
  });
  if (error) throw new Error(error.message);
  // With email confirmation enabled a successful signup deliberately has no session.
  return data.session?.user || null;
}
