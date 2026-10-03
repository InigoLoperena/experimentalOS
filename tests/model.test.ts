import { test } from "node:test";
import assert from "node:assert/strict";
import { progress, score, validate } from "../lib/model";
import { cleanExperimentFields, normalizeExperiment } from "../lib/experiments";
import { demoItems } from "../lib/demo";
test("OKR progress supports increasing and decreasing targets and zero range", () => {
  assert.equal(progress({ baseline: 200, current: 265, target: 400 }), 33);
  assert.equal(progress({ baseline: 8, current: 6, target: 4 }), 50);
  assert.equal(progress({ baseline: 1, current: 1, target: 1 }), 0);
});
test("ICE uses impact × confidence × ease and rejects invalid scores", () => {
  assert.equal(score({ impact: 7, confidence: 7, ease: 9 }), 441);
  for (const value of [0, 11, 1.5, "invalid"]) {
    assert.match(
      validate({
        kind: "experiment",
        title: "Test",
        parent_id: null,
        fields: { impact: value },
      }) || "",
      /enteros entre 1 y 10/,
    );
  }
});
test("standalone experiments save without removed launch or completion fields", () => {
  assert.equal(
    validate({
      kind: "experiment",
      title: "Test",
      parent_id: null,
      fields: {
        hypothesis: "H",
        metric: "M",
        success_criteria: "S",
        traffic_plan: "50% control, 50% cambio",
        start: "2026-10-03",
      },
    }),
    null,
  );
  assert.match(
    validate({ kind: "experiment", title: " ", parent_id: null, fields: {} }) ||
      "",
    /nombre/,
  );
  assert.match(
    validate({ kind: "idea", title: "Idea", parent_id: null, fields: {} }) ||
      "",
    /padre/,
  );
});
test("legacy experiments can be edited and exported without obsolete constraints or fields", () => {
  const original = {
    ...demoItems.find((item) => item.kind === "experiment")!,
    fields: {
      context: "Contexto",
      metric: "M",
      start: "2026-10-03",
      impact: 7,
      status: "Finalizado",
      variants: "invalid JSON",
      method: "A/B aleatorizado",
      project_id: "missing",
      end: "2020-01-01",
      cost: -1,
      analyst_id: "missing",
    },
  };
  const normalized = normalizeExperiment(original);
  assert.equal(validate(original), null);
  assert.deepEqual(normalized.fields, {
    context: "Contexto",
    metric: "M",
    start: "2026-10-03",
    impact: 7,
  });
  assert.equal(normalized.project_id, original.project_id);
  assert.equal(normalized.parent_id, original.parent_id);
  assert.equal(normalized.owner_id, original.owner_id);
  assert.equal(original.fields.status, "Finalizado");
  assert.deepEqual(cleanExperimentFields(normalized.fields), normalized.fields);
  assert.equal(normalizeExperiment(demoItems[0]), demoItems[0]);
});
