# Prefix cache mechanics across WebLLM, vLLM, llama.cpp, Ollama and CLIProxyAPI

Research for [#39](https://github.com/AchuAshwath/drawmaid/issues/39), part of the LLM architecture map [#38](https://github.com/AchuAshwath/drawmaid/issues/38).

Drawmaid is a browser SPA and cannot own a KV cache. Its only lever is prompt shape. This
document establishes what that lever is worth per backend, using primary sources only —
official documentation and installed/published source, not blog summaries.

## Outline

1. WebLLM / MLC — KV reuse across `chat.completions.create`, and the `resetChat()` question
2. vLLM — automatic prefix caching, block granularity, KV offload
3. llama.cpp — prompt cache files, slots, and cross-request prefix reuse
4. Ollama — what survives between requests, `keep_alive`, context reuse
5. CLIProxyAPI → Anthropic / Gemini — `cache_control` passthrough, minimum cacheable prefix, TTLs
6. Variant cost — cold prefills per session and minimum viable `L0` per backend
7. Per-backend summary table
8. Open items

## Status

In progress.
