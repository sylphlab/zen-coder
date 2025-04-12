import * as vscode from 'vscode';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';

// Define the models known to be available from DeepSeek
// See: https://platform.deepseek.com/docs
// Note: DeepSeek might have different APIs for listing models, but we'll start with known ones.
const DEEPSEEK_MODELS: ModelDefinition[] = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat' }, // General chat model
  { id: 'deepseek-coder', name: 'DeepSeek Coder' }, // Code generation model
  // Add other models if known or become available
];

export const deepseekProvider: AiProvider = {
  id: 'deepseek',
  name: 'DeepSeek',
  requiresApiKey: true,
  apiKeyUrl: 'https://platform.deepseek.com/docs/getting-started/apply-for-an-api-key',
  secretStorageKey: 'zenCoder.deepseekApiKey',
  settingsEnabledKey: 'zencoder.provider.deepseek.enabled',

  /**
   * Creates a DeepSeek language model instance.
   */
  createModel(apiKey: string | undefined, modelId: string): LanguageModel {
    if (!apiKey) {
      throw new Error('DeepSeek API key is required.');
    }
    // Validate if the modelId is one of the known ones (optional)
    if (!DEEPSEEK_MODELS.some(m => m.id === modelId)) {
        console.warn(`DeepSeek model '${modelId}' not in known list. Attempting to create anyway.`);
    }

    const deepseek = createDeepSeek({
      apiKey: apiKey,
      // baseURL: '...', // Optional: If using a proxy
    });

    // The deepseek provider instance from ai-sdk takes the model ID directly.
    return deepseek(modelId);
  },

  /**
   * Retrieves the list of known available DeepSeek models.
   */
  async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
    // Similar to others, return the hardcoded list for now.
    // Future enhancement: Check if DeepSeek provides a model listing API.
    return Promise.resolve(DEEPSEEK_MODELS);
  },
  // --- New methods required by interface ---

  async getApiKey(secretStorage: vscode.SecretStorage): Promise<string | undefined> {
    return await secretStorage.get(this.secretStorageKey);
  },

  async setApiKey(secretStorage: vscode.SecretStorage, apiKey: string): Promise<void> {
    await secretStorage.store(this.secretStorageKey, apiKey);
  },

  async deleteApiKey(secretStorage: vscode.SecretStorage): Promise<void> {
    await secretStorage.delete(this.secretStorageKey);
  },

  isEnabled(): boolean {
    const config = vscode.workspace.getConfiguration();
    return config.get<boolean>(this.settingsEnabledKey, true); // Default to true
  },
};