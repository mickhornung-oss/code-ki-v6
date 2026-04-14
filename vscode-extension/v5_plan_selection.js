function resolveSelectedPlan(v5Workflow, planId) {
  if (!v5Workflow || !Array.isArray(v5Workflow.alternatives)) {
    return null;
  }
  const selected = v5Workflow.alternatives.find((plan) => String(plan.id || "") === String(planId || ""));
  return selected || null;
}

const MAX_V5_REFINEMENT_CHARS = 180;
const V5_REFINEMENT_TYPES = [
  { key: "none", label: "Kein fester Typ" },
  { key: "narrow_focus", label: "Fokus enger" },
  { key: "more_conservative", label: "Konservativer" },
  { key: "stricter_style", label: "Stil strenger" },
];

function sanitizeV5Refinement(refinement) {
  if (typeof refinement !== "string") {
    return "";
  }
  return refinement.replace(/\s+/g, " ").trim().slice(0, MAX_V5_REFINEMENT_CHARS);
}

function normalizeV5RefinementType(refinementType) {
  const key = String(refinementType || "").trim();
  const found = V5_REFINEMENT_TYPES.find((entry) => entry.key === key);
  return found ? found.key : "none";
}

function getV5RefinementTypeLabel(refinementType) {
  const normalized = normalizeV5RefinementType(refinementType);
  const found = V5_REFINEMENT_TYPES.find((entry) => entry.key === normalized);
  return found ? found.label : "Kein fester Typ";
}

function buildV5ExecutionPrompt(basePrompt, selectedPlan, refinementInput = "", refinementTypeInput = "none") {
  const promptText = String(basePrompt || "").trim();
  const refinement = sanitizeV5Refinement(refinementInput);
  const refinementType = normalizeV5RefinementType(refinementTypeInput);
  const refinementTypeLabel = getV5RefinementTypeLabel(refinementType);
  const strategy = String(selectedPlan?.strategy || "").trim();
  const planId = String(selectedPlan?.id || "").trim();
  const title = String(selectedPlan?.title || "").trim();
  const riskLevel = String(selectedPlan?.risk_level || "").trim();
  const steps = Array.isArray(selectedPlan?.steps) ? selectedPlan.steps : [];
  const files = Array.isArray(selectedPlan?.files) ? selectedPlan.files : [];

  const stepLines = steps.map((step, idx) => {
    const stepTitle = String(step?.title || step?.id || `Schritt ${idx + 1}`);
    const purpose = String(step?.purpose || "").trim();
    return `${idx + 1}. ${stepTitle}${purpose ? ` - ${purpose}` : ""}`;
  });

  const sections = [];
  sections.push(promptText || "Fuehre den ausgewaehlten Plan kontrolliert aus.");
  sections.push("V5.7 Planwahl+DryRun+Diff+Praezisierungstypen (experimentell): Es wurde genau ein Plan explizit ausgewaehlt und nach Dry-Run+Diff+Praezisierung freigegeben.");
  sections.push(`Ausgewaehlter Plan: ${title || planId || "unbekannt"} (${planId || "-"})`);
  if (strategy) {
    sections.push(`Strategie: ${strategy}`);
  }
  if (riskLevel) {
    sections.push(`Risikostufe: ${riskLevel}`);
  }
  if (files.length > 0) {
    sections.push(`Dateifokus: ${files.join(", ")}`);
  }
  if (stepLines.length > 0) {
    sections.push(`Plan-Schritte:\n${stepLines.join("\n")}`);
  }
  sections.push(`Fester Praezisierungstyp (V5.7): ${refinementTypeLabel} (${refinementType})`);
  if (refinement) {
    sections.push(`Kleine Nutzer-Praezisierung (V5.7, begrenzt): ${refinement}`);
  }
  sections.push("Nutze nur diesen ausgewaehlten Plan. Fuehre keine Alternativplaene aus.");
  sections.push("Bleibe bei kleinen, sicheren Aenderungen und bestehender Apply-/Prueflogik.");

  return sections.join("\n\n");
}

