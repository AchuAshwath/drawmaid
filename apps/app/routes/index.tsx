import { VoiceInputButton } from "@/components/voice-input-button";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "@/lib/insert-mermaid-into-canvas";
import { isAbortError } from "@/lib/mermaid-llm";
import { stripMermaidFences } from "@/lib/normalize-mermaid";
import { useMermaidLlm } from "@/lib/use-mermaid-llm";
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
    try {
      mermaidOutput = await generate(prompt);
    } catch (err) {
      if (isAbortError(err)) return; // User cancelled or new generation started
      setError(
        err instanceof Error
          ? err.message
          : "Generation failed. Please try again.",
      );
      return;
    }
    if (!mermaidOutput?.trim()) return;

    const api = excalidrawApiRef.current;
    if (!api) return;

    try {
      const mermaidCode = stripMermaidFences(mermaidOutput);
      await insertMermaidIntoCanvas(api, mermaidCode);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add diagram to canvas. Check the diagram syntax.",
      );
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
