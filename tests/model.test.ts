import { test } from "node:test";
import assert from "node:assert/strict";
import { progress, score, validate } from "../lib/model";
import { defaultVariants, variantError } from "../lib/variants";
test("OKR progress supports an increasing target, a decreasing target, and zero range", () => {
  assert.equal(progress({ baseline: 200, current: 265, target: 400 }), 33);
  assert.equal(progress({ baseline: 8, current: 6, target: 4 }), 50);
  assert.equal(progress({ baseline: 1, current: 1, target: 1 }), 0);
});
test("ICE matches the supplied spreadsheet formula H × I × J", () =>
  assert.equal(score({ impact: 7, confidence: 7, ease: 9 }), 441));
test("experiment launch requires a predeclared hypothesis, metric and success criteria", () => {
  assert.match(
    validate({
      kind: "experiment",
      title: "Test",
      parent_id: "idea",
      fields: { status: "En curso" },
    }) || "",
    /Antes de lanzar/,
  );
});
test("finishing requires result, conclusion, learning and decision", () => {
  assert.match(
    validate({
      kind: "experiment",
      title: "Test",
      parent_id: "idea",
      fields: {
        status: "Finalizado",
        hypothesis: "H",
        metric: "M",
        success_criteria: "S",
        method: "Piloto",
        start: "2026-10-01",
        end: "2026-10-10",
        baseline: 0,
        target: 1,
      },
    }) || "",
    /Para finalizar/,
  );
});
test("variant traffic, samples and number of arms are validated", () => {
  assert.equal(
    variantError({
      method: "A/B aleatorizado",
      variants: JSON.stringify(defaultVariants),
    }),
    null,
  );
  assert.match(
    variantError({
      method: "A/B aleatorizado",
      variants: JSON.stringify([{ ...defaultVariants[0], traffic: 20 }]),
    }) || "",
    /100%/,
  );
  assert.match(
    variantError({
      variants: JSON.stringify([
        { ...defaultVariants[0], exposed: 1, conversions: 2 },
      ]),
    }) || "",
    /enteros válidos/,
  );
});
