import {
  resolveDiagramOutput,
  type DiagramDocument,
  type DiagramIntent,
  type DiagramOutput,
  type DiagramType,
} from "./diagram";

export interface DiagramOutputPolicyInput {
  readonly raw: string | null | undefined;
  readonly intent: DiagramIntent | null;
  readonly requestedTypes?: readonly DiagramType[];
  readonly recovery: "once" | "none";
}

export interface DiagramOutputPolicyDependencies {
  readonly recover?: (
    raw: string | null | undefined,
  ) => Promise<string | null | undefined>;
  readonly insert: (documents: readonly DiagramDocument[]) => Promise<void>;
}

export interface DiagramOutputPolicyResult {
  readonly output: DiagramOutput;
  readonly inserted: boolean;
  readonly recoveryAttempted: boolean;
}

type RenderableDiagramOutput = Extract<
  DiagramOutput,
  { kind: "editable" | "image-only" | "multiple" }
>;

function isRenderableDiagramOutput(
  output: DiagramOutput,
  requestedTypes: readonly DiagramType[] = [],
): output is RenderableDiagramOutput {
  if (output.kind === "editable" || output.kind === "image-only") return true;
  if (output.kind !== "multiple") return false;
  const requested = new Set(requestedTypes);
  return output.documents.every(
    (document) =>
      document.capability === "editable" || requested.has(document.type),
  );
}

function documentsForOutput(
  output: RenderableDiagramOutput,
): readonly DiagramDocument[] {
  return output.kind === "multiple" ? output.documents : [output.document];
}

export async function applyDiagramOutputPolicy(
  input: DiagramOutputPolicyInput,
  dependencies: DiagramOutputPolicyDependencies,
): Promise<DiagramOutputPolicyResult> {
  let output = resolveDiagramOutput(input.raw, input.intent);
  const requestedTypes = input.requestedTypes ?? [];

  const applyImageOnlyPolicy = (candidate: DiagramOutput): DiagramOutput => {
    if (candidate.kind !== "multiple") return candidate;
    const requested = new Set(requestedTypes);
    const offendingIndex = candidate.documents.findIndex(
      (document) =>
        document.capability === "image-only" && !requested.has(document.type),
    );
    if (offendingIndex === -1) return candidate;
    return {
      kind: "multiple-unrequested-image",
      documents: candidate.documents,
      offendingType: candidate.documents[offendingIndex].type,
      offendingIndex,
    };
  };

  output = applyImageOnlyPolicy(output);
  let recoveryAttempted = false;

  const recoverAndInsert = async (): Promise<DiagramOutputPolicyResult> => {
    recoveryAttempted = true;
    const recoveredRaw = await dependencies.recover!(input.raw);
    output = applyImageOnlyPolicy(
      resolveDiagramOutput(recoveredRaw, input.intent),
    );

    if (isRenderableDiagramOutput(output, requestedTypes)) {
      await dependencies.insert(documentsForOutput(output));
      return { output, inserted: true, recoveryAttempted };
    }

    return { output, inserted: false, recoveryAttempted };
  };

  if (isRenderableDiagramOutput(output, requestedTypes)) {
    try {
      await dependencies.insert(documentsForOutput(output));
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
