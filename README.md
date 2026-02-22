# Drawmaid

Voice and text to Excalidraw diagrams using local AI. Generate beautiful diagrams from natural language — entirely in your browser or connect to your own AI server.

## Features

- **Voice-to-Diagram** — Speak your diagram ideas and watch them appear
- **Text-to-Diagram** — Type natural language and get instant Mermaid diagrams
- **On-Device AI** — WebLLM runs entirely in your browser, no server needed
- **Local Server Support** — Connect to OpenCode, Ollama, LM Studio, or any OpenAI-compatible API
- **Works Offline** — Once downloaded, WebLLM works without internet
- **Excalidraw Integration** — Full Excalidraw editing capabilities after generation

## Quick Start

### Option 1: WebLLM (No Setup Required)

1. Visit [https://app.drawmaid.ashwath.space/](https://app.drawmaid.ashwath.space/)
2. Download a WebLLM model (recommended: Qwen2.5-Coder-1.5B)
3. Start generating diagrams!

### Option 2: Local Server (More Powerful)

1. Install [OpenCode](https://opencode.ai)
2. Run `opencode serve` in your terminal
3. In Drawmaid, go to AI Configuration → Local Server → Connect

## Installation (Development)

```bash
# Clone the repository
git clone https://github.com/AchuAshwath/drawmaid.git
cd drawmaid

# Install dependencies
bun install

# Start development server
bun dev
```

The app will be available at `http://localhost:5173`

## AI Configuration

### WebLLM (Browser-based)

WebLLM runs AI models directly in your browser using WebGPU. No data leaves your device.

- **Pros**: Privacy-friendly, works offline, no server setup
- **Cons**: Requires WebGPU-capable browser, model downloads to device

Recommended models:

- `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` — Best for diagrams

### Local Server Options

| Provider  | Description                                  | Default URL                 |
| --------- | -------------------------------------------- | --------------------------- |
| OpenCode  | Full-featured local AI server                | `http://127.0.0.1:4096`     |
| Ollama    | Run Llama, Mistral, and other models locally | `http://localhost:11434/v1` |
| LM Studio | Desktop app for running LLMs                 | `http://localhost:1234/v1`  |
| vLLM      | High-performance LLM serving                 | `http://localhost:8000/v1`  |

## Tech Stack

- **Frontend**: React 19, TanStack Router, Vite, Tailwind CSS
- **AI**: WebLLM (on-device), OpenAI-compatible APIs
- **Diagrams**: Excalidraw, Mermaid
- **Testing**: Vitest, Playwright

## License

[AGPL-3.0](./LICENSE) — See the LICENSE file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

Built with ❤️ using WebLLM and Excalidraw
