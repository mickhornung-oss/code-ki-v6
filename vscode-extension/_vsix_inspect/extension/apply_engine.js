const path = require("path");

function normalizeNewlines(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeFsPath(value) {
  if (!value) {
    return "";
  }
  return path.normalize(String(value)).toLowerCase();
}

function computeLineStartOffsets(text) {
  const offsets = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function getChangeOldText(change) {
  return typeof change.old_code === "string"
    ? change.old_code
    : (typeof change.old_text === "string" ? change.old_text : "");
}

function getChangeNewText(change) {
  if (typeof change.new_code === "string") {
    return change.new_code;
  }
  if (typeof change.new_text === "string") {
    return change.new_text;
  }
  return "";
}

function getLineText(text, starts, lineNumber) {
  const startOffset = starts[lineNumber - 1];
  const endOffset = lineNumber < starts.length ? starts[lineNumber] : text.length;
  return text.slice(startOffset, endOffset);
}

function buildApplyPlan({ documentPath, documentText, changes }) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return { ok: false, error: "Keine Aenderungen zum Anwenden vorhanden." };
  }

  const normalizedDocPath = normalizeFsPath(documentPath);
  const text = String(documentText || "");
  const starts = computeLineStartOffsets(text);
  const lineCount = starts.length;
  const operations = [];

  for (let i = 0; i < changes.length; i += 1) {
    const change = changes[i] || {};
    const changeRef = `Aenderung ${i + 1}`;
    const filePath = normalizeFsPath(change.file_path);

    if (filePath && filePath !== normalizedDocPath) {
      return {
        ok: false,
        error: `${changeRef}: Dateipfad passt nicht zur aktiven Datei (${change.file_path}).`,
      };
    }

    const type = String(change.type || "").trim().toLowerCase();
    if (!["replace", "insert", "delete"].includes(type)) {
      return { ok: false, error: `${changeRef}: Unbekannter Aenderungstyp '${type || "leer"}'.` };
    }

    const lineStart = Number(change.line_start);
    const lineEnd = change.line_end == null ? null : Number(change.line_end);
    if (!Number.isInteger(lineStart) || lineStart < 1 || lineStart > lineCount) {
      return { ok: false, error: `${changeRef}: Ungueltige line_start (${change.line_start}).` };
    }

    const oldText = getChangeOldText(change);
    const newText = getChangeNewText(change);

    if (type === "insert") {
      if (!newText) {
        return { ok: false, error: `${changeRef}: Insert ohne new_code/new_text ist nicht anwendbar.` };
      }

      const insertOffset = lineStart < lineCount ? starts[lineStart] : text.length;
      if (oldText) {
        const anchorText = getLineText(text, starts, lineStart);
        const anchorNorm = normalizeNewlines(anchorText);
        const oldNorm = normalizeNewlines(oldText);
        if (!anchorNorm.includes(oldNorm)) {
          return {
            ok: false,
            error: `${changeRef}: Insert-Anchor passt nicht zur Zielzeile ${lineStart}.`,
          };
        }
      }

      operations.push({
        type,
        index: i,
        startOffset: insertOffset,
        endOffset: insertOffset,
        replacement: newText,
      });
      continue;
    }

    const effectiveLineEnd = Number.isInteger(lineEnd) ? lineEnd : lineStart;
    if (effectiveLineEnd < lineStart || effectiveLineEnd > lineCount) {
      return {
        ok: false,
        error: `${changeRef}: Ungueltige line_end (${change.line_end}) fuer line_start ${lineStart}.`,
      };
    }

    const startOffset = starts[lineStart - 1];
    const endOffset = effectiveLineEnd < lineCount ? starts[effectiveLineEnd] : text.length;
    const rangeText = text.slice(startOffset, endOffset);

    if (oldText) {
      const rangeNorm = normalizeNewlines(rangeText);
      const oldNorm = normalizeNewlines(oldText);
      if (!rangeNorm.includes(oldNorm)) {
        return {
          ok: false,
          error: `${changeRef}: old_code/old_text passt nicht zum Zielbereich ${lineStart}-${effectiveLineEnd}.`,
        };
      }
    }

    operations.push({
      type,
      index: i,
      startOffset,
      endOffset,
      replacement: type === "delete" ? "" : newText,
    });
  }

  const ranged = operations.filter((op) => op.startOffset !== op.endOffset).sort((a, b) => a.startOffset - b.startOffset);
  for (let i = 1; i < ranged.length; i += 1) {
    const prev = ranged[i - 1];
    const curr = ranged[i];
    if (curr.startOffset < prev.endOffset) {
      return {
        ok: false,
        error: `Aenderungen ${prev.index + 1} und ${curr.index + 1} ueberlappen sich und wurden blockiert.`,
      };
    }
  }

  for (const insertOp of operations.filter((op) => op.startOffset === op.endOffset)) {
    for (const rangeOp of ranged) {
      const insideRange = insertOp.startOffset > rangeOp.startOffset && insertOp.startOffset < rangeOp.endOffset;
      if (insideRange) {
        return {
          ok: false,
          error: `Insert ${insertOp.index + 1} liegt innerhalb einer Ersetzungs-/Loesch-Range und wurde blockiert.`,
        };
      }
    }
  }

  return {
    ok: true,
    operations: operations.sort((a, b) => b.startOffset - a.startOffset || b.index - a.index),
  };
}

function applyPlan(documentText, plan) {
  if (!plan || !plan.ok || !Array.isArray(plan.operations)) {
    return { ok: false, error: "Interner Fehler: ungueltiger Apply-Plan." };
  }

  let text = String(documentText || "");
  for (const op of plan.operations) {
    text = text.slice(0, op.startOffset) + op.replacement + text.slice(op.endOffset);
  }
  return { ok: true, text };
}

module.exports = {
  buildApplyPlan,
  applyPlan,
  normalizeFsPath,
};
