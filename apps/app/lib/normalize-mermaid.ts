const MERMAID_FENCE_START = "```mermaid";
const FENCE_START_GENERIC = /^```[\w]*\n?/;
const MERMAID_FENCE_END = "```";

/**
 * Strips markdown code fences from Mermaid output (e.g. from LLM responses).
 * Removes leading ```mermaid (or ``` with optional lang) and trailing ```
 * so the result is plain Mermaid code. Does not strip ``` that appear in the
 * middle of content (LLM output is expected to be a single fenced block).
 */
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
