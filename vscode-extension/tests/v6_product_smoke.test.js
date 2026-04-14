const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const extensionPath = path.resolve(__dirname, "..", "extension.js");
const packageJsonPath = path.resolve(__dirname, "..", "package.json");
const source = fs.readFileSync(extensionPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

test("v6 mode is present and marked as standard", () => {
  assert.match(source, /<option value="agent_v6" selected>V6 Produkt \(Standard\)<\/option>/);
  assert.match(source, /<strong>V6 Minimal Product Flow<\/strong>/);
});

test("v6 mode shows dedicated start status and renderer", () => {
  assert.match(source, /V6-Produktlauf startet/);
  assert.match(source, /function renderV6ProductFlow\(v6\)/);
});

test("v6 context guard uses same safe python-context block as v4/v5/project-agent", () => {
  assert.match(source, /function shouldBlockForMissingPythonContext\(payload\)/);
  assert.match(source, /allowProjectAnalysisWithoutActivePython\(payload\)/);
  assert.match(source, /payload\.mode === "agent_project"/);
  assert.match(source, /payload\.workspace_root/);
});

test("project agent mode and autonomy approval are present", () => {
  assert.match(source, /Projektagent \(autonom nach Freigabe\)/);
  assert.match(source, /agent_control:/);
  assert.match(source, /autonomy_approved/);
});

test("single-window sidebar provider is registered", () => {
  assert.match(source, /registerWebviewViewProvider\("codeKIV3\.sidebarView"/);
  assert.match(source, /workbench\.view\.extension\.codeKIV3ViewContainer/);
  assert.match(source, /codeKIV3\.sidebarView\.focus/);
});

test("sidebar uses the same main webview html as primary surface", () => {
  assert.match(source, /function getSidebarHtml\(\)\s*{\s*return getHtml\(sidebarViewRef\?\.webview \|\| null\);\s*}/);
});

test("default open command targets sidebar path, panel is separate legacy command", () => {
  assert.match(source, /registerCommand\("codeKIV3\.openAssistant", async \(\) => \{/);
  assert.match(source, /executeCommand\("workbench\.view\.extension\.codeKIV3ViewContainer"\)/);
  assert.match(source, /executeCommand\("codeKIV3\.sidebarView\.focus"\)/);
  assert.match(source, /registerCommand\("codeKIV3\.openAssistantPanel"/);
});

test("sidebar ui exposes mode hint and project-agent-only autonomy toggle", () => {
  assert.match(source, /id="modeHint"/);
  assert.match(source, /id="agentAutonomyRow"/);
  assert.match(source, /function updateModeUi\(\)/);
  assert.match(source, /if \(mode === "agent_project"\)/);
});

test("project agent allows workspace analysis without active python file but keeps strict write-intent detection", () => {
  assert.match(source, /function isLikelyProjectWorkspaceAnalysisPrompt\(promptText\)/);
  assert.match(source, /PROJECT_ANALYSIS_HINT_PATTERNS/);
  assert.match(source, /PROJECT_CHANGE_HINT_PATTERNS/);
  assert.match(source, /context_source = "workspace_project_analysis"/);
});

test("manifest view contribution is a webview and matches provider/view container ids", () => {
  const viewContainerId = "codeKIV3ViewContainer";
  const sidebarViewId = "codeKIV3.sidebarView";
  const views = manifest.contributes?.views?.[viewContainerId];
  assert.ok(Array.isArray(views), "expected views contribution array for sidebar container");
  const sidebarView = views.find((entry) => entry.id === sidebarViewId);
  assert.ok(sidebarView, "expected sidebar view contribution");
  assert.equal(sidebarView.type, "webview");
});

test("manifest commands, activation events and runtime registrations stay consistent", () => {
  const requiredCommands = [
    "codeKIV3.openAssistant",
    "codeKIV3.openAssistantPanel",
    "codeKIV3.runApplyFlowSelfTest",
  ];

  const contributedCommands = new Set((manifest.contributes?.commands || []).map((entry) => entry.command));
  const activationEvents = new Set(manifest.activationEvents || []);

  for (const commandId of requiredCommands) {
    assert.ok(contributedCommands.has(commandId), `manifest command missing: ${commandId}`);
    assert.ok(activationEvents.has(`onCommand:${commandId}`), `activation event missing for: ${commandId}`);
    assert.match(source, new RegExp(`registerCommand\\("${commandId.replace(/\./g, "\\.")}"`));
  }

  assert.ok(activationEvents.has("onView:codeKIV3.sidebarView"), "onView activation missing for sidebar");
});

test("webview html uses nonce-based CSP and does not embed data fonts", () => {
  assert.match(source, /return String\.raw`<!DOCTYPE html>/);
  assert.match(source, /function createWebviewNonce\(\)/);
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /font-src \$\{cspSource\} https:\/\/\*\.vscode-cdn\.net/);
  assert.match(source, /font-family: var\(--vscode-font-family\), "Segoe UI", sans-serif/);
  assert.doesNotMatch(source, /data:font\/woff2|@font-face/);
});

test("main webview path avoids inline styles and style.display mutations", () => {
  assert.doesNotMatch(source, /style="/);
  assert.doesNotMatch(source, /\.style\.display\s*=/);
  assert.match(source, /function setVisible\(element, visible\)/);
  assert.match(source, /\[hidden\] \{ display: none !important; \}/);
});

test("packaging includes all runtime local dependencies required by extension.js", () => {
  const localRequirePattern = /require\("(\.\/[^"]+)"\)/g;
  const runtimeLocalModules = new Set();
  let match = localRequirePattern.exec(source);
  while (match) {
    runtimeLocalModules.add(`${match[1].replace("./", "")}.js`);
    match = localRequirePattern.exec(source);
  }

  const packagedFiles = new Set(manifest.files || []);
  for (const moduleFile of runtimeLocalModules) {
    assert.ok(packagedFiles.has(moduleFile), `runtime dependency missing from package files: ${moduleFile}`);
  }
});
