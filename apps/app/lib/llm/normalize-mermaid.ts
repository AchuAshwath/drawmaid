const MERMAID_FENCE_START = "```mermaid";
const MERMAID_FENCE_END = "```";

const DIAGRAM_KEYWORDS: Record<string, string[]> = {
  flowchart: ["flowchart", "graph"],
  sequenceDiagram: ["sequencediagram"],
  classDiagram: ["classdiagram"],
};

function getAllKeywords(): string[] {
  return Object.values(DIAGRAM_KEYWORDS).flat();
}

function isValidMermaidStart(
  line: string,
  diagramType: string | null,
): boolean {
  const lower = line.toLowerCase().trim();
  if (diagramType && DIAGRAM_KEYWORDS[diagramType]) {
    return DIAGRAM_KEYWORDS[diagramType].some((kw) => lower.startsWith(kw));
  }
  return getAllKeywords().some((kw) => lower.startsWith(kw));
}

function extractFencedMermaid(raw: string): string | null {
  const trimmed = raw.trim();

  const mermaidFenceMatch = trimmed.match(/```mermaid\n?([\s\S]*?)\n?```/i);
  if (mermaidFenceMatch) {
    return mermaidFenceMatch[1].trim();
  }

  const genericFenceMatch = trimmed.match(/```(\w*)\n?([\s\S]*?)\n?```/);
  if (genericFenceMatch) {
    const content = genericFenceMatch[2].trim();
    const firstLine = content.split("\n")[0];
    if (isValidMermaidStart(firstLine, null)) {
      return content;
    }
  }

  return null;
}

function extractByKeywordFallback(
  raw: string,
  diagramType: string | null,
): string | null {
  const lines = raw.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const lineLower = line.toLowerCase();

    let foundKeyword = false;
    if (diagramType && DIAGRAM_KEYWORDS[diagramType]) {
      foundKeyword = DIAGRAM_KEYWORDS[diagramType].some((kw) =>
        lineLower.startsWith(kw),
      );
    } else {
      foundKeyword = getAllKeywords().some((kw) => lineLower.startsWith(kw));
    }

    if (foundKeyword) {
      const contentLines = lines.slice(i);
      let extracted = contentLines.join("\n").trim();

      const fenceIdx = extracted.indexOf("```");
      if (fenceIdx !== -1) {
        extracted = extracted.substring(0, fenceIdx).trim();
      }

      if (extracted.length >= 10 && /[a-zA-Z]/.test(extracted)) {
        return extracted;
      }
    }
  }

  return null;
}

const FENCE_START_GENERIC = /^```[\w]*\n?/;

export function stripMermaidFences(raw: string): string {
  let code = raw.trim();

  if (code.startsWith(MERMAID_FENCE_START)) {
    code = code.slice(MERMAID_FENCE_START.length);
    if (code.startsWith("\n")) code = code.slice(1);
    code = code.trim();
  } else if (FENCE_START_GENERIC.test(code)) {
    code = code.replace(FENCE_START_GENERIC, "").trim();
  }

  if (code.endsWith(MERMAID_FENCE_END)) {
    code = code.slice(0, -MERMAID_FENCE_END.length).trim();
  }

  return code;
}

export function normalizeMermaid(
  raw: string,
  diagramType: string | null = null,
): string | null {
  if (!raw || !raw.trim()) return null;

  let extracted: string | null = null;

  extracted = extractFencedMermaid(raw);
  if (extracted) {
    const firstLine = extracted.split("\n")[0];
    if (isValidMermaidStart(firstLine, diagramType)) {
      return extracted;
    }
  }

  extracted = extractByKeywordFallback(raw, diagramType);
  if (extracted) {
    const firstLine = extracted.split("\n")[0];
    if (isValidMermaidStart(firstLine, diagramType)) {
      return extracted;
    }
  }

  const trimmed = raw.trim();
  if (!/[a-zA-Z]/.test(trimmed)) return null;
  if (trimmed.length < 10) return null;

  const firstLine = trimmed.split("\n")[0];
  if (isValidMermaidStart(firstLine, diagramType)) {
    return trimmed;
  }

  return null;
}
