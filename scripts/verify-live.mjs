// Read-only opt-in checks. Run with node --env-file=.env.local scripts/verify-live.mjs.
import assert from "node:assert/strict";

const app = process.env.TEST_APP_URL || "http://127.0.0.1:3000";
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
const page = await request(app);
assert.equal(page.status, 200);
const html = await page.text();
assert.ok(html.includes("Experimental"));
const unauthenticated = await request(`${app}/api/posthog`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
assert.equal(unauthenticated.status, 401);
const invalidSession = await request(`${app}/api/posthog`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer invalid-test-token" }, body: "{}" });
assert.equal(invalidSession.status, 401);
assert.equal((await request(`${app}/api/posthog`)).status, 405);
console.log("PASS: app HTTP 200, PostHog anonymous/invalid sessions 401, GET 405.");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (url && key) {
  const headers = { apikey: key, "Content-Type": "application/json" };
  assert.equal((await request(`${url}/auth/v1/settings`, { headers })).status, 200);
  const response = await request(`${url}/rest/v1/rpc/get_public_preview`, { method: "POST", headers, body: "{}" });
  assert.equal(response.status, 200);
  const preview = await response.json();
  console.log(`PASS: Supabase Auth and public preview accessible; projects=${preview?.records?.filter(r => r.kind === "project").length || 0}.`);
  // Report only aggregate counts; never print credentials, profiles or attachments.
  if (preview?.attachments?.length) console.log(`PENDING: migration 010 is needed; public attachment metadata count=${preview.attachments.length}.`);
}
