const vscode = require("vscode");
const { buildApplyPlan, applyPlan } = require("./apply_engine");
const {
  MAX_V5_REFINEMENT_CHARS,
  V5_REFINEMENT_TYPES,
  normalizeV5RefinementType,
  getV5RefinementTypeLabel,
  sanitizeV5Refinement,
  buildV5ExecutionPrompt,
  buildV5PlanPreview,
  buildV5DryRunImpact,
  buildV5DryRunDiffSketch
} = require("./v5_plan_selection");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

if (typeof Buffer === "undefined") {
  global.Buffer = require("buffer").Buffer;
}

let panelRef = null;
let sidebarViewRef = null;
const APPLY_CONFIRM_LABEL = "Aenderungen anwenden";
let lastPythonContext = null;

function isPythonFileDocument(document) {
  return Boolean(
    document
    && document.languageId === "python"
    && document.uri
    && document.uri.scheme === "file"
  );
}

function isPathWithinWorkspaceRoot(candidatePath, workspaceRoot) {
  if (!candidatePath || !workspaceRoot) {
    return false;
  }
  try {
    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedCandidate = path.resolve(candidatePath);
    return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(resolvedRoot + path.sep);
  } catch {
    return false;
  }
}

function buildContextFromDocument(document, workspaceFiles, selectionText = null, source = "active_editor") {
  const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
    || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    || null;
  return {
    current_file_path: document.uri.fsPath,
    current_file_text: document.getText(),
    current_file_language: document.languageId,
    selected_text: selectionText,
    workspace_root: workspaceRoot,
    workspace_files: workspaceFiles,
    context_source: source,
    v4_context_error: null
  };
}

function rememberPythonContextFromDocument(document) {
  if (!isPythonFileDocument(document)) {
    return;
  }
  lastPythonContext = {
    current_file_path: document.uri.fsPath,
    current_file_text: document.getText(),
    current_file_language: document.languageId,
    workspace_root: vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
      || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      || null
  };
}

function createWebviewNonce() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}