function buildV5PlanPreview(selectedPlan) {
  if (!selectedPlan || !selectedPlan.id) {
    return null;
  }
  const planId = String(selectedPlan.id || "").trim();
  const planTitle = String(selectedPlan.title || planId || "Unbekannter Plan").trim();
  const strategy = String(selectedPlan.strategy || "").trim();
  const riskLevel = String(selectedPlan.risk_level || "").trim() || "unknown";
  const files = Array.isArray(selectedPlan.files) ? selectedPlan.files.map((f) => String(f || "").trim()).filter(Boolean) : [];

  return {
    plan_id: planId,
    plan_title: planTitle,
    summary: strategy || "Kein Profil angegeben.",
    expected_files: files,
    risk_profile: riskLevel,
    next_action: "Preview freigeben, um den gewaehlten Plan kontrolliert weiterzuverwenden.",
  };
}

function buildV5DryRunImpact(selectedPlan) {
  if (!selectedPlan || !selectedPlan.id) {
    return null;
  }
  const planId = String(selectedPlan.id || "").trim();
  const planTitle = String(selectedPlan.title || planId || "Unbekannter Plan").trim();
  const strategy = String(selectedPlan.strategy || "").trim();
  const riskLevel = String(selectedPlan.risk_level || "").trim() || "unknown";
  const files = Array.isArray(selectedPlan.files) ? selectedPlan.files.map((f) => String(f || "").trim()).filter(Boolean) : [];
  const steps = Array.isArray(selectedPlan.steps) ? selectedPlan.steps : [];

  const expected_areas = steps.map((step, idx) => {
    const stepTitle = String(step?.title || step?.id || `Schritt ${idx + 1}`).trim();
    const purpose = String(step?.purpose || "").trim();
    return {
      area: stepTitle,
      note: purpose || "Keine Detailbeschreibung vorhanden.",
    };
  });

  let expected_change_types = ["replace"];
  if (planId.includes("conservative")) {
    expected_change_types = ["replace", "small_refactor"];
  } else if (planId.includes("bolder")) {
    expected_change_types = ["replace", "refactor"];
  }

  return {
    simulation: true,
    plan_id: planId,
    plan_title: planTitle,
    expected_files: files,
    expected_areas,
    expected_change_types,
    risk_profile: riskLevel,
    strategy: strategy || "Kein Profil angegeben.",
    next_action: "Dry-Run freigeben, um erst danach die echte Vorschlagsanforderung auszufuehren.",
  };
}

function buildV5DryRunDiffSketch(selectedPlan) {
  if (!selectedPlan || !selectedPlan.id) {
    return null;
  }
  const planId = String(selectedPlan.id || "").trim();
  const planTitle = String(selectedPlan.title || planId || "Unbekannter Plan").trim();
  const strategy = String(selectedPlan.strategy || "").trim();
  const riskLevel = String(selectedPlan.risk_level || "").trim() || "unknown";
  const files = Array.isArray(selectedPlan.files) ? selectedPlan.files.map((f) => String(f || "").trim()).filter(Boolean) : [];
  const steps = Array.isArray(selectedPlan.steps) ? selectedPlan.steps : [];

  const sketches = files.map((filePath, idx) => {
    const step = steps[idx] || steps[0] || {};
    const area = String(step.title || step.id || "Unbekannter Bereich").trim();
    const changeType = planId.includes("bolder") ? "refactor" : "replace";
    const pseudoHunk = [
      `@@ SIMULATION ${idx + 1}: ${area} @@`,
      `- [ALT] Platzhalter fuer bisherigen Code in ${filePath}`,
      `+ [NEU] Geplanter ${changeType}-Ansatz (${planTitle})`,
    ];
    return {
      file: filePath,
      area,
      change_type: changeType,
      pseudo_hunk: pseudoHunk,
    };
  });

  return {
    simulation: true,
    non_applicable: true,
    plan_id: planId,
    plan_title: planTitle,
    strategy: strategy || "Kein Profil angegeben.",
    risk_profile: riskLevel,
    sketches,
    next_action: "Diff-Skizze freigeben, um erst danach die echte Vorschlagsanforderung auszufuehren.",
  };
}

module.exports = {
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
};
