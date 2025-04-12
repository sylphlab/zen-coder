import * as vscode from 'vscode';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';

// Define the models known to be available from Anthropic
// Note: Anthropic doesn't have a standard public API endpoint to list models dynamically without authentication.
// This list might need manual updates or a more sophisticated approach if dynamic listing is crucial.
const ANTHROPIC_MODELS: ModelDefinition[] = [
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  // Older models (might be deprecated)
  // { id: 'claude-2.1', name: 'Claude 2.1' },
  // { id: 'claude-2.0', name: 'Claude 2.0' },
  // { id: 'claude-instant-1.2', name: 'Claude Instant 1.2' },
];

export const anthropicProvider: AiProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  requiresApiKey: true,
  apiKeyUrl: 'https://console.anthropic.com/settings/keys',
  secretStorageKey: 'zenCoder.anthropicApiKey',
  settingsEnabledKey: 'zencoder.provider.anthropic.enabled',

  /**
   * Creates an Anthropic language model instance.
   */
  createModel(apiKey: string | undefined, modelId: string): LanguageModel {
    if (!apiKey) {
      throw new Error('Anthropic API key is required.');
    }
    // Validate if the modelId is one of the known ones (optional but good practice)
    if (!ANTHROPIC_MODELS.some(m => m.id === modelId)) {
        console.warn(`Anthropic model '${modelId}' not in known list. Attempting to create anyway.`);
        // Or throw new Error(`Unknown Anthropic model ID: ${modelId}`);
    }

    const anthropic = createAnthropic({
      apiKey: apiKey,
      // baseURL: '...', // Optional: If using a proxy or different endpoint
    });

    // Dynamically select the model function based on the modelId
    // The ai-sdk might simplify this in the future, but currently, you often need the specific model function.
    // For now, we assume the SDK handles the modelId string directly within the provider instance.
    // If specific model functions were needed:
    // switch (modelId) {
    //   case 'claude-3-5-sonnet-20240620':
    //     return anthropic(modelId);
    //   // ... other cases
    //   default:
    //     // Fallback or error
    //     return anthropic(modelId); // Try the generic way
    // }
    // Assuming the SDK's createAnthropic instance can take the model ID directly in chat/generate calls,
    // or that a generic model function exists. Let's return the provider instance itself,
    // and the modelId will be passed during the actual API call (e.g., streamText).
    // The `LanguageModel` interface is satisfied by the provider instance itself.
    // Correction: The provider instance (`anthropic`) is not the LanguageModel.
    // We need to call the provider instance with the model ID.
    return anthropic(modelId);
  },

  /**
   * Retrieves the list of known available Anthropic models.
   */
  async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
    // For Anthropic, we return the hardcoded list as there's no public listing API.
    // An API key isn't strictly needed for *this* implementation, but the interface allows it.
    return Promise.resolve(ANTHROPIC_MODELS);
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