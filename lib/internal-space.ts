import type { SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Item, Member } from "./model";
import type { Attachment } from "./attachments";

export type PublicPreview = {
  workspace: { id: string; name?: string } | null;
  records: Item[];
  members: Member[];
  activity: Activity[];
  attachments: Attachment[];
};

const missingRpc = (code?: string) => ["PGRST202", "42883"].includes(code || "");

export async function openTeamSpace(client: SupabaseClient): Promise<{ id: string } | null> {
  const current = await client.rpc("open_team_space");
  if (!current.error) return current.data ? { id: current.data as string } : null;
  if (!missingRpc(current.error.code)) throw new Error(current.error.message);

  const legacy = await client.rpc("open_internal_space");
  if (!legacy.error) return legacy.data ? { id: legacy.data as string } : null;
  if (!missingRpc(legacy.error.code)) throw new Error(legacy.error.message);

  const fallback = await client.from("workspaces").select("id").order("created_at").order("id").limit(1);
  if (fallback.error) throw new Error(fallback.error.message);
  return fallback.data?.[0] || null;
}

export async function getPublicPreview(client: SupabaseClient): Promise<PublicPreview | null> {
  const { data, error } = await client.rpc("get_public_preview");
  if (error) {
    if (missingRpc(error.code)) return null;
    throw new Error(error.message);
  }
  if (!data || typeof data !== "object") return null;
  return data as PublicPreview;
}
