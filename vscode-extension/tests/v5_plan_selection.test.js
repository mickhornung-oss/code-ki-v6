const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MAX_V5_REFINEMENT_CHARS,
  V5_REFINEMENT_TYPES,
  sanitizeV5Refinement,
  normalizeV5RefinementType,
  getV5RefinementTypeLabel,
  resolveSelectedPlan,
  buildV5ExecutionPrompt,
  buildV5PlanPreview,
  buildV5DryRunImpact,
  buildV5DryRunDiffSketch,
} = require("../v5_plan_selection");

test("resolveSelectedPlan returns exact selected plan", () => {
  const workflow = {
    alternatives: [
      { id: "plan_a_conservative", title: "Plan A" },
      { id: "plan_b_bolder", title: "Plan B" },
    ],
  };
  const selected = resolveSelectedPlan(workflow, "plan_b_bolder");
  assert.equal(selected.id, "plan_b_bolder");
});

test("buildV5ExecutionPrompt contains only selected plan context", () => {
  const prompt = buildV5ExecutionPrompt("Verbessere add", {
    id: "plan_a_conservative",
    title: "Plan A - konservativ",
    strategy: "Nur aktive Datei",
    risk_level: "low",
    files: ["demo.py"],
    steps: [
      { title: "Kontext begrenzen", purpose: "nur aktive Datei" },
      { title: "Kleine Aenderung", purpose: "Spacing fix" },
    ],
  });
  assert.match(prompt, /Ausgewaehlter Plan: Plan A - konservativ/);
  assert.match(prompt, /Nutze nur diesen ausgewaehlten Plan/);
  assert.doesNotMatch(prompt, /Plan B/);
});

test("sanitizeV5Refinement keeps refinement small and normalized", () => {
  const raw = "  Fokus   nur   auf   return  \n\n  keine neuen helper   ";
  const normalized = sanitizeV5Refinement(raw);
  assert.equal(normalized, "Fokus nur auf return keine neuen helper");

  const longText = "x".repeat(MAX_V5_REFINEMENT_CHARS + 20);
  assert.equal(sanitizeV5Refinement(longText).length, MAX_V5_REFINEMENT_CHARS);
});

test("v5 refinement types are stable and distinct", () => {
  const keys = V5_REFINEMENT_TYPES.map((entry) => entry.key);
  assert.deepEqual(keys, ["none", "narrow_focus", "more_conservative", "stricter_style"]);
  assert.equal(normalizeV5RefinementType("stricter_style"), "stricter_style");
  assert.equal(normalizeV5RefinementType("invalid"), "none");
  assert.equal(getV5RefinementTypeLabel("narrow_focus"), "Fokus enger");
});

test("buildV5ExecutionPrompt includes bounded V5.7 refinement when present", () => {
  const prompt = buildV5ExecutionPrompt(
    "Verbessere add",
    {
      id: "plan_a_conservative",
      title: "Plan A - konservativ",
      strategy: "Nur aktive Datei",
      risk_level: "low",
      files: ["demo.py"],
      steps: [{ title: "Kleine Aenderung", purpose: "Spacing fix" }],
    },
    " Nur   spacing fix, keine neuen Funktionen ",
    "more_conservative"
  );
  assert.match(prompt, /V5\.7 Planwahl\+DryRun\+Diff\+Praezisierungstypen/);
  assert.match(prompt, /Fester Praezisierungstyp \(V5\.7\): Konservativer \(more_conservative\)/);
  assert.match(prompt, /Kleine Nutzer-Praezisierung \(V5\.7, begrenzt\): Nur spacing fix, keine neuen Funktionen/);
});

test("buildV5PlanPreview returns structured preview payload", () => {
  const preview = buildV5PlanPreview({
    id: "plan_b_bolder",
    title: "Plan B - mutiger",
    strategy: "Aktive Datei plus Kontexterweiterung",
    risk_level: "medium",
    files: ["demo.py", "backend/service.py"],
  });
  assert.equal(preview.plan_id, "plan_b_bolder");
  assert.equal(preview.plan_title, "Plan B - mutiger");
  assert.equal(preview.risk_profile, "medium");
  assert.deepEqual(preview.expected_files, ["demo.py", "backend/service.py"]);
  assert.match(preview.next_action, /Preview freigeben/);
});

test("buildV5PlanPreview distinguishes plan profiles", () => {
  const previewA = buildV5PlanPreview({
    id: "plan_a_conservative",
    title: "Plan A - konservativ",
    strategy: "Nur aktive Datei",
    risk_level: "low",
    files: ["demo.py"],
  });
  const previewB = buildV5PlanPreview({
    id: "plan_b_bolder",
    title: "Plan B - mutiger",
    strategy: "Aktive Datei plus Kontexterweiterung",
    risk_level: "medium",
    files: ["demo.py", "backend/service.py"],
  });
  assert.notEqual(previewA.plan_id, previewB.plan_id);
  assert.notEqual(previewA.risk_profile, previewB.risk_profile);
  assert.notDeepEqual(previewA.expected_files, previewB.expected_files);
});

test("buildV5DryRunImpact marks simulation and provides structured impact", () => {
  const dryRun = buildV5DryRunImpact({
    id: "plan_a_conservative",
    title: "Plan A - konservativ",
    strategy: "Nur aktive Datei",
    risk_level: "low",
    files: ["demo.py"],
    steps: [
      { title: "Kontext begrenzen", purpose: "Nur aktive Datei betrachten" },
      { title: "Kleine Aenderung", purpose: "Lokaler Replace erwartet" },
    ],
  });
  assert.equal(dryRun.simulation, true);
  assert.equal(dryRun.plan_id, "plan_a_conservative");
  assert.deepEqual(dryRun.expected_files, ["demo.py"]);
  assert.deepEqual(dryRun.expected_change_types, ["replace", "small_refactor"]);
  assert.equal(Array.isArray(dryRun.expected_areas), true);
  assert.ok(dryRun.expected_areas.length >= 2);
});

test("buildV5DryRunDiffSketch is simulation and non-applicable", () => {
  const sketch = buildV5DryRunDiffSketch({
    id: "plan_b_bolder",
    title: "Plan B - mutiger",
    strategy: "Aktive Datei plus Kontexterweiterung",
    risk_level: "medium",
    files: ["demo.py", "backend/service.py"],
    steps: [{ title: "Kontext mappen", purpose: "Dateien vergleichen" }],
  });

  assert.equal(sketch.simulation, true);
  assert.equal(sketch.non_applicable, true);
  assert.equal(sketch.plan_id, "plan_b_bolder");
  assert.equal(Array.isArray(sketch.sketches), true);
  assert.ok(sketch.sketches.length >= 1);
  assert.match(sketch.sketches[0].pseudo_hunk[0], /@@ SIMULATION/);
});
