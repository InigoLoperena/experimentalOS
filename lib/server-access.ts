import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Item } from "./model";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Keep user queries under their JWT and RLS. No service-role client is used here.
export async function authenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer \S+$/.test(authorization)) throw new ApiError("Inicia sesión para continuar.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ApiError("El servidor no tiene configurado Supabase.", 503);
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ApiError("La sesión ha caducado. Inicia sesión de nuevo.", 401);
  return { client, user: data.user };
}

export async function authorizedProject(client: SupabaseClient, id: string): Promise<Item> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError("Selecciona un proyecto válido.", 400);
  const { data, error } = await client.from("records").select("*").eq("id", id).eq("kind", "project").single();
  if (error || !data) throw new ApiError("No tienes acceso a ese proyecto.", 403);
  return data as Item;
}
