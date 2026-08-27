/**
 * THROWAWAY one-type tuning loop for map #38.
 *
 * One command generates Low/Medium/High for one type, scores contracts, and
 * leaves the artifacts together. Edit one appendix, rerun the same command,
 * and compare the report. The default model is the live Gemini evaluation
 * model, never Sonnet.
 */
import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { contractManifest } from "./contracts";
import type { DiagramType } from "../type-registry";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

async function run(cmd: string[]) {
  await new Promise<void>((resolvePromise, reject) => {
    const proc = spawn(cmd[0], cmd.slice(1), { stdio: "inherit" });
    proc.once("error", reject);
    proc.once("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${cmd.join(" ")} exited with ${code}`));
    });
  });
}

async function main() {
  const type = arg("type") as DiagramType | undefined;
  if (!type || !(type in contractManifest.types)) {
    console.error(
      `--type is required: ${Object.keys(contractManifest.types).join(", ")}`,
    );
    process.exit(1);
  }
  const model = arg("model", "gemini-3.6-flash-high") as string;
  const sample = Number(
    arg("sample", String(contractManifest.types[type].sample)),
  );
  const seed = arg("seed", "1") as string;
  const variant = arg("variant", `tuning/variants/${type}`) as string;
  const stamp = arg("name", `gemini-${type}-${Date.now()}`) as string;
  const dir = resolve(
    arg(
      "out-dir",
      `apps/app/e2e/harness/out-tuning/${type}/${stamp}`,
    ) as string,
  );
  mkdirSync(dir, { recursive: true });
  const pairs = resolve(dir, "pairs.json");
  const report = resolve(dir, "report.json");
  const root = resolve(here("../../../../.."));
  const ab = resolve(root, "apps/app/e2e/harness/ab.ts");
  const score = resolve(root, "apps/app/e2e/harness/tuning/score.ts");

  await run([
    "bun",
    ab,
    "--model",
    model,
    "--corpus",
    "balanced",
    "--type",
    type,
    "--sample",
    String(sample),
    "--seed",
    seed,
    "--prompt-dir",
    resolve(root, variant),
    "--out",
    pairs,
  ]);
  await run(["bun", score, "--in", pairs, "--type", type, "--out", report]);
  console.log(`\nTuning run: ${dir}`);
  console.log(
    "Next iteration: edit one *.append.md file in the variant directory and rerun with the same --name.",
  );
}

if (import.meta.main)
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
