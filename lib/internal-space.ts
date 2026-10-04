import type { SupabaseClient } from "@supabase/supabase-js";

// The database keeps the existing space identifier to preserve records and permissions.
// There is no company profile or company selector in the application.
export async function openInternalSpace(client: SupabaseClient): Promise<{ id: string } | null> {
  const { data, error } = await client.rpc("open_internal_space");
  if (!error) return data ? { id: data } : null;
  if (!["PGRST202", "42883"].includes(error.code)) throw new Error(error.message);

  // Existing members can continue using their data before migration 005 is applied.
  // RLS limits this fallback to spaces the signed-in person already belongs to.
  const legacy = await client.from("workspaces").select("id").order("created_at").order("id").limit(1);
  if (legacy.error) throw new Error(legacy.error.message);
  return legacy.data?.[0] || null;
}
