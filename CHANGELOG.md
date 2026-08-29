# Changelog

## [0.2.0](https://github.com/AchuAshwath/drawmaid/compare/drawmaid-v0.1.3...drawmaid-v0.2.0) (2026-08-29)


### Major features

* **canvas:** insert multiple generated diagrams atomically ([#74](https://github.com/AchuAshwath/drawmaid/issues/74)) ([e51d059](https://github.com/AchuAshwath/drawmaid/commit/e51d0592169366357281911448b6560f2f864f7a))
* **llm:** add configurable diagram effort levels ([#61](https://github.com/AchuAshwath/drawmaid/issues/61)) ([b5a26aa](https://github.com/AchuAshwath/drawmaid/commit/b5a26aa776b620f861f439b39573e2e3a54ddc3f))
* **llm:** complete High-effort plan-render generation ([2968dab](https://github.com/AchuAshwath/drawmaid/commit/2968dab3e37e3c05ea0a452848b181e640f67bfd))
* **mermaid:** add type-specific guidance and ER semantics ([a58c5e9](https://github.com/AchuAshwath/drawmaid/commit/a58c5e95ec7cccca861557c51d438630a68c4aa0))


### Improvements

* **auto-mode:** enforce task identity through canvas insertion ([9938b9e](https://github.com/AchuAshwath/drawmaid/commit/9938b9e6e6eb01e9999d299c98343bfe54d00eb1))

## [0.1.3](https://github.com/AchuAshwath/drawmaid/compare/drawmaid-v0.1.2...drawmaid-v0.1.3) (2026-08-28)


### Documentation

* **release:** document diagram support and release conventions ([#69](https://github.com/AchuAshwath/drawmaid/issues/69)) ([5a2f13a](https://github.com/AchuAshwath/drawmaid/commit/5a2f13a27f47c7eb524a4bc3bc0d62bd92c0c0d2))

## [0.1.2](https://github.com/AchuAshwath/drawmaid/compare/drawmaid-v0.1.1...drawmaid-v0.1.2) (2026-08-28)

### Major features

* **Mermaid diagrams:** add support for eleven diagram types: editable flowchart, sequence, class, ER, and state diagrams, plus explicitly requested image-only Gantt, pie, mindmap, git graph, journey, and timeline diagrams.

### Improvements

* **output handling:** recognize complete Mermaid and generic code fences as well as unwrapped output, preserve multi-document order, and distinguish refusals, malformed output, unknown declarations, mismatches, and unrequested images.
* **canvas safety:** validate converter capabilities before mutating the canvas so editable requests cannot silently become flat images.
* **auto mode:** add a check-mark checkpoint that clears the current prompt and voice transcript, resets replacement state, and starts the next diagram beside the previous one.
* **voice input:** preserve the transcript when the microphone is paused and resumed, while keeping Normal mode behavior unchanged.

### Architecture and reliability

* **diagram policy:** replace duplicated type maps and legacy normalizers with one authoritative typed registry shared by generation, recovery, and canvas insertion.
* **verification:** add interface-level behavior tests and real-browser converter conformance coverage using installed system Google Chrome.

## [0.1.1](https://github.com/AchuAshwath/drawmaid/compare/drawmaid-v0.1.0...drawmaid-v0.1.1) (2026-08-17)


### Features

* add on-device Mermaid diagram generation via WebLLM ([#6](https://github.com/AchuAshwath/drawmaid/issues/6)) ([48a8b94](https://github.com/AchuAshwath/drawmaid/commit/48a8b9451c7f154d651609e7736875c945cbfeb5))
* add voice input using Web Speech API ([#5](https://github.com/AchuAshwath/drawmaid/issues/5)) ([b2deeab](https://github.com/AchuAshwath/drawmaid/commit/b2deeab4adf05af035ef1a097aa893cf204abcb2))
* **ai-config:** add CLIProxyAPI and unified OpenAI-compatible local server support ([#30](https://github.com/AchuAshwath/drawmaid/issues/30)) ([d1d71a6](https://github.com/AchuAshwath/drawmaid/commit/d1d71a680bb0d0a388f50d866fd6361894f1e91a))
* **auto-mode:** add 6s continuous speaking milestone trigger for non-stop dictation ([538b94c](https://github.com/AchuAshwath/drawmaid/commit/538b94c410fd3d7db23eac79285809037d1b0a40))
* **auto-mode:** automatic mermaid diagram generation from voice/text input ([#16](https://github.com/AchuAshwath/drawmaid/issues/16)) ([e8e1b88](https://github.com/AchuAshwath/drawmaid/commit/e8e1b88d10609651de20b54dd6c253e16b062703))
* **auto-mode:** implement speech-cadence settling engine with single-flight queue ([b4901e0](https://github.com/AchuAshwath/drawmaid/commit/b4901e0819833158057331d1710d79114096cc2a))
* Integrate Excalidraw ([#7](https://github.com/AchuAshwath/drawmaid/issues/7)) ([24ad7a6](https://github.com/AchuAshwath/drawmaid/commit/24ad7a6edf51b3c9d9e591bd8e049f3722d516b5))
* Intent Extraction & Context-Aware Prompt Generation for LLM Diagrams ([#11](https://github.com/AchuAshwath/drawmaid/issues/11)) ([793905e](https://github.com/AchuAshwath/drawmaid/commit/793905e48c74e264fca639a0a98dc1d17b7f722d))
* local server with Opencode and  UX improvements ([#14](https://github.com/AchuAshwath/drawmaid/issues/14)) ([facd76d](https://github.com/AchuAshwath/drawmaid/commit/facd76d928aac57523706aa41e04748c2853918e))
* migrate from Neon to Cloudflare D1 ([#2](https://github.com/AchuAshwath/drawmaid/issues/2)) ([a2ee5e3](https://github.com/AchuAshwath/drawmaid/commit/a2ee5e3a5ee4c9ad5e11866c3ed0901eac619d47))
* **model-selector:** Add unified model selector for WebLLM and Local Server ([239c8f3](https://github.com/AchuAshwath/drawmaid/commit/239c8f318993380f1d32e6fed31a0554834cdf1c))
* **ui:** improved prompt footer with auto-grow textarea and mode toggle ([#13](https://github.com/AchuAshwath/drawmaid/issues/13)) ([d53f9f1](https://github.com/AchuAshwath/drawmaid/commit/d53f9f1eb5b5449854a786bca5ae5038eb5ba0d1))


### Bug Fixes

* **ci:** trigger GitHub Pages deploy on main and remove debug console.log ([823f94f](https://github.com/AchuAshwath/drawmaid/commit/823f94f6bb5a8ed9aee65c38825dcc9cd97d6375))
* detailed error reporting and fake progress bar ([#19](https://github.com/AchuAshwath/drawmaid/issues/19)) ([0edcb31](https://github.com/AchuAshwath/drawmaid/commit/0edcb317f1f6763827f351645f4d121fc1562135))
* progress bar, timeout, model selector, and docs improvements ([#20](https://github.com/AchuAshwath/drawmaid/issues/20)) ([abe66c6](https://github.com/AchuAshwath/drawmaid/commit/abe66c67cf16065226dd2580e9cb8f60127142f3))
* **stt:** add 10s zombie stream detector to watchdog ([0edad5b](https://github.com/AchuAshwath/drawmaid/commit/0edad5b370786330f594502ff968ac37fb1c93ff))
* **stt:** implement industry-standard Atomic Utterance loop to eliminate zombie streams and lost words ([b63f6ce](https://github.com/AchuAshwath/drawmaid/commit/b63f6ce92acac4d6785df579fd8dc58ff2790da9))
* **ui:** force textarea viewport to stick to bottom on dictation with RAF ([6fedd1f](https://github.com/AchuAshwath/drawmaid/commit/6fedd1f7d859b8319bb50bd0fce52e0b304b0b23))
* **voice:** use robust base-accumulator and eliminate forced mid-speech stream aborts ([8f5a429](https://github.com/AchuAshwath/drawmaid/commit/8f5a42942e17e496d506342f2c9d0a99b2ae1098))


### Miscellaneous Chores

* **ci:** clean CI pipeline, add Google Release Please and Cloudflare Pages PR preview ([#36](https://github.com/AchuAshwath/drawmaid/issues/36)) ([03bfc74](https://github.com/AchuAshwath/drawmaid/commit/03bfc745cd355fe709ad357386b29888c86bf502))
* **docs:** updated docs for opencode serve ([3e6b63b](https://github.com/AchuAshwath/drawmaid/commit/3e6b63bd0bb4dd9d345f06a8fd246eda2e7e401b))
* GitHub pages deploy ([#18](https://github.com/AchuAshwath/drawmaid/issues/18)) ([a71cc84](https://github.com/AchuAshwath/drawmaid/commit/a71cc84c700fdeaf39691db6cc7d4ff073ebbdf6))
* ignore CHANGELOG.md in prettier checks ([bf0a6e1](https://github.com/AchuAshwath/drawmaid/commit/bf0a6e1bbc9deca9ad040c03bb9b3a85089cd24a))
* performance optimisation for release ([#17](https://github.com/AchuAshwath/drawmaid/issues/17)) ([ac0ed07](https://github.com/AchuAshwath/drawmaid/commit/ac0ed0780da78fd48edba0887b7bced8aa64862b))
* sync upstream React Starter Kit changes ([#10](https://github.com/AchuAshwath/drawmaid/issues/10)) ([03638ed](https://github.com/AchuAshwath/drawmaid/commit/03638ed4945d2be1d2179bdf184a9fac5215249f))


### Code Refactoring

* replace demo pages with public index page ([#4](https://github.com/AchuAshwath/drawmaid/issues/4)) ([30a10ff](https://github.com/AchuAshwath/drawmaid/commit/30a10ff10bdd47d826f93c3cb326307ca33c5281))


### Continuous Integration

* add PR template and validate release note in PR descriptions ([378a0e6](https://github.com/AchuAshwath/drawmaid/commit/378a0e645142a32e34fa61f1400b5659bd02039c))
