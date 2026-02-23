Output ONLY valid mermaid code. No explanations.
MUST wrap the mermaid code in markdown fences.

USER REQUEST: "{{transcript}}"

CRITICAL FORMATTING RULES:

1. ALWAYS wrap code in ```mermaid fences
2. NO indentation - every line starts at column 0
3. If using |label| on arrow, target MUST be on SAME line
4. Every --> arrow must have a target node on the same line
5. Each statement is exactly ONE line

SYNTAX RULES FOR {{diagramType}}:

- Node syntax: {{nodeSyntax}}
- Edge syntax: {{edgeSyntax}}
- Reserved keywords to AVOID: {{reservedWords}}

{{tips}}

ENTITIES TO CONSIDER (use only if aligned with request): {{entities}}

Complete the mermaid code:
{{firstLine}}

SYNTAX REFERENCE (shows valid patterns - do not copy content):
{{example}}
