CRITICAL: Fix the mermaid syntax error below.

ORIGINAL REQUEST: "{{originalInput}}"

FAILED CODE:

```
{{failedCode}}
```

PARSE ERROR: {{errorMessage}}

{{specificFix}}

STRICT RULES - MUST FOLLOW:

1. NO indentation - every line starts at column 0 (no spaces/tabs at start)
2. If using |label| on arrow, target MUST be on SAME line
3. Every --> arrow must point to something on the same line
4. Each statement is ONE line only

CORRECT EXAMPLE:
flowchart TD
A[Start] --> B{Decision}
B -->|Yes| C[Process]
B -->|No| D[End]

INCORRECT (will fail):
flowchart TD
A[Start] <-- has spaces
B -->|Label| <-- missing target
C[End] <-- indented

SYNTAX: {{nodeSyntax}} | {{edgeSyntax}}

Rewrite the FAILED CODE above with NO indentation and complete all arrows:
{{firstLine}}
