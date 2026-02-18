# AI Config Specification

## Overview

Add configurable AI backends to Drawmaid, allowing users to choose between WebLLM (default), local LLM servers, and eventually cloud BYOK providers.

## Goals

1. **Default**: WebLLM with model selection
2. **Local Server**: Ollama, LM Studio, vLLM, or any OpenAI-compatible endpoint
3. **Encrypted Credentials**: Secure localStorage storage
4. **Test Before Save**: Validate connection with a simple diagram generation

---

## Architecture

### Provider Types

| Type     | Implementation              | Client-side works?               |
| -------- | --------------------------- | -------------------------------- |
| `webllm` | `@mlc-ai/web-llm` (default) | ✅ Yes                           |
| `local`  | OpenAI-compatible HTTP      | ✅ Yes (with CORS)               |
| `byok`   | OpenAI/Anthropic/Google     | ❌ Needs backend proxy (Phase 2) |

### Data Flow

```
User selects provider
       ↓
Configure credentials (URL, API key, model)
       ↓
Test connection (generate simple diagram)
       ↓
Save encrypted to localStorage
       ↓
Use provider for generation
```

---

## UI Components

### 1. AI Config Popup (Modal)

**Location**:

- Welcome Screen (new menu item)
- Hamburger Menu (new menu item, like theme toggle)

**Appearance**: Slide-up modal (like PromptFooter)

**Structure**:

```
┌─────────────────────────────────────┐
│  AI Configuration              ✕   │
├─────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐           │
│  │WebLLM│ │Local│ │BYOK │  (tabs)   │
│  └─────┘ └─────┘ └─────┘           │
├─────────────────────────────────────┤
│                                     │
│  [Provider-specific form]           │
│                                     │
│  WebLLM:                            │
│  ┌─────────────────────────────┐   │
│  │ Model: [Dropdown ▼]          │   │
│  │ Qwen2.5-Coder-1.5B (756 MB)  │   │
│  │ Llama-3.2-1B (880 MB)        │   │
│  └─────────────────────────────┘   │
│                                     │
│  Local Server:                      │
│  ┌─────────────────────────────┐   │
│  │ Server URL: [input]         │   │
│  │ http://localhost:11434/v1   │   │
│  ├─────────────────────────────┤   │
│  │ API Key: [optional input]   │   │
│  ├─────────────────────────────┤   │
│  │ Model: [input]               │   │
│  │ e.g., qwen2.5-coder-1.5b      │   │
│  └─────────────────────────────┘   │
│                                     │
│  BYOK: (Phase 2 - disabled)        │
│  ┌─────────────────────────────┐   │
│  │ Provider: [OpenAI/Anthropic] │   │
│  │ API Key: [input]            │   │
│  │ Model: [dropdown]           │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  [  Test Connection  ]  [ Save ]    │
│                                     │
│  Status: Ready / Testing...         │
└─────────────────────────────────────┘
```

### 2. Provider State Display

Show current provider in header area:

- WebLLM: "WebLLM: Qwen2.5-Coder-1.5B"
- Local: "Local: localhost:11434"
- Not configured: "Configure AI"

---

## Data Structures

### Config Schema

```typescript
type ProviderType = "webllm" | "local" | "byok";

interface WebLLMConfig {
  type: "webllm";
  modelId: string;
}

interface LocalServerConfig {
  type: "local";
  url: string; // e.g., "http://localhost:11434/v1"
  apiKey?: string; // optional
  model: string; // e.g., "qwen2.5-coder-1.5b"
}

interface BYOKConfig {
  type: "byok";
  provider: "openai" | "anthropic" | "google";
  apiKey: string;
  model: string;
}

type AIConfig = WebLLMConfig | LocalServerConfig | BYOKConfig;
```

### Storage

```typescript
interface StoredConfig {
  config: AIConfig;
  encryptedKey: string; // encryption key (encrypted with device key)
  iv: string; // initialization vector
}

// Stored in localStorage key: "drawmaid-ai-config"
```

---

## Encryption

Use **Web Crypto API** (SubtleCrypto):

1. **Key Derivation**: `PBKDF2` with random salt → device-specific key
2. **Encryption**: `AES-GCM` for API keys
3. **Storage**: Encrypted blob + IV in localStorage

```typescript
// Pseudocode
async function encrypt(
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { ciphertext: btoa(ciphertext), iv: btoa(iv) };
}
```

---

## Implementation Details

### 1. Model List for WebLLM

Available via `webllm.prebuiltAppConfig.model_list`:

```typescript
import { prebuiltAppConfig } from "@mlc-ai/web-llm";

const models = prebuiltAppConfig.model_list.map((m) => ({
  id: m.model_id,
  name: m.model_id,
  vramMB: m.model_size, // approximate
  lowResource: m.low_resource_flag ?? false,
  contextWindow: m.context_window_size ?? 4096,
}));
```

**Recommended for diagram generation**:

- `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` (default, ~1GB)
- `Llama-3.2-1B-Instruct-q4f16_1-MLC` (low-end devices)
- `Llama-3.2-3B-Instruct-q4f16_1-MLC` (better quality)

### 2. Local Server Detection

Check if server is reachable:

