/** Run the seeded layered routing-on/off comparison batch by batch. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import type { LayeredBatchManifest } from "./layered-batches";

type Mode = "on" | "off";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

function callsPerTranscript(mode: Mode): number {
  return mode === "on" ? 7 : 4;
}

export function estimateCalls(
  manifest: LayeredBatchManifest,
  modes: readonly Mode[] = ["on", "off"],
): number {
  const rows = manifest.batches.reduce(
    (sum, batch) => sum + batch.ids.length,
    0,
  );
  return modes.reduce((sum, mode) => sum + rows * callsPerTranscript(mode), 0);
}

export function splitIds(
  ids: readonly string[],
  chunkSize: number,
): string[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("chunkSize must be a positive integer");
  }
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push([...ids.slice(i, i + chunkSize)]);
  }
  return chunks;
}

async function main() {
  const manifestPath = resolve(
    arg("manifest", "apps/app/e2e/harness/out-full/layered-ab-manifest.json")!,
  );
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as LayeredBatchManifest;
  const model = arg("model");
  if (!model) throw new Error("--model is required");
  const modes = (arg("modes", "on,off") ?? "")
    .split(",")
    .map((mode) => mode.trim())
    .filter(Boolean) as Mode[];
  if (!modes.length || modes.some((mode) => mode !== "on" && mode !== "off")) {
    throw new Error('--modes must contain only "on" and/or "off"');
  }
  const outDir = resolve(
    arg("out-dir", "apps/app/e2e/harness/out-full/layered-ab-batches")!,
  );
  const concurrency = arg("concurrency", "1")!;
  const chunkSize = Number(arg("chunk-size", "4"));
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("--chunk-size must be a positive integer");
  }
  const requestedBatch = arg("batch");
  const batches = requestedBatch
    ? manifest.batches.filter((batch) => batch.index === Number(requestedBatch))
    : manifest.batches;
  if (requestedBatch && batches.length !== 1) {
    throw new Error(`unknown --batch ${requestedBatch}`);
  }
  const root = resolve(import.meta.dirname, "../../../..");
  const ab = resolve(root, "apps/app/e2e/harness/ab.ts");
  const dryRun = process.argv.includes("--dry-run");
  const resume = process.argv.includes("--resume");
  const scoreEach = !process.argv.includes("--no-score");

  console.log(
    `${batches.length} batches; chunk-size=${chunkSize}; ` +
      `modes=${modes.join(",")}; estimated model calls=${estimateCalls({ ...manifest, batches }, modes)}`,
  );
  for (const mode of modes) {
    for (const batch of batches) {
      const chunks = splitIds(batch.ids, chunkSize);
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const out = resolve(
          outDir,
          `routing-${mode}`,
          `batch-${batch.index}`,
          `chunk-${chunkIndex}.json`,
        );
        if (resume && existsSync(out)) {
          console.log(
            `\nskipping existing: routing=${mode} batch=${batch.index} chunk=${chunkIndex}`,
          );
          continue;
        }
        const args = [
          ab,
          "--model",
          model,
          "--routing",
          mode,
          "--concurrency",
          concurrency,
          "--ids",
          chunks[chunkIndex].join(","),
          "--out",
          out,
        ];
        console.log(
          `\n${dryRun ? "would run" : "running"}: routing=${mode} batch=${batch.index} chunk=${chunkIndex + 1}/${chunks.length} (${chunks[chunkIndex].length} transcripts)`,
        );
        if (!dryRun) {
          await run("bun", args);
          if (scoreEach) {
            const scoreOut = out.replace(/\.json$/, "-score.json");
            await run(
              "bunx",
              ["playwright", "test", "e2e/harness/layered-score.playwright.ts"],
              {
                cwd: resolve(root, "apps/app"),
                env: {
                  ...process.env,
                  HARNESS_AB_IN: out,
                  HARNESS_AB_SCORE_OUT: scoreOut,
                },
              },
            );
          }
        }
      }
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
