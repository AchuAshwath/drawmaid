const MERMAID_FENCE_START = "```mermaid";
const FENCE_START_GENERIC = /^```[\w]*\n?/;
const MERMAID_FENCE_END = "```";

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

export function normalizeMermaid(code: string): string | null {
  const normalized = stripMermaidFences(code);

  const trimmed = normalized.trim();
  if (!trimmed) return null;
  if (!/\w/.test(trimmed)) return null;
  if (trimmed.length < 10) return null;

  return trimmed;
}