```typescript
async function testLocalServer(url: string, apiKey?: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

### 3. Test Connection

Generate a simple diagram:

```typescript
async function testConnection(config: AIConfig): Promise<"success" | "error"> {
  try {
    const result = await generateSimpleDiagram(config);
    // "success" if valid Mermaid output
    return "success";
  } catch {
    return "error";
  }
}
```

**Test prompt**: "A simple flow: A → B → C"

---

## File Structure

```
apps/app/
├── lib/
│   ├── ai-config/
│   │   ├── types.ts           # Config types
│   │   ├── encryption.ts      # Web Crypto helpers
│   │   ├── storage.ts         # localStorage wrapper
│   │   ├── providers/
│   │   │   ├── webllm.ts      # WebLLM implementation
│   │   │   ├── local.ts       # Local server implementation
│   │   │   └── byok.ts        # BYOK implementation (Phase 2)
│   │   ├── use-ai-config.ts   # Hook for config state
│   │   ├── test-connection.ts  # Test logic
│   │   └── webgpu-check.ts    # WebGPU availability check
│   └── mermaid-llm.ts         # Refactor to use ai-config
├── components/
│   ├── ai-config-popup.tsx    # Main modal component
│   ├── ai-status.tsx          # Header status indicator
│   └── webgpu-banner.tsx      # Welcome screen WebGPU status
└── routes/
    └── index.tsx              # Add to menu, welcome screen, banner
```

---

## Migration Path

### Phase 1 (This PR)

- [ ] Create AI config types
- [ ] Implement encryption utilities
- [ ] Implement storage with encryption + multi-tab sync
- [ ] Create WebGPU banner for Welcome Screen
- [ ] Create AI config popup UI
- [ ] Add WebLLM model selection (lazy load)
- [ ] Add Local Server configuration
- [ ] Implement test connection (simple diagram)
- [ ] Add reset to defaults option
- [ ] Add specific error messages
- [ ] Integrate into index route (menu + welcome)
- [ ] Refactor mermaid-llm.ts to use ai-config

### Phase 2 (Future)

- [ ] Add BYOK providers (needs backend proxy)
- [ ] Add usage tracking hooks
- [ ] Model caching/prefetching UI

---

## Acceptance Criteria

1. ✅ User can select WebLLM model from dropdown
2. ✅ User can configure local server (URL, optional key, model)
3. ✅ Test connection generates a simple diagram
4. ✅ Credentials are encrypted in localStorage
5. ✅ Config popup accessible from Welcome Screen
6. ✅ Config popup accessible from Hamburger Menu
7. ✅ Current provider shown in UI
8. ✅ Works offline with WebLLM
9. ✅ Graceful fallback if local server unavailable
10. ✅ WebGPU check shown in Welcome Screen with link to enable
11. ✅ If WebGPU unavailable, guide user to Configure AI
12. ✅ Model switching works lazily (load on next use)
13. ✅ Multi-tab sync when config changes
14. ✅ Reset to defaults option available
15. ✅ Specific error messages for each failure scenario

---

## WebGPU Compatibility Check

Show in Welcome Screen:

```
┌─────────────────────────────────────────┐
│  🧠 WebGPU: Available ✓                 │
│     or                                  │
│  ⚠️ WebGPU: Not available               │
│     [Learn how to enable] → (link)      │
│                                         │
│  Don't want to set up WebGPU?           │
│  [Configure AI] → (opens AI Config)     │
└─────────────────────────────────────────┘
```

**Check logic**:

```typescript
function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
```

**"Learn how to enable"** → Link to WebGPU setup docs (e.g., web.dev/articles/webgpu)

**"Configure AI"** → Opens AI Config popup to set up Local Server or BYOK

---

## Model Switching Behavior

- When user selects different WebLLM model, save config immediately
- **Lazy reload**: Only download/load when user clicks Generate
- Show loading progress for new model downloads
- Previous model stays cached until user switches again
- Old model weights cleared on browser cache eviction (automatic)

---

## Multi-Tab Sync

Listen to `storage` event for cross-tab config sync:

```typescript
window.addEventListener("storage", (event) => {
  if (event.key === "drawmaid-ai-config") {
    // Reload config from localStorage
    // Notify user of change if needed
  }
});
```

---

## Reset Option

In AI Config popup footer:

```
[Reset to Defaults] [Save]
```

**Resets to**:

- Provider: `webllm`
- Model: `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC`

---

## Validation Rules

| Field              | Rule                                    |
| ------------------ | --------------------------------------- |
| Local Server URL   | Must start with `http://` or `https://` |
| Local Server Model | Required, non-empty                     |
| API Key            | Optional                                |
| WebLLM Model       | Required (dropdown)                     |

Show inline validation errors before enabling "Test" button.

---

## Error Messages

| Scenario                  | Message                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| WebGPU unavailable        | "WebGPU is not available in your browser. Configure a local server or use BYOK in AI Settings." |
| Local server CORS blocked | "Cannot connect to local server. Try disabling CORS or use a different server."                 |
| Local server unreachable  | "Cannot reach local server. Check that the server is running."                                  |
| Invalid API key           | "Invalid API key. Please check your credentials."                                               |
| Local server 401/403      | "Authentication failed. Check your API key."                                                    |
| WebLLM load failure       | "Failed to load model. Try a smaller model or check WebGPU."                                    |

---

## Responsive Design

- Desktop: Centered modal, max-width 480px
- Tablet: Full-width with padding
- Mobile: Bottom sheet or full-screen modal

Touch-friendly: 44px minimum tap targets

---

## Notes

- **CORS**: Local servers may need CORS disabled or a browser extension
- **WebGPU**: Required for WebLLM - show warning if unsupported
- **No backend needed**: Phase 1 works entirely client-side
- **Encryption key**: Derived from browser fingerprint (not perfect security, but better than plaintext)
- **No generation timeout config**: Use system defaults
