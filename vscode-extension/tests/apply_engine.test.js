const test = require("node:test");
const assert = require("node:assert/strict");

const { buildApplyPlan, applyPlan } = require("../apply_engine");

test("replace using line range and old_code", () => {
  const source = "def add(a, b):\n    return a+b\n";
  const plan = buildApplyPlan({
    documentPath: "C:\\repo\\demo.py",
    documentText: source,
    changes: [
      {
        type: "replace",
        line_start: 2,
        line_end: 2,
        old_code: "    return a+b\n",
        new_code: "    return a + b\n",
      },
    ],
  });
  assert.equal(plan.ok, true);

  const result = applyPlan(source, plan);
  assert.equal(result.ok, true);
  assert.equal(result.text, "def add(a, b):\n    return a + b\n");
});

test("insert after target line instead of appending blindly", () => {
  const source = "line1\nline2\nline3\n";
  const plan = buildApplyPlan({
    documentPath: "C:\\repo\\demo.py",
    documentText: source,
    changes: [
      {
        type: "insert",
        line_start: 1,
        new_code: "inserted\n",
      },
    ],
  });
  assert.equal(plan.ok, true);
  const result = applyPlan(source, plan);
  assert.equal(result.ok, true);
  assert.equal(result.text, "line1\ninserted\nline2\nline3\n");
});

test("reject mismatching old_code in target range", () => {
  const source = "alpha\nbeta\n";
  const plan = buildApplyPlan({
    documentPath: "C:\\repo\\demo.py",
    documentText: source,
    changes: [
      {
        type: "replace",
        line_start: 2,
        line_end: 2,
        old_code: "gamma",
        new_code: "beta2",
      },
    ],
  });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /passt nicht/);
});

test("reject change for non-active file", () => {
  const source = "x = 1\n";
  const plan = buildApplyPlan({
    documentPath: "C:\\repo\\demo.py",
    documentText: source,
    changes: [
      {
        type: "replace",
        file_path: "C:\\repo\\other.py",
        line_start: 1,
        line_end: 1,
        old_code: "x = 1\n",
        new_code: "x = 2\n",
      },
    ],
  });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /Dateipfad passt nicht/);
});