function getHtml(webview) {
  const nonce = createWebviewNonce();
  const cspSource = webview?.cspSource || "'self'";
  return `<!DOCTYPE html>
  <html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; font-src ${cspSource} https://*.vscode-cdn.net; connect-src ${cspSource} http://127.0.0.1:8787 http://localhost:8787;" />
    <style nonce="${nonce}">
      body { font-family: var(--vscode-font-family), "Segoe UI", sans-serif; padding: 12px; color: #1f2937; background: #f7faf8; }
      h2 { margin: 0 0 8px 0; font-size: 18px; }
      label { display: block; font-size: 12px; font-weight: 600; margin: 8px 0 6px 0; color: #2b3b34; }
      textarea, select { width: 100%; box-sizing: border-box; margin-bottom: 8px; border: 1px solid #c9d8cf; border-radius: 8px; padding: 9px; background: white; font-size: 12px; }
      #prompt { min-height: 88px; resize: vertical; }
      #traceback { min-height: 72px; resize: vertical; }
      #v5RefinementInput { min-height: 64px; resize: vertical; }
      button { border: 0; background: #2f6f4f; color: white; padding: 10px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; }
      button:disabled { opacity: 0.6; cursor: default; }
      .muted { color: #5f6f67; font-size: 12px; margin-bottom: 8px; line-height: 1.35; }
      .compact { margin-bottom: 6px; }
      .mode-hint { background: #eef4f0; border: 1px solid #d7e2da; border-radius: 8px; padding: 8px; }
      .agent-autonomy-row { margin: 6px 0 10px 0; }
      .agent-autonomy-row label { margin: 0; font-weight: 500; }
      .agent-autonomy-row input { margin-right: 6px; }
      #run { width: 100%; font-weight: 600; }
      .status-pill { border-radius: 8px; padding: 8px 10px; margin-top: 8px; margin-bottom: 10px; border: 1px solid #d3ddd6; background: #edf3ef; color: #1f3c2f; font-size: 12px; }
      .status-running { background: #e8f0fb; border-color: #c7d9f3; color: #173a63; }
      .status-ok { background: #e8f7ee; border-color: #c8e7d1; color: #1d5132; }
      .status-warn { background: #fff4dd; border-color: #f0deab; color: #7a4a0c; }
      .status-error { background: #ffe8e8; border-color: #f2c4c4; color: #7f1d1d; }
      .card { background: white; border: 1px solid #d8e3dc; border-radius: 10px; padding: 10px; margin-top: 10px; }
      .card strong { font-size: 12px; }
      pre { white-space: pre-wrap; word-break: break-word; margin: 0; font-size: 12px; line-height: 1.4; }
      .change-item { background: #f7faf8; border-left: 3px solid #2f6f4f; padding: 10px; margin-bottom: 10px; border-radius: 4px; }
      .change-type { font-weight: bold; color: #2f6f4f; margin-bottom: 5px; }
      .change-desc { font-size: 13px; margin-bottom: 8px; }
      .code-block { background: #f0f0f0; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto; }
      .code-label { font-size: 11px; color: #666; margin-bottom: 4px; }
      .risk-item { color: #8b4513; margin-bottom: 4px; }
      .test-result { background: #f0f0f0; padding: 8px; border-radius: 4px; margin-top: 10px; }
      .test-success { border-left: 3px solid #2f6f4f; }
      .test-failed { border-left: 3px solid #dc2626; }
      .test-warning { border-left: 3px solid #f59e0b; }
      .test-blocked { border-left: 3px solid #6b7280; }
      .plan-selected { border-left-color: #d97706; background: #fffaf0; }
      .plan-select-button { margin-top: 8px; background: #1f5d44; }
      .preview-actions, .dryrun-actions, .diff-actions, .refine-actions { display: flex; gap: 8px; margin-top: 10px; }
      .preview-cancel, .dryrun-cancel, .diff-cancel, .refine-cancel { background: #7a1f1f; }
      .dryrun-approve { background: #1f5d44; }
      .diff-approve { background: #1f5d44; }
      .refine-approve { background: #1f5d44; }
    </style>
  </head>
  <body>
    <h2>Code KI V6</h2>
    <div class="muted">Lokale Python-KI fuer VS Code mit stabilem V4 und isoliertem V5-Testlabor.</div>
    <div class="muted">Build: V4 stabil | V6 Produktstandard | V5.7 experimentell</div>
    <label>Modus</label>
    <select id="mode">
      <option value="agent_v6" selected>V6 Produkt (Standard)</option>
      <option value="agent_project">Projektagent (autonom nach Freigabe)</option>
      <option value="python_task">Python-Aufgabe</option>
      <option value="rewrite">Ueberarbeiten</option>
      <option value="explain">Erklaeren</option>
      <option value="agent_v4">V4 Agent (kontrolliert)</option>
      <option value="agent_v5_lab">V5.7 Testlabor (Mehrplan+Wahl+Preview+DryRun+Diff+Praezisierung+Typen)</option>
    </select>
    <div id="modeHint" class="muted mode-hint"></div>
    <label>Arbeitsauftrag</label>
    <textarea id="prompt" placeholder="Was soll die lokale KI mit dem aktuellen Python-Kontext tun?"></textarea>
    <label>Optionaler Fehler / Traceback</label>
    <textarea id="traceback" placeholder="Optional: Traceback oder Fehlermeldung einfuegen."></textarea>
    <div id="agentAutonomyRow" class="agent-autonomy-row" style="display:none;">
      <label><input type="checkbox" id="agentAutonomy" /> Autonomie-Freigabe fuer Projektagent (nur im Projektordner)</label>
    </div>
    <button id="run">Ausfuehren</button>
    <div id="status" class="status-pill">Bereit.</div>
    <div class="card">
      <strong>Kontext</strong>
      <pre id="context">Noch kein Lauf.</pre>
    </div>
    <div class="card">
      <strong>Zusammenfassung</strong>
      <pre id="summary">Noch keine Antwort.</pre>
    </div>
    <div class="card" id="v4Card" style="display:none;">
      <strong>V4 Ablauf</strong>
      <pre id="v4Status"></pre>
      <div id="v4Plan"></div>
      <div id="v4Checkpoints"></div>
    </div>
    <div class="card" id="v6Card" style="display:none;">
      <strong>V6 Minimal Product Flow</strong>
      <pre id="v6Status"></pre>
      <div id="v6Risk"></div>
    </div>
    <div class="card" id="agentCard" style="display:none;">
      <strong>Projektagent Status</strong>
      <pre id="agentStatus"></pre>
      <div id="agentSteps"></div>
    </div>
    <div class="card" id="v5Card" style="display:none;">
      <strong>V5.7 Testlabor - Alternative Plaene + Planwahl + Preview + Dry-Run + Diff-Skizze + Praezisierungstypen</strong>
      <pre id="v5Status"></pre>
      <div id="v5Plans"></div>
      <div id="v5PreviewCard" class="change-item" style="display:none;">
        <div class="change-type">V5.7 Preview-Checkpoint</div>
        <pre id="v5Preview"></pre>
        <div class="preview-actions">
          <button id="v5Approve">Preview freigeben</button>
          <button id="v5Cancel" class="preview-cancel">Abbrechen</button>
        </div>
      </div>
      <div id="v5DryRunCard" class="change-item" style="display:none;">
        <div class="change-type">V5.7 Dry-Run-Auswirkungen (Simulation)</div>
        <pre id="v5DryRun"></pre>
        <div class="dryrun-actions">
          <button id="v5DryRunApprove" class="dryrun-approve">Dry-Run freigeben</button>
          <button id="v5DryRunCancel" class="dryrun-cancel">Abbrechen</button>
        </div>
      </div>
      <div id="v5DiffCard" class="change-item" style="display:none;">
        <div class="change-type">V5.7 Dry-Run-Diff-Skizze (Simulation, nicht anwendbar)</div>
        <pre id="v5Diff"></pre>
        <div class="diff-actions">
          <button id="v5DiffApprove" class="diff-approve">Diff-Skizze freigeben</button>
          <button id="v5DiffCancel" class="diff-cancel">Abbrechen</button>
        </div>
      </div>
      <div id="v5RefineCard" class="change-item" style="display:none;">
        <div class="change-type">V5.7 Praezisierung (fester Typ + optional kurz)</div>
        <label for="v5RefinementType">Fester Praezisierungstyp</label>
        <select id="v5RefinementType"></select>
        <div class="muted">Maximal ${MAX_V5_REFINEMENT_CHARS} Zeichen. Kein neuer Arbeitsauftrag, nur eine kleine Nachschaerfung.</div>
        <textarea id="v5RefinementInput" placeholder="Optional: kleine Praezisierung (z. B. 'nur spacing fix, keine neuen helper')."></textarea>
        <pre id="v5RefinementPreview"></pre>
        <div class="refine-actions">
          <button id="v5RefineApprove" class="refine-approve">Praezisierung freigeben und weiter</button>
          <button id="v5RefineCancel" class="refine-cancel">Abbrechen</button>
        </div>
      </div>
    </div>
    <div class="card" id="explanationCard" style="display:none;">
      <strong>Erklaerung</strong>
      <pre id="explanation"></pre>
    </div>
    <div class="card" id="changesCard" style="display:none;">
      <strong>Aenderungen</strong>
      <div id="changes"></div>
      <button id="applyChanges" style="margin-top:10px;" disabled>Aenderungen uebernehmen</button>
    </div>
    <div class="card" id="risksCard" style="display:none;">
      <strong>Risiken</strong>
      <pre id="risks"></pre>
    </div>
    <div class="card" id="testCard" style="display:none;">
      <strong>Pruefschritt</strong>
      <div id="testResult"></div>
      <button id="runTest" style="margin-top:10px;">Pruefschritt ausfuehren</button>
    </div>
    <div class="card" id="rawCard" style="display:none;">
      <strong>Rohantwort</strong>
      <pre id="raw"></pre>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const runButton = document.getElementById("run");
      const promptInput = document.getElementById("prompt");
      const tracebackInput = document.getElementById("traceback");
      const modeInput = document.getElementById("mode");
      const modeHintNode = document.getElementById("modeHint");
      const agentAutonomyRow = document.getElementById("agentAutonomyRow");
      const agentAutonomyInput = document.getElementById("agentAutonomy");
      const statusNode = document.getElementById("status");
      const contextNode = document.getElementById("context");
      const summaryNode = document.getElementById("summary");
      const explanationNode = document.getElementById("explanation");
      const explanationCard = document.getElementById("explanationCard");
      const changesNode = document.getElementById("changes");
      const changesCard = document.getElementById("changesCard");
      const applyChangesButton = document.getElementById("applyChanges");
      const risksNode = document.getElementById("risks");
      const risksCard = document.getElementById("risksCard");
      const testCard = document.getElementById("testCard");
      const testResultNode = document.getElementById("testResult");
      const runTestButton = document.getElementById("runTest");
      const rawNode = document.getElementById("raw");
      const rawCard = document.getElementById("rawCard");
      const v4Card = document.getElementById("v4Card");
      const v4StatusNode = document.getElementById("v4Status");
      const v4PlanNode = document.getElementById("v4Plan");
      const v4CheckpointsNode = document.getElementById("v4Checkpoints");
      const v6Card = document.getElementById("v6Card");
      const v6StatusNode = document.getElementById("v6Status");
      const v6RiskNode = document.getElementById("v6Risk");
      const agentCard = document.getElementById("agentCard");
      const agentStatusNode = document.getElementById("agentStatus");
      const agentStepsNode = document.getElementById("agentSteps");
      const v5Card = document.getElementById("v5Card");
      const v5StatusNode = document.getElementById("v5Status");
      const v5PlansNode = document.getElementById("v5Plans");
      const v5PreviewCard = document.getElementById("v5PreviewCard");
      const v5PreviewNode = document.getElementById("v5Preview");
      const v5ApproveButton = document.getElementById("v5Approve");
      const v5CancelButton = document.getElementById("v5Cancel");
      const v5DryRunCard = document.getElementById("v5DryRunCard");
      const v5DryRunNode = document.getElementById("v5DryRun");
      const v5DryRunApproveButton = document.getElementById("v5DryRunApprove");
      const v5DryRunCancelButton = document.getElementById("v5DryRunCancel");
      const v5DiffCard = document.getElementById("v5DiffCard");
      const v5DiffNode = document.getElementById("v5Diff");
      const v5DiffApproveButton = document.getElementById("v5DiffApprove");
      const v5DiffCancelButton = document.getElementById("v5DiffCancel");
      const v5RefineCard = document.getElementById("v5RefineCard");
      const v5RefinementType = document.getElementById("v5RefinementType");
      const v5RefinementInput = document.getElementById("v5RefinementInput");
      const v5RefinementPreview = document.getElementById("v5RefinementPreview");
      const v5RefineApproveButton = document.getElementById("v5RefineApprove");
      const v5RefineCancelButton = document.getElementById("v5RefineCancel");

      let currentStructuredData = null;
      let currentProjectAgentFlow = null;
      let currentV5Workflow = null;
      let currentSelectedV5PlanId = null;
      let currentV5SelectedPlan = null;
      let currentV5Preview = null;
      let currentV5DryRun = null;
      let currentV5DiffSketch = null;
      let currentV5Refinement = "";
      let currentV5RefinementType = "none";

      const MAX_V5_REFINEMENT_LEN = ${MAX_V5_REFINEMENT_CHARS};
      const V5_REFINEMENT_TYPES = ${JSON.stringify(V5_REFINEMENT_TYPES)};

      function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text || "";
        return div.innerHTML;
      }

      function normalizeV5Refinement(text) {
        return String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_V5_REFINEMENT_LEN);
      }

      function normalizeV5RefinementType(typeKey) {
        const key = String(typeKey || "").trim();
        const found = V5_REFINEMENT_TYPES.find((entry) => entry.key === key);
        return found ? found.key : "none";
      }

      function getV5RefinementTypeLabel(typeKey) {
        const normalized = normalizeV5RefinementType(typeKey);
        const found = V5_REFINEMENT_TYPES.find((entry) => entry.key === normalized);
        return found ? found.label : "Kein fester Typ";
      }

      function renderChange(change) {
        let html = '<div class="change-item">';
        html += '<div class="change-type">' + escapeHtml(String(change.type || "").toUpperCase()) + '</div>';
        html += '<div class="change-desc">' + escapeHtml(change.description) + '</div>';

        if (change.file_path) {
          html += '<div class="code-label">Datei: ' + escapeHtml(change.file_path) + '</div>';
        }
        if (change.line_start != null || change.line_end != null) {
          const start = change.line_start != null ? change.line_start : "?";
          const end = change.line_end != null ? change.line_end : start;
          html += '<div class="code-label">Zeilen: ' + escapeHtml(String(start)) + ' - ' + escapeHtml(String(end)) + '</div>';
        }
        if (change.old_code) {
          html += '<div class="code-label">Alter Code:</div>';
          html += '<div class="code-block">' + escapeHtml(change.old_code) + '</div>';
        }

        html += '<div class="code-label">Neuer Code:</div>';
        html += '<div class="code-block">' + escapeHtml(change.new_code) + '</div>';
        html += '</div>';
        return html;
      }

      function renderTestResult(result) {
        if (!result) {
          return "";
        }
        const statusClass = result.status === "success" ? "test-success"
          : result.status === "failed" ? "test-failed"
          : result.status === "warning" ? "test-warning"
          : "test-blocked";

        let html = '<div class="test-result ' + statusClass + '">';
        html += '<div><strong>Status:</strong> ' + escapeHtml(result.status || "unknown") + '</div>';
        if (result.message) {
          html += '<div><strong>Meldung:</strong> ' + escapeHtml(result.message) + '</div>';
        }
        if (result.stdout) {
          html += '<div><strong>Stdout:</strong><pre>' + escapeHtml(result.stdout) + '</pre></div>';
        }
        if (result.stderr) {
          html += '<div><strong>Stderr:</strong><pre>' + escapeHtml(result.stderr) + '</pre></div>';
        }
        html += '</div>';
        return html;
      }

      function initV5RefinementTypeSelect() {
        v5RefinementType.innerHTML = V5_REFINEMENT_TYPES.map((entry) => {
          return '<option value="' + escapeHtml(entry.key) + '">' + escapeHtml(entry.label) + '</option>';
        }).join("");
        v5RefinementType.value = "none";
      }

      function setStatus(text, level = "info") {
        statusNode.textContent = text;
        statusNode.className = "status-pill";
        if (level === "running") {
          statusNode.classList.add("status-running");
        } else if (level === "ok") {
          statusNode.classList.add("status-ok");
        } else if (level === "warn") {
          statusNode.classList.add("status-warn");
        } else if (level === "error") {
          statusNode.classList.add("status-error");
        }
      }

      function getModeHint(mode) {
        if (mode === "agent_v6") {
          return "Standardmodus: schlanker Produktfluss mit risikogesteuerten Hinweisen.";
        }
        if (mode === "agent_project") {
          return "Projektagent: arbeitet nach Freigabe autonom im erlaubten Projektordner.";
        }
        if (mode === "agent_v4") {
          return "V4: kontrollierter Plan-/Checkpoint-Flow mit sichtbarer Schrittlogik.";
        }
        if (mode === "agent_v5_lab") {
          return "V5-Labor: experimenteller Mehrstufenpfad, nicht Teil des Standardbetriebs.";
        }
        return "Direkter Assistenzmodus fuer Einzelaufgaben ohne Agentenkette.";
      }

      function updateModeUi() {
        const mode = modeInput.value;
        modeHintNode.textContent = getModeHint(mode);
        if (mode === "agent_project") {
          agentAutonomyRow.style.display = "block";
        } else {
          agentAutonomyInput.checked = false;
          agentAutonomyRow.style.display = "none";
        }
      }

      function resetStructuredSections() {
        explanationCard.style.display = "none";
        changesCard.style.display = "none";
        risksCard.style.display = "none";
        testCard.style.display = "none";
        rawCard.style.display = "none";
        applyChangesButton.disabled = true;
        runTestButton.disabled = true;
        testResultNode.innerHTML = "";
        v4Card.style.display = "none";
        v4StatusNode.textContent = "";
        v4PlanNode.innerHTML = "";
        v4CheckpointsNode.innerHTML = "";
        v6Card.style.display = "none";
        v6StatusNode.textContent = "";
        v6RiskNode.innerHTML = "";
        agentCard.style.display = "none";
        agentStatusNode.textContent = "";
        agentStepsNode.innerHTML = "";
        currentProjectAgentFlow = null;
        v5Card.style.display = "none";
        v5StatusNode.textContent = "";
        v5PlansNode.innerHTML = "";
        currentV5Workflow = null;
        currentSelectedV5PlanId = null;
        currentV5SelectedPlan = null;
        currentV5Preview = null;
        currentV5DryRun = null;
        currentV5DiffSketch = null;
        currentV5Refinement = "";
        currentV5RefinementType = "none";
        v5PreviewCard.style.display = "none";
        v5PreviewNode.textContent = "";
        v5ApproveButton.disabled = true;
        v5DryRunCard.style.display = "none";
        v5DryRunNode.textContent = "";
        v5DryRunApproveButton.disabled = true;
        v5DiffCard.style.display = "none";
        v5DiffNode.textContent = "";
        v5DiffApproveButton.disabled = true;
        v5RefineCard.style.display = "none";
        v5RefinementType.value = "none";
        v5RefinementInput.value = "";
        v5RefinementPreview.textContent = "";
        v5RefineApproveButton.disabled = true;
      }

      function renderV4Workflow(v4) {
        if (!v4) {
          v4Card.style.display = "none";
          return;
        }
        v4Card.style.display = "block";
        const statusLine = [
          "Finalstatus: " + (v4.final_status || "unbekannt"),
          "Meldung: " + (v4.final_message || "-"),
          "Naechster Schritt: " + (v4.next_action || "-"),
          "Relevante Dateien: " + ((v4.relevant_files || []).length)
        ].join("\\n");
        v4StatusNode.textContent = statusLine;

        const plan = Array.isArray(v4.plan) ? v4.plan : [];
        v4PlanNode.innerHTML = plan.map((step, idx) => {
          const files = Array.isArray(step.files) && step.files.length > 0 ? "\\nDateien: " + step.files.join(", ") : "";
          const details = step.details ? "\\nDetails: " + step.details : "";
          return '<div class=\"change-item\"><div class=\"change-type\">' + escapeHtml(String(idx + 1)) + '. ' + escapeHtml(step.title || step.id || "Schritt") + '</div><div class=\"change-desc\">Status: ' + escapeHtml(step.status || "pending") + '\\n' + escapeHtml(step.purpose || "") + escapeHtml(files) + escapeHtml(details) + '</div></div>';
        }).join("");

        const checkpoints = Array.isArray(v4.checkpoints) ? v4.checkpoints : [];
        if (checkpoints.length === 0) {
          v4CheckpointsNode.innerHTML = "<div class='muted'>Keine offenen Kontrollpunkte.</div>";
          return;
        }
        v4CheckpointsNode.innerHTML = checkpoints.map((cp) => {
          return '<div class=\"change-item\"><div class=\"change-type\">Kontrollpunkt: ' + escapeHtml(cp.title || cp.id || "checkpoint") + '</div><div class=\"change-desc\">Status: ' + escapeHtml(cp.status || "required") + '\\n' + escapeHtml(cp.message || "") + '</div></div>';
        }).join("");
      }

      function renderV6ProductFlow(v6) {
        if (!v6) {
          v6Card.style.display = "none";
          v6StatusNode.textContent = "";
          v6RiskNode.innerHTML = "";
          return;
        }
        v6Card.style.display = "block";
        const statusLine = [
          "Produktmodus: " + (v6.product_label || "V6 Minimal Product Flow"),
          "Finalstatus: " + (v6.final_status || "unbekannt"),
          "Risikostufe: " + (v6.risk_level || "unbekannt"),
          "Meldung: " + (v6.final_message || "-"),
          "Naechste Aktion: " + (v6.next_action || "-"),
        ].join("\\n");
        v6StatusNode.textContent = statusLine;

        const riskReasons = Array.isArray(v6.risk_reasons) ? v6.risk_reasons : [];
        const visibleControls = Array.isArray(v6.visible_controls) ? v6.visible_controls : [];
        const internalMechanisms = Array.isArray(v6.internal_mechanisms) ? v6.internal_mechanisms : [];
        const sections = [];
        if (riskReasons.length > 0) {
          sections.push(
            '<div class="change-item"><div class="change-type">Risikohinweise</div><div class="change-desc">'
              + escapeHtml(riskReasons.join("\\n"))
              + "</div></div>"
          );
        }
        if (visibleControls.length > 0) {
          sections.push(
            '<div class="change-item"><div class="change-type">Sichtbare Zusatzkontrollen</div><div class="change-desc">'
              + escapeHtml(visibleControls.join(", "))
              + "</div></div>"
          );
        }
        if (internalMechanisms.length > 0) {
          sections.push(
            '<div class="change-item"><div class="change-type">Interne Leitplanken (V5-inspiriert)</div><div class="change-desc">'
              + escapeHtml(internalMechanisms.join(", "))
              + "</div></div>"
          );
        }
        v6RiskNode.innerHTML = sections.join("");
      }

      function renderProjectAgentFlow(flow) {
        currentProjectAgentFlow = flow || null;
        if (!flow) {
          agentCard.style.display = "none";
          agentStatusNode.textContent = "";
          agentStepsNode.innerHTML = "";
          return;
        }
        agentCard.style.display = "block";
        const statusText = [
          "Agent: " + (flow.agent_label || "Projektagent"),
          "Autonomie freigegeben: " + (flow.autonomy_approved ? "ja" : "nein"),
          "Projektordner: " + (flow.allowed_project_root || "-"),
          "Finalstatus: " + (flow.final_status || "unbekannt"),
          "Meldung: " + (flow.final_message || "-"),
          "Eskalation: " + (flow.escalation_type || "none"),
          "Grund: " + (flow.escalation_reason || "-"),
          "Naechster Schritt: " + (flow.next_action || "-"),
        ].join("\\n");
        agentStatusNode.textContent = statusText;
        const steps = Array.isArray(flow.steps) ? flow.steps : [];
        agentStepsNode.innerHTML = steps.map((step, idx) => {
          const details = step.details ? "\\nDetails: " + step.details : "";
          return '<div class="change-item"><div class="change-type">' + escapeHtml(String(idx + 1)) + ". " + escapeHtml(step.title || step.id || "Schritt") + '</div><div class="change-desc">Status: ' + escapeHtml(step.status || "pending") + "\\n" + escapeHtml(step.purpose || "") + escapeHtml(details) + "</div></div>";
        }).join("");
      }

      function renderV5LabWorkflow(v5) {
        if (!v5) {
          v5Card.style.display = "none";
          currentV5Workflow = null;
          currentSelectedV5PlanId = null;
          currentV5SelectedPlan = null;
          currentV5Preview = null;
          currentV5DryRun = null;
          currentV5DiffSketch = null;
          currentV5Refinement = "";
          currentV5RefinementType = "none";
          v5PreviewCard.style.display = "none";
          v5DryRunCard.style.display = "none";
          v5DiffCard.style.display = "none";
          v5RefineCard.style.display = "none";
          return;
        }
        currentV5Workflow = v5;
        v5Card.style.display = "block";
        const statusLine = [
          "Experiment: " + (v5.experiment_label || "V5.7"),
          "Lab aktiviert: " + (v5.lab_enabled ? "ja" : "nein"),
          "Finalstatus: " + (v5.final_status || "unbekannt"),
          "Meldung: " + (v5.final_message || "-"),
          "Naechster Schritt: " + (v5.next_action || "-")
        ].join("\\n");
        v5StatusNode.textContent = statusLine;

        const alternatives = Array.isArray(v5.alternatives) ? v5.alternatives : [];
        if (alternatives.length === 0) {
          v5PlansNode.innerHTML = "<div class='muted'>Keine alternativen Plaene verfuegbar.</div>";
          return;
        }

        v5PlansNode.innerHTML = alternatives.map((plan, idx) => {
          const steps = Array.isArray(plan.steps) ? plan.steps : [];
          const stepLines = steps.map((step, i) => {
            return (i + 1) + ". " + (step.title || step.id || "Schritt") + " [" + (step.status || "pending") + "]";
          }).join("\\n");
          const filesLine = Array.isArray(plan.files) && plan.files.length > 0 ? "\\nDateien: " + plan.files.join(", ") : "";
          const isSelected = currentSelectedV5PlanId && String(plan.id) === String(currentSelectedV5PlanId);
          const selectText = isSelected ? "Ausgewaehlt" : "Diesen Plan waehlen";
          return '<div class=\"change-item ' + (isSelected ? 'plan-selected' : '') + '\"><div class=\"change-type\">Alternative ' + escapeHtml(String(idx + 1)) + ': ' + escapeHtml(plan.title || plan.id || "Plan") + '</div><div class=\"change-desc\">Strategie: ' + escapeHtml(plan.strategy || "-") + '\\nRisiko: ' + escapeHtml(plan.risk_level || "-") + filesLine + '\\n\\nSchritte:\\n' + escapeHtml(stepLines) + '</div><button class=\"plan-select-button\" data-plan-id=\"' + escapeHtml(plan.id || "") + '\" ' + (isSelected ? "disabled" : "") + '>' + escapeHtml(selectText) + '</button></div>';
        }).join("");
      }

      function renderV5Preview(preview) {
        currentV5Preview = preview || null;
        if (!preview) {
          v5PreviewCard.style.display = "none";
          v5PreviewNode.textContent = "";
          v5ApproveButton.disabled = true;
          return;
        }
        v5PreviewCard.style.display = "block";
        v5ApproveButton.disabled = false;
        const previewText = [
          "Ausgewaehlter Plan: " + (preview.plan_title || preview.plan_id || "-"),
          "Plan-ID: " + (preview.plan_id || "-"),
          "Profil: " + (preview.summary || "-"),
          "Risiko: " + (preview.risk_profile || "-"),
          "Erwartete Dateien: " + ((preview.expected_files || []).length > 0 ? preview.expected_files.join(", ") : "keine"),
          "Naechste Aktion: " + (preview.next_action || "-"),
        ].join("\n");
        v5PreviewNode.textContent = previewText;
      }

      function renderV5DryRun(dryRun) {
        currentV5DryRun = dryRun || null;
        if (!dryRun) {
          v5DryRunCard.style.display = "none";
          v5DryRunNode.textContent = "";
          v5DryRunApproveButton.disabled = true;
          return;
        }
        v5DryRunCard.style.display = "block";
        v5DryRunApproveButton.disabled = false;
        const areaLines = (dryRun.expected_areas || []).map((area, idx) => {
          return (idx + 1) + ". " + (area.area || "Bereich") + " - " + (area.note || "-");
        }).join("\n");
        const dryRunText = [
          "Simulation: " + (dryRun.simulation ? "ja" : "nein"),
          "Plan: " + (dryRun.plan_title || dryRun.plan_id || "-"),
          "Plan-ID: " + (dryRun.plan_id || "-"),
          "Profil: " + (dryRun.strategy || "-"),
          "Risiko: " + (dryRun.risk_profile || "-"),
          "Erwartete Dateien: " + ((dryRun.expected_files || []).length > 0 ? dryRun.expected_files.join(", ") : "keine"),
          "Erwartete Aenderungsart: " + ((dryRun.expected_change_types || []).length > 0 ? dryRun.expected_change_types.join(", ") : "keine"),
          "Erwartete Bereiche:\n" + (areaLines || "-"),
          "Naechste Aktion: " + (dryRun.next_action || "-"),
        ].join("\n");
        v5DryRunNode.textContent = dryRunText;
      }

      function renderV5DiffSketch(diffSketch) {
        currentV5DiffSketch = diffSketch || null;
        if (!diffSketch) {
          v5DiffCard.style.display = "none";
          v5DiffNode.textContent = "";
          v5DiffApproveButton.disabled = true;
          return;
        }
        v5DiffCard.style.display = "block";
        v5DiffApproveButton.disabled = false;
        const sketchLines = (diffSketch.sketches || []).map((entry, idx) => {
          const header = "#" + (idx + 1) + " Datei: " + (entry.file || "-");
          const area = "Bereich: " + (entry.area || "-");
          const type = "Aenderungsart: " + (entry.change_type || "-");
          const hunk = Array.isArray(entry.pseudo_hunk) ? entry.pseudo_hunk.join("\n") : "";
          return [header, area, type, hunk].join("\n");
        }).join("\n\n");

        const text = [
          "Simulation: " + (diffSketch.simulation ? "ja" : "nein"),
          "Nicht anwendbar: " + (diffSketch.non_applicable ? "ja" : "nein"),
          "Plan: " + (diffSketch.plan_title || diffSketch.plan_id || "-"),
          "Profil: " + (diffSketch.strategy || "-"),
          "Risiko: " + (diffSketch.risk_profile || "-"),
          "",
          "Pseudo-Diff-Skizzen:",
          sketchLines || "-",
          "",
          "Naechste Aktion: " + (diffSketch.next_action || "-"),
        ].join("\n");
        v5DiffNode.textContent = text;
      }

      function renderV5Refinement(refinementText, refinementType) {
        currentV5Refinement = normalizeV5Refinement(refinementText || "");
        currentV5RefinementType = normalizeV5RefinementType(refinementType || currentV5RefinementType || "none");
        if (!currentV5DiffSketch) {
          v5RefineCard.style.display = "none";
          v5RefinementType.value = "none";
          v5RefinementInput.value = "";
          v5RefinementPreview.textContent = "";
          v5RefineApproveButton.disabled = true;
          return;
        }
        v5RefineCard.style.display = "block";
        v5RefinementType.value = currentV5RefinementType;
        v5RefinementInput.value = currentV5Refinement;
        const typeLabel = getV5RefinementTypeLabel(currentV5RefinementType);
        const shortText = currentV5Refinement
          ? ("Kurzpraezisierung: " + currentV5Refinement)
          : "Kurzpraezisierung: keine (optional).";
        v5RefinementPreview.textContent = "Typ: " + typeLabel + " (" + currentV5RefinementType + ")\n" + shortText;
        v5RefineApproveButton.disabled = false;
      }

      initV5RefinementTypeSelect();
      updateModeUi();
      setStatus("Bereit.", "ok");

      modeInput.addEventListener("change", () => {
        updateModeUi();
      });

      runButton.addEventListener("click", () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
          setStatus("Bitte zuerst einen Arbeitsauftrag eingeben.", "warn");
          return;
        }
        if (modeInput.value === "agent_project" && !agentAutonomyInput.checked) {
          setStatus("Projektagent blockiert: Bitte zuerst Autonomie-Freigabe aktivieren.", "warn");
          return;
        }
        runButton.disabled = true;
        if (modeInput.value === "agent_v4") {
          setStatus("V4-Ablauf startet...", "running");
        } else if (modeInput.value === "agent_v6") {
          setStatus("V6-Produktlauf startet...", "running");
        } else if (modeInput.value === "agent_project") {
          setStatus("Projektagent startet im erlaubten Projektordner...", "running");
        } else if (modeInput.value === "agent_v5_lab") {
          setStatus("V5.7-Testlabor startet...", "running");
        } else {
          setStatus("Laeuft...", "running");
        }
        vscode.postMessage({
          type: "run",
          mode: modeInput.value,
          prompt,
          traceback: tracebackInput.value,
          agent_control: modeInput.value === "agent_project"
            ? { autonomy_approved: Boolean(agentAutonomyInput.checked) }
            : null
        });
      });

      applyChangesButton.addEventListener("click", () => {
        if (!currentStructuredData || !currentStructuredData.changes || currentStructuredData.changes.length === 0) {
          return;
        }
        vscode.postMessage({
          type: "applyChanges",
          changes: currentStructuredData.changes
        });
      });

      runTestButton.addEventListener("click", () => {
        vscode.postMessage({ type: "runTest" });
      });

      v5PlansNode.addEventListener("click", (event) => {
        const target = event.target;
        if (!target || !target.dataset || !target.dataset.planId) {
          return;
        }
        if (!currentV5Workflow || !Array.isArray(currentV5Workflow.alternatives)) {
          return;
        }
        const selectedPlan = currentV5Workflow.alternatives.find((plan) => String(plan.id || "") === String(target.dataset.planId));
        if (!selectedPlan) {
          return;
        }
        currentSelectedV5PlanId = selectedPlan.id;
        currentV5SelectedPlan = selectedPlan;
        renderV5LabWorkflow(currentV5Workflow);
        renderV5Preview(buildV5PlanPreview(selectedPlan));
        renderV5DryRun(null);
        renderV5DiffSketch(null);
        renderV5Refinement("", "none");
        setStatus("V5.7 Preview bereit. Bitte freigeben oder abbrechen.", "running");
      });

      v5ApproveButton.addEventListener("click", () => {
        if (!currentV5SelectedPlan || !currentV5Preview) {
          return;
        }
        v5ApproveButton.disabled = true;
        renderV5DryRun(buildV5DryRunImpact(currentV5SelectedPlan));
        renderV5DiffSketch(null);
        renderV5Refinement("", "none");
        setStatus("V5.7 Dry-Run bereit (Simulation). Bitte Dry-Run freigeben oder abbrechen.", "running");
      });

      v5CancelButton.addEventListener("click", () => {
        currentSelectedV5PlanId = null;
        currentV5SelectedPlan = null;
        renderV5Preview(null);
        renderV5DryRun(null);
        renderV5DiffSketch(null);
        renderV5Refinement("", "none");
        if (currentV5Workflow) {
          renderV5LabWorkflow(currentV5Workflow);
        }
        setStatus("V5.7 Preview abgebrochen. Keine Weitergabe erfolgt.", "warn");
      });

      v5DryRunApproveButton.addEventListener("click", () => {
        if (!currentV5SelectedPlan || !currentV5Preview || !currentV5DryRun) {
          return;
        }
        v5DryRunApproveButton.disabled = true;
        renderV5DiffSketch(buildV5DryRunDiffSketch(currentV5SelectedPlan));
        renderV5Refinement("", "none");
        setStatus("V5.7 Diff-Skizze bereit (Simulation). Bitte freigeben oder abbrechen.", "running");
      });

      v5DryRunCancelButton.addEventListener("click", () => {
        renderV5DryRun(null);
        renderV5DiffSketch(null);
        renderV5Refinement("", "none");
        setStatus("V5.7 Dry-Run abgebrochen. Keine Weitergabe erfolgt.", "warn");
      });

      v5DiffApproveButton.addEventListener("click", () => {
        if (!currentV5SelectedPlan || !currentV5Preview || !currentV5DryRun || !currentV5DiffSketch) {
          return;
        }
        v5DiffApproveButton.disabled = true;
        renderV5Refinement("", "none");
        setStatus("V5.7 Praezisierung bereit. Typ waehlen, optional kurz eingeben, dann freigeben oder abbrechen.", "running");
      });

      v5DiffCancelButton.addEventListener("click", () => {
        renderV5DiffSketch(null);
        renderV5Refinement("", "none");
        setStatus("V5.7 Diff-Skizze abgebrochen. Keine Weitergabe erfolgt.", "warn");
      });

      v5RefinementInput.addEventListener("input", () => {
        const normalized = normalizeV5Refinement(v5RefinementInput.value);
        if (v5RefinementInput.value !== normalized) {
          v5RefinementInput.value = normalized;
        }
        currentV5Refinement = normalized;
        renderV5Refinement(currentV5Refinement, currentV5RefinementType);
      });

      v5RefinementType.addEventListener("change", () => {
        currentV5RefinementType = normalizeV5RefinementType(v5RefinementType.value);
        renderV5Refinement(currentV5Refinement, currentV5RefinementType);
      });

      v5RefineApproveButton.addEventListener("click", () => {
        if (!currentV5SelectedPlan || !currentV5Preview || !currentV5DryRun || !currentV5DiffSketch) {
          return;
        }
        const refinement = normalizeV5Refinement(v5RefinementInput.value);
        const refinementType = normalizeV5RefinementType(v5RefinementType.value);
        currentV5Refinement = refinement;
        currentV5RefinementType = refinementType;
        runButton.disabled = true;
        v5RefineApproveButton.disabled = true;
        setStatus("V5.7: Praezisierung freigegeben. Ausgewaehlter Plan wird kontrolliert uebergeben...", "running");
        vscode.postMessage({
          type: "approveV5Refinement",
          selected_plan: currentV5SelectedPlan,
          prompt: promptInput.value,
          traceback: tracebackInput.value,
          refinement,
          refinement_type: refinementType
        });
      });

      v5RefineCancelButton.addEventListener("click", () => {
        renderV5Refinement("", "none");
        setStatus("V5.7 Praezisierung abgebrochen. Keine Weitergabe erfolgt.", "warn");
      });

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message.type === "result") {
          runButton.disabled = false;
          setStatus(message.ok ? "Antwort empfangen." : "Fehler.", message.ok ? "ok" : "error");
          contextNode.textContent = message.context;

          if (message.ok && message.structured) {
            const data = message.structured;
            currentStructuredData = data;
            summaryNode.textContent = data.summary || "Keine Zusammenfassung";
            applyChangesButton.disabled = !data.changes || data.changes.length === 0;
            runTestButton.disabled = false;

            if (data.explanation) {
              explanationNode.textContent = data.explanation;
              explanationCard.style.display = "block";
            } else {
              explanationCard.style.display = "none";
            }

            if (data.changes && data.changes.length > 0) {
              changesNode.innerHTML = data.changes.map(renderChange).join("");
              changesCard.style.display = "block";
            } else {
              changesCard.style.display = "none";
            }

            if (data.risks && data.risks.length > 0) {
              risksNode.innerHTML = data.risks.map((risk) => '<div class="risk-item">' + escapeHtml(risk) + '</div>').join("");
              risksCard.style.display = "block";
            } else {
              risksCard.style.display = "none";
            }

            if (data.test_step || data.test_result) {
              testCard.style.display = "block";
              testResultNode.innerHTML = data.test_result ? renderTestResult(data.test_result) : "";
            } else {
              testCard.style.display = "none";
            }

            rawCard.style.display = "none";
            renderV4Workflow(message.v4_workflow || null);
            if (Object.prototype.hasOwnProperty.call(message, "v6_product_flow")) {
              renderV6ProductFlow(message.v6_product_flow || null);
            } else {
              renderV6ProductFlow(null);
            }
            if (Object.prototype.hasOwnProperty.call(message, "v5_lab_workflow")) {
              renderV5LabWorkflow(message.v5_lab_workflow || null);
            }
            if (Object.prototype.hasOwnProperty.call(message, "project_agent_flow")) {
              renderProjectAgentFlow(message.project_agent_flow || null);
            } else {
              renderProjectAgentFlow(null);
            }

            if (
              modeInput.value === "agent_project"
              && message.project_agent_flow
              && message.project_agent_flow.autonomy_approved
              && message.project_agent_flow.final_status === "successful"
              && data.changes
              && data.changes.length > 0
            ) {
              setStatus("Projektagent: Wende Aenderungen kontrolliert an...", "running");
              vscode.postMessage({
                type: "applyChanges",
                changes: data.changes,
                agent_mode: "project_agent_auto",
                auto_run_test: Boolean(data.test_step)
              });
            }
          } else {
            currentStructuredData = null;
            resetStructuredSections();
            summaryNode.textContent = message.ok ? "Antwort erhalten (nicht strukturiert)" : "Fehler aufgetreten";
            rawNode.textContent = message.result;
            rawCard.style.display = "block";
            renderV4Workflow(message.v4_workflow || null);
            if (Object.prototype.hasOwnProperty.call(message, "v6_product_flow")) {
              renderV6ProductFlow(message.v6_product_flow || null);
            } else {
              renderV6ProductFlow(null);
            }
            if (Object.prototype.hasOwnProperty.call(message, "v5_lab_workflow")) {
              renderV5LabWorkflow(message.v5_lab_workflow || null);
            }
            if (Object.prototype.hasOwnProperty.call(message, "project_agent_flow")) {
              renderProjectAgentFlow(message.project_agent_flow || null);
            } else {
              renderProjectAgentFlow(null);
            }
          }
        } else if (message.type === "testResult") {
          runTestButton.disabled = false;
          testCard.style.display = "block";
          testResultNode.innerHTML = renderTestResult(message.result);
        }
      });
    </script>
  </body>
  </html>`;
}

