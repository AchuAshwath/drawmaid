import {
  resolveDiagramOutput,
  type DiagramDocument,
  type DiagramIntent,
  type DiagramOutput,
} from "./diagram";

export interface DiagramOutputPolicyInput {
  readonly raw: string | null | undefined;
  readonly intent: DiagramIntent | null;
  readonly recovery: "once" | "none";
}

export interface DiagramOutputPolicyDependencies {
  readonly recover?: (
    raw: string | null | undefined,
  ) => Promise<string | null | undefined>;
  readonly insert: (document: DiagramDocument) => Promise<void>;
}

export interface DiagramOutputPolicyResult {
  readonly output: DiagramOutput;
  readonly inserted: boolean;
  readonly recoveryAttempted: boolean;
}

type RenderableDiagramOutput = Extract<
  DiagramOutput,
  { kind: "editable" | "image-only" }
>;

function isRenderableDiagramOutput(
  output: DiagramOutput,
): output is RenderableDiagramOutput {
  return output.kind === "editable" || output.kind === "image-only";
}

export async function applyDiagramOutputPolicy(
  input: DiagramOutputPolicyInput,
  dependencies: DiagramOutputPolicyDependencies,
): Promise<DiagramOutputPolicyResult> {
  let output = resolveDiagramOutput(input.raw, input.intent);
  let recoveryAttempted = false;

  const recoverAndInsert = async (): Promise<DiagramOutputPolicyResult> => {
    recoveryAttempted = true;
    const recoveredRaw = await dependencies.recover!(input.raw);
    output = resolveDiagramOutput(recoveredRaw, input.intent);

    if (isRenderableDiagramOutput(output)) {
      await dependencies.insert(output.document);
      return { output, inserted: true, recoveryAttempted };
    }

    return { output, inserted: false, recoveryAttempted };
  };

  if (isRenderableDiagramOutput(output)) {
    try {
      await dependencies.insert(output.document);
      return { output, inserted: true, recoveryAttempted };
    } catch (error) {
      if (
        input.recovery === "once" &&
        dependencies.recover &&
        !recoveryAttempted
      ) {
        return recoverAndInsert();
      }
      throw error;
    }
  }

  if (output.kind !== "broken" || input.recovery === "none") {
    return { output, inserted: false, recoveryAttempted };
  }

  if (!dependencies.recover) {
    return { output, inserted: false, recoveryAttempted };
  }

  return recoverAndInsert();
}
