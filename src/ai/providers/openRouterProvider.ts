import * as vscode from 'vscode';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';
import { dynamicImport } from '../../utils/dynamicImport'; // Reverting to original relative path

// Define a type for the expected structure of the OpenRouter models API response
interface OpenRouterApiModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  top_provider: {
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  per_request_limits: {
    prompt_tokens: string; // Represented as strings in the API
    completion_tokens: string;
  } | null;
}

interface OpenRouterApiResponse {
  data: OpenRouterApiModel[];
}

// Cache for fetched models to avoid repeated API calls within a session
let cachedModels: ModelDefinition[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes cache

export const openRouterProvider: AiProvider = {
  id: 'openrouter',
  name: 'OpenRouter',
  requiresApiKey: true,
  apiKeyUrl: 'https://openrouter.ai/keys',
  secretStorageKey: 'zenCoder.openRouterApiKey',
  settingsEnabledKey: 'zencoder.provider.openrouter.enabled',

  /**
   * Creates an OpenRouter language model instance.
   */
  createModel(apiKey: string | undefined, modelId: string): LanguageModel {
    if (!apiKey) {
      throw new Error('OpenRouter API key is required.');
    }

    const openRouter = createOpenRouter({
      apiKey: apiKey,
      // baseURL: '...', // Optional: If using a different base URL
      // dangerouslyAllowBrowser: true, // Only if absolutely necessary and understood
    });

    // OpenRouter provider instance takes the model ID directly.
    // The model ID often includes the original provider, e.g., 'anthropic/claude-3.5-sonnet'
    return openRouter(modelId);
  },

  /**
   * Retrieves the list of available models from the OpenRouter API.
   * Uses caching to avoid excessive API calls.
   */
  async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
    const now = Date.now();
    if (cachedModels && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION_MS)) {
      console.log('Returning cached OpenRouter models.');
      return Promise.resolve(cachedModels);
    }

    if (!apiKey) {
      // Although the API doesn't strictly require a key for listing,
      // our design ties model listing to having a key for the provider.
      // If we wanted anonymous listing, this check would be removed.
      // Let's return an empty list or throw, consistent with needing a key to *use* the provider.
      console.warn('OpenRouter API key needed to fetch models (design choice). Returning empty list.');
      return Promise.resolve([]);
      // Or: throw new Error('OpenRouter API key is required to fetch available models.');
    }

    console.log('Fetching OpenRouter models from API...');
    try {
      // Use dynamic import for node-fetch
      const fetch = await dynamicImport('node-fetch');
      const response = await fetch.default('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          // OpenRouter API documentation indicates listing doesn't strictly require auth,
          // but including it is safer if policies change or for future authenticated endpoints.
          // 'Authorization': `Bearer ${apiKey}`, // Uncomment if auth becomes required
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch OpenRouter models: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OpenRouterApiResponse;

      // Filter out potential null/undefined entries and map to ModelDefinition
      const models: ModelDefinition[] = data.data
        .filter((model): model is OpenRouterApiModel => !!model && !!model.id && !!model.name)
        .map((model) => ({
          id: model.id,
          name: model.name, // Use the human-friendly name
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name

      cachedModels = models;
      cacheTimestamp = now;
      console.log(`Fetched and cached ${models.length} OpenRouter models.`);
      return models;

    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      // Decide on fallback behavior: return empty list or re-throw
      // Returning empty list might be safer for UI stability.
      cachedModels = null; // Clear cache on error
      cacheTimestamp = null;
      return Promise.resolve([]); // Return empty list on error
      // Or: throw error; // Re-throw the error
    }
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