function getSidebarHtml() {
  return getHtml(sidebarViewRef?.webview || null);
}

async function handleAssistantMessage(targetWebview, message) {
  if (message.type === "approveV5Refinement") {
    const selectedPlan = message.selected_plan || null;
    if (!selectedPlan || !selectedPlan.id) {
      targetWebview.postMessage({
        type: "result",
        ok: false,
        context: "V5.7 Praezisierung",
        result: "v5_refinement_invalid: Kein gueltiger Plan zur V5.7-Freigabe vorhanden."
      });
      return;
    }

    const refinement = sanitizeV5Refinement(String(message.refinement || ""));
    const refinementType = normalizeV5RefinementType(String(message.refinement_type || "none"));
    const refinementTypeLabel = getV5RefinementTypeLabel(refinementType);
    const editorContext = await collectEditorContext();
    const planPrompt = buildV5ExecutionPrompt(
      String(message.prompt || "").trim(),
      selectedPlan,
      refinement,
      refinementType
    );
    const payload = {
      prompt: planPrompt,
      mode: "rewrite",
      traceback_text: String(message.traceback || "").trim() || null,
      additional_files: [],
      v4_control: null,
      ...editorContext
    };
    const contextText = [
      `Datei: ${payload.current_file_path || "keine aktive Datei"}`,
      `Dateityp: ${payload.current_file_language || "unbekannt"}`,
      `Kontextquelle: ${payload.context_source || "unbekannt"}`,
      `V5.7 freigegeben: ${selectedPlan.title || selectedPlan.id}`,
      `Plan-ID: ${selectedPlan.id}`,
      `Praezisierungstyp: ${refinementTypeLabel} (${refinementType})`,
      `Praezisierung: ${refinement ? refinement.length + " Zeichen" : "keine"}`,
      `Workspace: ${payload.workspace_root || "kein Workspace"}`,
      `Markierung: ${payload.selected_text ? payload.selected_text.length + " Zeichen" : "keine"}`,
      `Traceback: ${payload.traceback_text ? payload.traceback_text.length + " Zeichen" : "keiner"}`
    ].join("\n");

    if (payload.v4_context_error) {
      targetWebview.postMessage({
        type: "result",
        ok: false,
        context: contextText,
        result: `v5_refinement_blocked: ${payload.v4_context_error}`
      });
      return;
    }

    try {
      const result = await callBackend(payload);
      targetWebview.postMessage({
        type: "result",
        ok: true,
        context: contextText,
        result: result.answer,
        structured: mergeStructuredPayload(result),
        v4_workflow: result.v4_workflow || null,
        v5_selected_plan: {
          id: selectedPlan.id,
          title: selectedPlan.title || selectedPlan.id
        }
      });
    } catch (error) {
      targetWebview.postMessage({
        type: "result",
        ok: false,
        context: contextText,
        result: String(error && error.message ? error.message : error)
      });
    }
    return;
  }
  if (message.type === "applyChanges") {
    const applyResult = await applyChangesToActiveFile(message.changes);
    if (message.auto_run_test && applyResult && applyResult.applied) {
      const testResult = await runPythonSyntaxCheck();
      targetWebview.postMessage({ type: "testResult", result: testResult });
    }
    return;
  }
  if (message.type === "runTest") {
    const testResult = await runPythonSyntaxCheck();
    targetWebview.postMessage({ type: "testResult", result: testResult });
    return;
  }
  if (message.type !== "run") {
    return;
  }

  const editorContext = await collectEditorContext();
  const payload = {
    prompt: String(message.prompt || "").trim(),
    mode: message.mode || "python_task",
    traceback_text: String(message.traceback || "").trim() || null,
    additional_files: message.additional_files || [],
    agent_control: message.agent_control || null,
    v4_control: message.mode === "agent_v4"
      ? {
          continue_after_plan: true,
          continue_after_file_selection: true,
          continue_after_change_proposal: true,
          auto_run_test_step: false
        }
      : null,
    ...editorContext
  };
  const contextText = [
    `Datei: ${payload.current_file_path || "keine aktive Datei"}`,
    `Dateityp: ${payload.current_file_language || "unbekannt"}`,
    `Kontextquelle: ${payload.context_source || "unbekannt"}`,
    `Workspace: ${payload.workspace_root || "kein Workspace"}`,
    `Markierung: ${payload.selected_text ? payload.selected_text.length + " Zeichen" : "keine"}`,
    `Zusatzdateien: ${payload.additional_files ? payload.additional_files.length + " Dateien" : "keine"}`,
    `Workspace-Dateien: ${payload.workspace_files ? payload.workspace_files.length + " Dateien" : "keine"}`,
    `Traceback: ${payload.traceback_text ? payload.traceback_text.length + " Zeichen" : "keiner"}`
  ].join("\n");

  if ((payload.mode === "agent_v4" || payload.mode === "agent_v5_lab" || payload.mode === "agent_v6" || payload.mode === "agent_project") && payload.v4_context_error) {
    targetWebview.postMessage({
      type: "result",
      ok: false,
      context: contextText,
      result: `${payload.mode === "agent_v5_lab" ? "v5" : payload.mode === "agent_v6" ? "v6" : payload.mode === "agent_project" ? "agent" : "v4"}_context_blocked: ${payload.v4_context_error}`,
      v4_workflow: null,
      v6_product_flow: null,
      project_agent_flow: null,
      v5_lab_workflow: null
    });
    return;
  }

  try {
    const result = await callBackend(payload);
    targetWebview.postMessage({
      type: "result",
      ok: true,
      context: contextText,
      result: result.answer,
      structured: mergeStructuredPayload(result),
      v4_workflow: result.v4_workflow || null,
      v6_product_flow: result.v6_product_flow || null,
      project_agent_flow: result.project_agent_flow || null,
      v5_lab_workflow: result.v5_lab_workflow || null
    });
  } catch (error) {
    targetWebview.postMessage({
      type: "result",
      ok: false,
      context: contextText,
      result: String(error && error.message ? error.message : error),
      v4_workflow: null,
      v6_product_flow: null,
      project_agent_flow: null,
      v5_lab_workflow: null
    });
  }
}

