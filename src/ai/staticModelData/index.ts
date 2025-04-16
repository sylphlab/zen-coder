import { StaticModelInfo } from '../../common/types';
import { anthropicStaticModels } from './anthropic';
import { googleStaticModels } from './google';
import { vertexStaticModels } from './vertex';
import { openaiStaticModels } from './openai';
import { deepseekStaticModels } from './deepseek';
import { mistralStaticModels } from './mistral';
// Import other provider data files here as they are created

/**
 * A map containing static model information for all known providers.
 * Key: Full model ID (e.g., "anthropic:claude-3-7-sonnet-20250219")
 * Value: StaticModelInfo object
 */
export const allStaticModels: Map<string, StaticModelInfo> = new Map();

function addModelsToMap(modelCollection: { [modelId: string]: StaticModelInfo }) {
  for (const modelId in modelCollection) {
    const modelInfo = modelCollection[modelId];
    // Ensure the full ID including provider prefix is used as the key
    if (!allStaticModels.has(modelInfo.id)) {
      allStaticModels.set(modelInfo.id, modelInfo);
    } else {
      console.warn(`[StaticModelData] Duplicate model ID found, skipping: ${modelInfo.id}`);
    }
  }
}

// Add models from each provider
addModelsToMap(anthropicStaticModels);
addModelsToMap(googleStaticModels);
addModelsToMap(vertexStaticModels);
addModelsToMap(openaiStaticModels);
addModelsToMap(deepseekStaticModels);
addModelsToMap(mistralStaticModels);
// Add other providers here

console.log(`[StaticModelData] Initialized static model map with ${allStaticModels.size} models.`);

/**
 * Retrieves static information for a specific model ID.
 * @param fullModelId The full model ID including provider prefix (e.g., "openai:gpt-4.1").
 * @returns The StaticModelInfo object or undefined if not found.
 */
export function getStaticModelInfo(fullModelId: string): StaticModelInfo | undefined {
  return allStaticModels.get(fullModelId);
}

// Export individual collections if needed elsewhere, though using the map is preferred.
export {
  anthropicStaticModels,
  googleStaticModels,
  vertexStaticModels,
  openaiStaticModels,
  deepseekStaticModels,
  mistralStaticModels,
};