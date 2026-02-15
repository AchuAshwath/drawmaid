import { VoiceInputButton } from "@/components/voice-input-button";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "@/lib/insert-mermaid-into-canvas";
import { isAbortError, isTimeoutError, SYSTEM_PROMPT } from "@/lib/mermaid-llm";
import { normalizeMermaid } from "@/lib/normalize-mermaid";
import { useMermaidLlm } from "@/lib/use-mermaid-llm";
import {
  extractIntent,
  buildUserPrompt,
  buildErrorRecoveryPrompt,
} from "@/lib/intent-extraction";
import { Excalidraw, Footer, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Button, Input } from "@repo/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [prompt, setPrompt] = useState("");
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSupported, status, loadProgress, generate } = useMermaidLlm();
  const excalidrawApiRef = useRef<ExcalidrawCanvasApi | null>(null);

  const handleGenerate = async () => {
    setError(null);
    let mermaidOutput: string | null = null;

    console.log("[DrawMaid] Input:", prompt);

    const intent = extractIntent(prompt);
    console.log("[DrawMaid] Intent:", JSON.stringify(intent));

    const userPrompt = buildUserPrompt(prompt, intent);

    // Log the ENTIRE input the LLM receives
    console.log("[DrawMaid] === LLM INPUT ===");
    console.log("[DrawMaid] SYSTEM PROMPT:");
    console.log(SYSTEM_PROMPT);
    console.log("\n[DrawMaid] USER PROMPT:");
    console.log(userPrompt);
    console.log("[DrawMaid] === END LLM INPUT ===\n");

    try {
      mermaidOutput = await generate(userPrompt, {
        systemPrompt: SYSTEM_PROMPT,
      });
    } catch (err) {
      console.error("[DrawMaid] Generation error:", err);
      if (isAbortError(err)) return;
      if (isTimeoutError(err)) {
        setError(
          "Generation timed out. Try a simpler request or check your connection.",
        );
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Generation failed. Please try again.",
      );
      return;
    }

    if (!mermaidOutput?.trim()) {
      console.log("[DrawMaid] Empty output, skipping");
      return;
    }

    console.log("[DrawMaid] LLM Output:\n", mermaidOutput);

    const api = excalidrawApiRef.current;
    if (!api) return;

    let mermaidCode: string | null = null;
    try {
      mermaidCode = normalizeMermaid(mermaidOutput);
      if (!mermaidCode) {
        console.log("[DrawMaid] Normalization failed, skipping");
        return;
      }
      console.log("[DrawMaid] Mermaid:\n", mermaidCode);
      await insertMermaidIntoCanvas(api, mermaidCode);
      console.log("[DrawMaid] Inserted successfully");
    } catch (err) {
      console.error("[DrawMaid] Insert error (attempt 1):", err);

      // Try error recovery once
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorPrompt = buildErrorRecoveryPrompt({
        originalInput: prompt,
        failedMermaidCode: mermaidCode || mermaidOutput,
        errorMessage,
        diagramType: intent.diagramType,
      });

      console.log("[DrawMaid] === ERROR RECOVERY PROMPT ===");
      console.log(errorPrompt);
      console.log("[DrawMaid] === END ERROR RECOVERY PROMPT ===\n");

      try {
        const recoveredOutput = await generate(errorPrompt, {
          systemPrompt: SYSTEM_PROMPT,
          maxTokens: 512, // Shorter for recovery
        });

        if (!recoveredOutput?.trim()) {
          console.log("[DrawMaid] Recovery failed - empty output");
          setError(
            "Could not fix diagram syntax. Please try a different description.",
          );
          return;
        }

        console.log("[DrawMaid] Recovery Output:\n", recoveredOutput);

        const recoveredCode = normalizeMermaid(recoveredOutput);
        if (!recoveredCode) {
          console.log("[DrawMaid] Recovery normalization failed");
          setError(
            "Could not fix diagram syntax. Please try a different description.",
          );
          return;
        }

        await insertMermaidIntoCanvas(api, recoveredCode);
        console.log("[DrawMaid] Recovered and inserted successfully");
      } catch (recoveryErr) {
        console.error("[DrawMaid] Recovery failed:", recoveryErr);
        if (isAbortError(recoveryErr)) return;
        setError(
          err instanceof Error
            ? err.message
            : "Could not add diagram to canvas. Check the diagram syntax.",
        );
      }
    }
  };

  return (
    <div className="h-dvh w-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawApiRef.current = api as ExcalidrawCanvasApi;
          setApiReady(true);
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.Group title="Excalidraw links">
            <MainMenu.DefaultItems.Socials />
          </MainMenu.Group>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.Separator />
          <MainMenu.ItemLink href="/login">Sign In</MainMenu.ItemLink>
          <MainMenu.ItemLink href="/signup">Sign Up</MainMenu.ItemLink>
        </MainMenu>
        <Footer>
          <div className="flex w-full max-w-2xl mx-auto flex-col gap-2 text-foreground">
            <div className="flex w-full items-center gap-2">
              <VoiceInputButton
                onTranscript={(text) => {
                  setPrompt(text);
                  setError(null);
                }}
                onRecognitionError={(message) => setError(message)}
              />
              <Input
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Describe a diagram or use the mic..."
                className="min-w-0 flex-1 h-9 text-sm bg-background text-foreground border-border placeholder:text-muted-foreground"
                aria-label="Diagram description"
                aria-invalid={!!error}
                aria-describedby={error ? "home-error" : undefined}
              />
              <Button
                onClick={handleGenerate}
                disabled={
                  !prompt ||
                  status === "loading" ||
                  status === "generating" ||
                  !isSupported ||
                  !apiReady
                }
                variant="secondary"
                size="sm"
              >
                {status === "generating" ? "Generating..." : "Generate Diagram"}
              </Button>
            </div>
            {error && (
              <p
                id="home-error"
                className="w-full text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
            {status === "loading" && (
              <div
                className="h-1.5 w-full max-w-2xl mx-auto rounded-full border border-border bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(loadProgress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Downloading model"
              >
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${loadProgress * 100}%` }}
                />
              </div>
            )}
          </div>
        </Footer>
      </Excalidraw>
    </div>
  );
}
