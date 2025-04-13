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

export class OpenRouterProvider implements AiProvider {
    readonly id = 'openrouter';
    readonly name = 'OpenRouter';
    readonly requiresApiKey = true;
    readonly apiKeyUrl = 'https://openrouter.ai/keys';
    readonly secretStorageKey = 'zenCoder.openRouterApiKey';
    readonly settingsEnabledKey = 'zencoder.provider.openrouter.enabled';

    // Store context for secretStorage access
    private _secretStorage: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this._secretStorage = context.secrets;
    }

    /**
     * Creates an OpenRouter language model instance.
     */
    createModel(apiKey: string | undefined, modelId: string): LanguageModel {
        const keyToUse = apiKey;
        if (!keyToUse) {
            throw new Error('OpenRouter API key is required to create a model instance but was not provided.');
        }

        try {
            const openRouter = createOpenRouter({
                apiKey: keyToUse,
            });
            // OpenRouter provider instance takes the model ID directly.
            return openRouter(modelId);
        } catch (error: any) {
             console.error(`Failed to create OpenRouter model instance for ${modelId}:`, error);
             throw new Error(`Failed to create OpenRouter model instance: ${error.message || error}`);
        }
    }

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

        // Use provided key or fetch from storage
        const keyToUse = apiKey || await this.getApiKey(this._secretStorage);

        // Unlike other providers, OpenRouter listing might work without a key,
        // but let's keep the pattern of requiring it if the provider needs one for usage.
        if (!keyToUse && this.requiresApiKey) {
            console.warn('OpenRouter API key needed to fetch models (design choice). Returning empty list.');
            return Promise.resolve([]);
        }

        console.log('Fetching OpenRouter models from API...');
        const timeoutMs = 15000; // Slightly longer timeout for external API
        try {
            // Use dynamic import for node-fetch as it might still be needed if native fetch isn't available/suitable
            // Or switch to native fetch with AbortSignal if preferred and available
            // Let's try native fetch first
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                method: 'GET',
                headers: {
                    // Include Auth header even if not strictly required for listing, good practice
                    ...(keyToUse ? { 'Authorization': `Bearer ${keyToUse}` } : {}),
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(timeoutMs) // Use AbortSignal
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 console.error(`Failed to fetch OpenRouter models: ${response.status} ${response.statusText}`, errorText);
                 // Clear cache on error
                 cachedModels = null;
                 cacheTimestamp = null;
                 return []; // Return empty list on error
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

        } catch (error: any) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                 console.error(`Error fetching OpenRouter models: Request timed out after ${timeoutMs}ms`);
            } else {
                 console.error('Error fetching OpenRouter models:', error);
            }
            cachedModels = null; // Clear cache on error
            cacheTimestamp = null;
            return Promise.resolve([]); // Return empty list on error
        }
    }
    // --- Interface methods using stored secretStorage ---

    async getApiKey(secretStorage: vscode.SecretStorage): Promise<string | undefined> {
        return await this._secretStorage.get(this.secretStorageKey);
    }

    async setApiKey(secretStorage: vscode.SecretStorage, apiKey: string): Promise<void> {
        await this._secretStorage.store(this.secretStorageKey, apiKey);
    }

    async deleteApiKey(secretStorage: vscode.SecretStorage): Promise<void> {
        await this._secretStorage.delete(this.secretStorageKey);
    }

    isEnabled(): boolean {
        const config = vscode.workspace.getConfiguration();
        return config.get<boolean>(this.settingsEnabledKey, true); // Default to true
    }
}