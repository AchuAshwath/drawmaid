interface WebLLMModelRecord {
  model_id: string;
  model: string;
  model_lib: string;
  vram_required_MB?: number;
  low_resource_required?: boolean;
}

let cachedModels: WebLLMModelRecord[] | null = null;
let cacheError: Error | null = null;

export async function getWebLLMModels(): Promise<WebLLMModelRecord[]> {
  if (cachedModels) return cachedModels;
  if (cacheError) throw cacheError;

  try {
    const { prebuiltAppConfig } = await import("@mlc-ai/web-llm");
    cachedModels = prebuiltAppConfig.model_list as WebLLMModelRecord[];
    return cachedModels;
  } catch (err) {
    cacheError = err instanceof Error ? err : new Error(String(err));
    throw cacheError;
  }
}

export type WebLLMModelInfo = {
  id: string;
  name: string;
  vramMB: number;
  lowResource: boolean;
  contextWindow: number;
};

export async function getWebLLMModelInfos(): Promise<WebLLMModelInfo[]> {
  const models = await getWebLLMModels();
  return models.map((m) => ({
    id: m.model_id,
    name: m.model_id,
    vramMB: Math.round(m.vram_required_MB ?? 0),
    lowResource: m.low_resource_required ?? false,
    contextWindow: 4096,
  }));
}
