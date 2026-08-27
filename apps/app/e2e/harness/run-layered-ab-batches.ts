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

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
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
  const concurrency = arg("concurrency", "4")!;
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

  console.log(
    `${batches.length} batches x ${manifest.batches[0]?.ids.length ?? 0} rows; ` +
      `modes=${modes.join(",")}; estimated model calls=${estimateCalls({ ...manifest, batches }, modes)}`,
  );
  for (const mode of modes) {
    for (const batch of batches) {
      const out = resolve(
        outDir,
        `routing-${mode}`,
        `batch-${batch.index}.json`,
      );
      if (resume && existsSync(out)) {
        console.log(
          `\nskipping existing: routing=${mode} batch=${batch.index}`,
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
        batch.ids.join(","),
        "--out",
        out,
      ];
      console.log(
        `\n${dryRun ? "would run" : "running"}: routing=${mode} batch=${batch.index}`,
      );
      if (!dryRun) await run("bun", args);
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
