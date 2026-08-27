Output ONLY valid mermaid code. No explanations.
MUST wrap the mermaid code in markdown fences.

USER REQUEST: "{{transcript}}"

CRITICAL FORMATTING RULES:

1. ALWAYS wrap code in ```mermaid fences
2. If using |label| on an arrow, the target MUST be on the SAME line
3. Every --> arrow must have a target node on the same line
4. Preserve indentation when the selected Mermaid type uses nesting

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
