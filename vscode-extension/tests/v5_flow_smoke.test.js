const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const extensionPath = path.resolve(__dirname, "..", "extension.js");
const source = fs.readFileSync(extensionPath, "utf8");

test("v5 flow contains all checkpoints in order", () => {
  const idxPreview = source.indexOf("V5.7 Preview-Checkpoint");
  const idxDryRun = source.indexOf("V5.7 Dry-Run-Auswirkungen (Simulation)");
  const idxDiff = source.indexOf("V5.7 Dry-Run-Diff-Skizze (Simulation, nicht anwendbar)");
  const idxRefine = source.indexOf("V5.7 Praezisierung (fester Typ + optional kurz)");

  assert.ok(idxPreview > -1, "preview checkpoint missing");
  assert.ok(idxDryRun > -1, "dry-run checkpoint missing");
  assert.ok(idxDiff > -1, "diff checkpoint missing");
  assert.ok(idxRefine > -1, "refinement checkpoint missing");
  assert.ok(idxPreview < idxDryRun, "preview must be before dry-run");
  assert.ok(idxDryRun < idxDiff, "dry-run must be before diff");
  assert.ok(idxDiff < idxRefine, "diff must be before refinement");
});

test("v5 diff approve does not trigger backend request directly", () => {
  const diffApproveStart = source.indexOf('v5DiffApproveButton.addEventListener("click"');
  assert.ok(diffApproveStart > -1, "diff approve handler missing");
  const diffApproveBlock = source.slice(diffApproveStart, diffApproveStart + 1200);
  assert.match(diffApproveBlock, /renderV5Refinement\(/);
  assert.doesNotMatch(diffApproveBlock, /approveV5Refinement/);
});

test("v5 refinement approve triggers controlled backend request with type+text", () => {
  const refineApproveStart = source.indexOf('v5RefineApproveButton.addEventListener("click"');
  assert.ok(refineApproveStart > -1, "refine approve handler missing");
  const refineApproveBlock = source.slice(refineApproveStart, refineApproveStart + 1800);
  assert.match(refineApproveBlock, /type:\s*"approveV5Refinement"/);
  assert.match(refineApproveBlock, /refinement_type:\s*refinementType/);
  assert.match(refineApproveBlock, /refinement,/);
});
