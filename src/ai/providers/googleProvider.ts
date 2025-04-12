import * as vscode from 'vscode';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';

// Define the models known to be available from Google Gemini
// Note: Google also doesn't have a simple public, unauthenticated API to list all fine-tuned models.
// The base models are generally stable.
// See: https://ai.google.dev/models/gemini
const GOOGLE_MODELS: ModelDefinition[] = [
  { id: 'models/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (latest)' },
  { id: 'models/gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (latest)' },
  { id: 'models/gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
  // Older or specific models - uncomment if needed
  // { id: 'models/gemini-1.0-pro-001', name: 'Gemini 1.0 Pro (001)' },
  // { id: 'models/gemini-pro', name: 'Gemini Pro (Alias for 1.0)' }, // Alias might exist
  // { id: 'models/gemini-pro-vision', name: 'Gemini Pro Vision' }, // Vision model, might have different interface needs
];

export const googleProvider: AiProvider = {
  id: 'google',
  name: 'Google Gemini',
  requiresApiKey: true,
  apiKeyUrl: 'https://aistudio.google.com/app/apikey',
  secretStorageKey: 'zenCoder.googleApiKey',
  settingsEnabledKey: 'zencoder.provider.google.enabled',

  /**
   * Creates a Google Gemini language model instance.
   */
  createModel(apiKey: string | undefined, modelId: string): LanguageModel {
    if (!apiKey) {
      throw new Error('Google API key is required.');
    }
    // Validate if the modelId is one of the known ones (optional)
    if (!GOOGLE_MODELS.some(m => m.id === modelId)) {
        console.warn(`Google model '${modelId}' not in known list. Attempting to create anyway.`);
    }

    const google = createGoogleGenerativeAI({
      apiKey: apiKey,
      // baseURL: '...', // Optional: If using a proxy
      // apiVersion: 'v1beta', // Optional: Specify API version if needed
    });

    // The google provider instance from ai-sdk takes the model ID directly.
    return google(modelId);
  },

  /**
   * Retrieves the list of known available Google Gemini models.
   */
  async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
    // Similar to Anthropic, return the hardcoded list.
    // A future enhancement could involve trying to list models if an API becomes available.
    return Promise.resolve(GOOGLE_MODELS);
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