async function callBackend(payload) {
  const config = vscode.workspace.getConfiguration("codeKI");
  const serverUrl = config.get("serverUrl", "http://127.0.0.1:8787");
  let response;
  try {
    response = await fetch(`${serverUrl}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(`backend_unreachable: Backend unter ${serverUrl} ist nicht erreichbar.`);
  }
  const rawText = await response.text();
  let data = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      throw new Error("backend_invalid_response: Backend-Antwort war kein gueltiges JSON.");
    }
  }
  if (!response.ok) {
    const detail = data.detail || data;
    throw new Error(`${detail.blocker || "backend_error"}: ${detail.message || "Unbekannter Fehler"}`);
  }
  return data;
}

function mergeStructuredPayload(result) {
  if (!result.structured) {
    return null;
  }
  return {
    ...result.structured,
    test_step: result.structured.test_step || result.test_step || null,
    test_result: result.structured.test_result || result.test_result || null
  };
}

async function collectWorkspaceFiles(limit = 200) {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return [];
  }
  try {
    const files = await vscode.workspace.findFiles(
      "**/*.py",
      "**/{.venv,__pycache__,node_modules,logs,tools,dist,build}/**",
      limit
    );
    return files.map((uri) => uri.fsPath);
  } catch {
    return [];
  }
}

async function collectEditorContext() {
  const workspaceFiles = await collectWorkspaceFiles();
  const activeEditor = vscode.window.activeTextEditor;

  if (activeEditor) {
    const activeDocument = activeEditor.document;
    if (!isPythonFileDocument(activeDocument)) {
      return {
        current_file_path: null,
        current_file_text: null,
        current_file_language: activeDocument.languageId || null,
        selected_text: null,
        workspace_root: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null,
        workspace_files: workspaceFiles,
        context_source: "active_non_python",
        v4_context_error: `Aktive Datei ist keine Python-Datei: ${activeDocument.uri.fsPath}`
      };
    }
    const selection = activeEditor.selection && !activeEditor.selection.isEmpty
      ? activeDocument.getText(activeEditor.selection)
      : null;
    rememberPythonContextFromDocument(activeDocument);
    return buildContextFromDocument(activeDocument, workspaceFiles, selection, "active_python_editor");
  }

  const visiblePythonEditor = vscode.window.visibleTextEditors.find((editor) => isPythonFileDocument(editor.document));
  if (visiblePythonEditor) {
    rememberPythonContextFromDocument(visiblePythonEditor.document);
    return buildContextFromDocument(
      visiblePythonEditor.document,
      workspaceFiles,
      null,
      "visible_python_editor"
    );
  }

  if (lastPythonContext) {
    return {
      current_file_path: lastPythonContext.current_file_path,
      current_file_text: lastPythonContext.current_file_text,
      current_file_language: lastPythonContext.current_file_language || "python",
      selected_text: null,
      workspace_root: lastPythonContext.workspace_root || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null,
      workspace_files: workspaceFiles,
      context_source: "cached_python_context",
      v4_context_error: null
    };
  }

  return {
    current_file_path: null,
    current_file_text: null,
    current_file_language: null,
    selected_text: null,
    workspace_root: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null,
    workspace_files: workspaceFiles,
    context_source: "no_python_context",
    v4_context_error: "Keine aktive Python-Datei gefunden. Bitte oeffne eine Python-Datei im Editor."
  };
}

async function applyChangesToActiveFile(changes, dependencies = {}) {
  const windowApi = dependencies.windowApi || vscode.window;
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    windowApi.showErrorMessage("Keine aktive Datei vorhanden. Bitte oeffne eine Python-Datei.");
    return { applied: false, reason: "no_active_editor" };
  }

  const document = editor.document;
  const originalText = document.getText();
  const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
    || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    || null;
  if (!isPathWithinWorkspaceRoot(document.uri.fsPath, workspaceRoot)) {
    windowApi.showErrorMessage("Aenderungen blockiert: Datei liegt ausserhalb des erlaubten Projektordners.");
    return { applied: false, reason: "out_of_scope_file" };
  }

  const confirmation = await windowApi.showWarningMessage(
    `Es werden ${changes.length} Aenderung(en) auf die aktive Datei angewendet.\nDatei: ${document.uri.fsPath}\nFortfahren?`,
    { modal: true },
    APPLY_CONFIRM_LABEL
  );
  if (confirmation !== APPLY_CONFIRM_LABEL) {
    windowApi.showInformationMessage("Aenderungen wurden abgebrochen.");
    return { applied: false, reason: "cancelled" };
  }

  const plan = buildApplyPlan({
    documentPath: document.uri.fsPath,
    documentText: originalText,
    changes,
  });
  if (!plan.ok) {
    windowApi.showErrorMessage(`Aenderungen blockiert: ${plan.error}`);
    return { applied: false, reason: "plan_blocked" };
  }

  const applied = applyPlan(originalText, plan);
  if (!applied.ok) {
    windowApi.showErrorMessage(`Aenderungen blockiert: ${applied.error}`);
    return { applied: false, reason: "apply_plan_failed" };
  }
  const newText = applied.text;

  if (newText === originalText) {
    windowApi.showWarningMessage("Keine Aenderungen angewendet.");
    return { applied: false, reason: "no_effect" };
  }

  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(originalText.length));
  const didEdit = await editor.edit((editBuilder) => {
    editBuilder.replace(fullRange, newText);
  });
  if (!didEdit) {
    windowApi.showErrorMessage("Aenderungen konnten nicht in die Datei geschrieben werden.");
    return { applied: false, reason: "edit_rejected" };
  }

  windowApi.showInformationMessage("Aenderungen erfolgreich angewendet.");
  return { applied: true, reason: "applied" };
}

async function runPythonSyntaxCheck() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return { status: "blocked", message: "Keine aktive Datei vorhanden." };
  }

  const document = editor.document;
  if (document.languageId !== "python") {
    return { status: "blocked", message: "Aktive Datei ist keine Python-Datei." };
  }
  const workspaceRoot = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
    || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    || null;
  if (!isPathWithinWorkspaceRoot(document.uri.fsPath, workspaceRoot)) {
    return { status: "blocked", message: "Pruefschritt blockiert: Datei liegt ausserhalb des Projektordners." };
  }

  try {
    await document.save();
    const pythonPath = vscode.workspace.getConfiguration("python").get("defaultInterpreterPath") || "python";
    const { exec } = require("child_process");

    return await new Promise((resolve) => {
      exec(`"${pythonPath}" -m py_compile "${document.uri.fsPath}"`, (error, stdout, stderr) => {
        if (error) {
          resolve({
            status: "failed",
            message: "Syntaxfehler gefunden",
            stdout: stdout || "",
            stderr: stderr || ""
          });
          return;
        }
        resolve({
          status: "success",
          message: "Keine Syntaxfehler",
          stdout: stdout || "Python-Syntaxpruefung erfolgreich abgeschlossen.",
          stderr: stderr || ""
        });
      });
    });
  } catch (error) {
    return {
      status: "failed",
      message: "Pruefung fehlgeschlagen",
      stdout: "",
      stderr: String(error && error.message ? error.message : error)
    };
  }
}

async function runApplyFlowSelfTest() {
  const initialText = "def add(a,b):\n    return a+b\n";
  const applyChange = {
    type: "replace",
    line_start: 2,
    line_end: 2,
    old_code: "    return a+b\n",
    new_code: "    return a + b\n",
  };

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-ki-apply-selftest-"));
  const fixturePath = path.join(tempDir, "apply_flow_fixture.py");
  await fs.writeFile(fixturePath, initialText, "utf8");

  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fixturePath));
  await vscode.window.showTextDocument(document);

  const saveAndReadFixture = async () => {
    await document.save();
    return fs.readFile(fixturePath, "utf8");
  };

  const resetFixtureInEditor = async (text) => {
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const range = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
    const didReset = await editor.edit((editBuilder) => {
      editBuilder.replace(range, text);
    });
    if (!didReset) {
      throw new Error("Fixture konnte im Selftest nicht zurueckgesetzt werden.");
    }
    await document.save();
  };

  const report = {
    started_at: new Date().toISOString(),
    fixture_path: fixturePath,
    scenarios: [],
  };

  const createFakeWindow = (confirmResult) => ({
    warning: [],
    info: [],
    error: [],
    async showWarningMessage(message, ...args) {
      this.warning.push({ message, args });
      return confirmResult;
    },
    showInformationMessage(message) {
      this.info.push(message);
      return Promise.resolve(undefined);
    },
    showErrorMessage(message) {
      this.error.push(message);
      return Promise.resolve(undefined);
    },
  });

  const scenarioCancel = createFakeWindow(undefined);
  const cancelResult = await applyChangesToActiveFile([applyChange], { windowApi: scenarioCancel });
  const afterCancel = await saveAndReadFixture();
  report.scenarios.push({
    name: "confirm_cancel",
    passed: cancelResult.applied === false && afterCancel === initialText,
    file_changed: afterCancel !== initialText,
    info_messages: scenarioCancel.info,
    error_messages: scenarioCancel.error,
  });

  const scenarioApply = createFakeWindow(APPLY_CONFIRM_LABEL);
  const applyResult = await applyChangesToActiveFile([applyChange], { windowApi: scenarioApply });
  const afterApply = await saveAndReadFixture();
  const expectedApplied = "def add(a,b):\n    return a + b\n";
  report.scenarios.push({
    name: "confirm_apply",
    passed: applyResult.applied === true && afterApply === expectedApplied,
    file_changed: afterApply !== initialText,
    info_messages: scenarioApply.info,
    error_messages: scenarioApply.error,
  });

  await resetFixtureInEditor(initialText);
  const scenarioConflict = createFakeWindow(APPLY_CONFIRM_LABEL);
  const conflictResult = await applyChangesToActiveFile(
    [
      {
        ...applyChange,
        old_code: "    return does_not_exist\n",
      },
    ],
    { windowApi: scenarioConflict }
  );
  const afterConflict = await saveAndReadFixture();
  report.scenarios.push({
    name: "conflict_blocked",
    passed:
      conflictResult.applied === false &&
      afterConflict === initialText &&
      scenarioConflict.error.some((msg) => msg.includes("Aenderungen blockiert")),
    file_changed: afterConflict !== initialText,
    info_messages: scenarioConflict.info,
    error_messages: scenarioConflict.error,
  });

  report.finished_at = new Date().toISOString();
  report.success = report.scenarios.every((scenario) => scenario.passed);

  const logDir = path.resolve(__dirname, "..", "logs");
  await fs.mkdir(logDir, { recursive: true });
  const reportPath = path.join(logDir, "apply_flow_selftest_report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  if (report.success) {
    vscode.window.showInformationMessage(`Apply-Flow-Selftest erfolgreich. Report: ${reportPath}`);
  } else {
    vscode.window.showErrorMessage(`Apply-Flow-Selftest fehlgeschlagen. Report: ${reportPath}`);
  }
}

function activate(context) {
  console.log("Code KI V4 extension activated from extension.js");
  if (vscode.window.activeTextEditor && isPythonFileDocument(vscode.window.activeTextEditor.document)) {
    rememberPythonContextFromDocument(vscode.window.activeTextEditor.document);
  }

  const activeEditorTracker = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && isPythonFileDocument(editor.document)) {
      rememberPythonContextFromDocument(editor.document);
    }
  });
  const textChangeTracker = vscode.workspace.onDidChangeTextDocument((event) => {
    if (
      lastPythonContext
      && event.document
      && event.document.uri
      && event.document.uri.fsPath === lastPythonContext.current_file_path
      && isPythonFileDocument(event.document)
    ) {
      rememberPythonContextFromDocument(event.document);
    }
  });

  const sidebarProvider = vscode.window.registerWebviewViewProvider("codeKIV3.sidebarView", {
    resolveWebviewView(webviewView) {
      sidebarViewRef = webviewView;
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getSidebarHtml();
      webviewView.onDidDispose(() => {
        if (sidebarViewRef === webviewView) {
          sidebarViewRef = null;
        }
      });
      webviewView.webview.onDidReceiveMessage(async (message) => {
        await handleAssistantMessage(webviewView.webview, message);
      });
    }
  }, { webviewOptions: { retainContextWhenHidden: true } });

  const disposable = vscode.commands.registerCommand("codeKIV3.openAssistant", async () => {
    await vscode.commands.executeCommand("workbench.view.extension.codeKIV3ViewContainer");
    await vscode.commands.executeCommand("codeKIV3.sidebarView.focus");
  });

  const panelDisposable = vscode.commands.registerCommand("codeKIV3.openAssistantPanel", () => {
    if (panelRef) {
      panelRef.reveal(vscode.ViewColumn.Beside);
      return;
    }
    panelRef = vscode.window.createWebviewPanel("codeKIV3", "Code KI V6", vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    panelRef.webview.html = getHtml(panelRef.webview);
    panelRef.onDidDispose(() => {
      panelRef = null;
    });
    panelRef.webview.onDidReceiveMessage(async (message) => {
      await handleAssistantMessage(panelRef.webview, message);
    });
  });

  const selftestDisposable = vscode.commands.registerCommand("codeKIV3.runApplyFlowSelfTest", async () => {
    try {
      await runApplyFlowSelfTest();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Apply-Flow-Selftest konnte nicht ausgefuehrt werden: ${String(error && error.message ? error.message : error)}`
      );
    }
  });

  context.subscriptions.push(disposable, panelDisposable, sidebarProvider, selftestDisposable, activeEditorTracker, textChangeTracker);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  __test: {
    applyChangesToActiveFile,
    APPLY_CONFIRM_LABEL,
    runApplyFlowSelfTest,
  },
};
