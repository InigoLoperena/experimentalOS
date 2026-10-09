import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerAccount } from "../lib/auth-service";

test("signup supports email confirmation without treating the missing session as a login failure", async () => {
  for (const session of [null, { user: { id: "u" } }]) {
    const calls: unknown[] = [];
    const client = { auth: { signUp: async (input: unknown) => { calls.push(input); return { data: { session }, error: null }; } } } as unknown as SupabaseClient;
    const input = { email: " qa@example.org ", name: " QA ", password: "test-only", redirectTo: "https://app.example.org/?invite=test-invitation" };
    assert.equal((await registerAccount(client, input))?.id || null, session?.user.id || null);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { email: "qa@example.org", password: "test-only", options: { data: { name: "QA" }, emailRedirectTo: input.redirectTo } });
  }
});

test("signup surfaces provider and network failures without reporting success", async () => {
  const rejected = { auth: { signUp: async () => ({ data: { session: null }, error: { message: "Registration disabled" } }) } } as unknown as SupabaseClient;
  const input = { email: "qa@example.org", name: "QA", password: "test-only", redirectTo: "https://app.example.org" };
  await assert.rejects(registerAccount(rejected, input), /Registration disabled/);
  const offline = { auth: { signUp: async () => { throw new Error("Offline"); } } } as unknown as SupabaseClient;
  await assert.rejects(registerAccount(offline, input), /Offline/);
});
