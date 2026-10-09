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
  // RLS exposes existing memberships only. Older RPCs may create an unsolicited team.
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
  // Never display attachment metadata from installations awaiting migration 010.
  return { ...data, attachments: [] } as PublicPreview;
}


export type InvitationPreview = {
  team_name: string;
  role: "editor" | "viewer";
  expires_at: string;
};

export async function getInvitationPreview(
  client: SupabaseClient,
  inviteToken: string,
): Promise<InvitationPreview | null> {
  const { data, error } = await client.rpc("get_invitation_preview", {
    invite_token: inviteToken,
  });
  if (error) throw new Error(error.message);
  return (data || null) as InvitationPreview | null;
}
