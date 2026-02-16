import { PromptFooter } from "@/components/prompt-footer";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "@/lib/insert-mermaid-into-canvas";
import {
  buildErrorRecoveryPrompt,
  buildUserPrompt,
  extractIntent,
} from "@/lib/intent-extraction";
import { isAbortError, isTimeoutError, SYSTEM_PROMPT } from "@/lib/mermaid-llm";
import { normalizeMermaid } from "@/lib/normalize-mermaid";
import { useMermaidLlm } from "@/lib/use-mermaid-llm";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"auto" | "normal">("normal");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [apiReady, setApiReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isSupported, status, loadProgress, generate } = useMermaidLlm();
  const excalidrawApiRef = useRef<ExcalidrawCanvasApi | null>(null);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Keep the app's Tailwind/shadcn theme in sync with our `theme` state.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const handleGenerate = async () => {
    setError(null);
    let mermaidOutput: string | null = null;

    const intent = extractIntent(prompt);
    const userPrompt = buildUserPrompt(prompt, intent);

    try {
      mermaidOutput = await generate(userPrompt, {
        systemPrompt: SYSTEM_PROMPT,
      });
    } catch (err) {
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
      return;
    }

    const api = excalidrawApiRef.current;
    if (!api) return;

    let mermaidCode: string | null = null;
    try {
      mermaidCode = normalizeMermaid(mermaidOutput);
      if (!mermaidCode) {
        return;
      }
      await insertMermaidIntoCanvas(api, mermaidCode);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorPrompt = buildErrorRecoveryPrompt({
        originalInput: prompt,
        failedMermaidCode: mermaidCode || mermaidOutput,
        errorMessage,
        diagramType: intent.diagramType,
      });

      try {
        const recoveredOutput = await generate(errorPrompt, {
          systemPrompt: SYSTEM_PROMPT,
          maxTokens: 512,
        });

        if (!recoveredOutput?.trim()) {
          setError(
            "Could not fix diagram syntax. Please try a different description.",
          );
          return;
        }

        const recoveredCode = normalizeMermaid(recoveredOutput);
        if (!recoveredCode) {
          setError(
            "Could not fix diagram syntax. Please try a different description.",
          );
          return;
        }

        await insertMermaidIntoCanvas(api, recoveredCode);
      } catch (recoveryErr) {
        if (isAbortError(recoveryErr)) return;
        setError(
          recoveryErr instanceof Error
            ? recoveryErr.message
            : "Could not add diagram to canvas. Check the diagram syntax.",
        );
      }
    }
  };

  return (
    <div className="relative h-dvh w-full">
      <Excalidraw
        theme={theme}
        excalidrawAPI={(api) => {
          excalidrawApiRef.current = api as ExcalidrawCanvasApi;
          setApiReady(true);
        }}
        UIOptions={{
          canvasActions: {
            toggleTheme: false,
          },
        }}
        initialData={undefined}
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
          <MainMenu.Item onSelect={handleToggleTheme}>
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>
                {theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"}
              </span>
            </div>
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Logo>
              <span className="text-3xl font-semibold">Drawmaid</span>
            </WelcomeScreen.Center.Logo>
            <WelcomeScreen.Center.Heading>
              Create diagrams with AI
            </WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItemLoadScene />
              <WelcomeScreen.Center.MenuItemLink href="https://github.com/anomalyco/drawmaid">
                GitHub
              </WelcomeScreen.Center.MenuItemLink>
              <WelcomeScreen.Center.MenuItemHelp />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.HelpHint />
        </WelcomeScreen>
      </Excalidraw>

      {/* Floating top overlay (ready for custom toolbar if needed) */}
      <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center z-50">
        <div className="pointer-events-auto w-full max-w-[550px] px-4" />
      </div>

      {/* Floating bottom overlay with PromptFooter */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center z-50">
        <div className="pointer-events-auto w-full max-w-[550px] px-4">
          <PromptFooter
            prompt={prompt}
            onPromptChange={(value) => {
              setPrompt(value);
              if (error) setError(null);
            }}
            mode={mode}
            onModeChange={setMode}
            onGenerate={handleGenerate}
            generateDisabled={
              mode === "auto" ||
              !prompt ||
              status === "loading" ||
              status === "generating" ||
              !isSupported ||
              !apiReady
            }
            generating={status === "generating"}
            onTranscript={(text) => {
              setPrompt(text);
              setError(null);
            }}
            onRecognitionError={(message) => setError(message)}
            error={error}
            loading={status === "loading"}
            loadProgress={loadProgress}
            inputAriaDescribedBy={error ? "home-error" : undefined}
            inputAriaInvalid={!!error}
          />
        </div>
      </div>
    </div>
  );
}
