import { useState } from "react";
import { Button } from "@repo/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { VoiceInputButton } from "@/components/voice-input-button";
import { useMermaidLlm } from "@/lib/use-mermaid-llm";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [prompt, setPrompt] = useState("");
  const { isSupported, status, loadProgress, error, output, generate } =
    useMermaidLlm();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Welcome</h1>
        <p className="text-lg text-muted-foreground">
          Get started by signing in to your account or creating a new one.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/signup">Sign Up</Link>
          </Button>
        </div>

        {isSupported ? (
          <div className="space-y-3 text-left">
            <div className="flex gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a diagram..."
                className="flex-1 min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
              />
              <VoiceInputButton
                onTranscript={(text) => setPrompt(text)}
                className="self-end"
              />
            </div>
            {status === "loading" && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${loadProgress * 100}%` }}
                />
              </div>
            )}
            <Button
              onClick={() => generate(prompt).catch(() => {})}
              disabled={!prompt || status === "loading"}
              variant="secondary"
              className="w-full"
            >
              {status === "generating" ? "Generating..." : "Generate Diagram"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {output && (
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                {output}
              </pre>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-center">
            <VoiceInputButton onTranscript={(text) => setPrompt(text)} />
            {prompt && (
              <p className="text-sm text-muted-foreground">{prompt}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
