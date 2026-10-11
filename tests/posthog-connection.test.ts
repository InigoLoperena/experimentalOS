import { test } from "node:test";
import assert from "node:assert/strict";
import { verifiedPosthogConnection } from "../lib/posthog-connection";
import { item, queuedClient } from "./service-fixture";

test("server key follows a verified tenant binding, never editable project fields", async () => {
  const project = item("p", "project", { posthog_project_id: "42", posthog_host: "https://us.posthog.com/" });
  const binding = { external_project_id: "42", host: "https://us.posthog.com", credential_ref: "legacy_posthog_server" };
  const mock = queuedClient([{ data: binding, error: null }]);
  assert.deepEqual(await verifiedPosthogConnection(mock.client, project), { host: "https://us.posthog.com", projectId: "42" });
  assert.deepEqual(mock.calls[0].filters, { workspace_id: "w", project_id: "p" });
  for (const tampered of [{ ...project, fields: { ...project.fields, posthog_project_id: "99" } },
    { ...project, fields: { ...project.fields, posthog_host: "https://eu.posthog.com" } }]) {
    await assert.rejects(verifiedPosthogConnection(queuedClient([{ data: binding, error: null }]).client, tampered), /verificar/);
  }
  await assert.rejects(verifiedPosthogConnection(queuedClient([{ data: null, error: null }]).client, project), /autorizada/);
  await assert.rejects(verifiedPosthogConnection(queuedClient([{ data: null, error: { message: "missing table" } }]).client, project), /configuración/);
});
