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
                headers: {
                    'HTTP-Referrer': 'https://github.com/sylphlab/zen-coder',
                    'X-Title': 'zen-coder',
                },
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
            console.log('[OpenRouterProvider] Returning cached models.');
            return Promise.resolve(cachedModels);
        }

        const keyToUse = apiKey || await this.getApiKey(this._secretStorage);
        if (!keyToUse && this.requiresApiKey) {
            console.warn('[OpenRouterProvider] API key needed to fetch models. Returning empty list.');
            return Promise.resolve([]);
        }

        const models = await this._fetchModelsFromApi(keyToUse);
        if (models.length > 0) {
            cachedModels = models;
            cacheTimestamp = now;
            console.log(`[OpenRouterProvider] Fetched and cached ${models.length} models.`);
        } else {
            // Clear cache if fetch failed
            cachedModels = null;
            cacheTimestamp = null;
        }
        return models;
    }

    /**
     * Fetches the model list from the OpenRouter API.
     */
    private async _fetchModelsFromApi(apiKey: string | undefined): Promise<ModelDefinition[]> {
        console.log('[OpenRouterProvider] Fetching models from API...');
        const timeoutMs = 15000;
        try {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                method: 'GET',
                headers: {
                    ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(timeoutMs)
            });

            if (!response.ok) {
                 const errorText = await response.text();
                 console.error(`[OpenRouterProvider] Failed to fetch models: ${response.status} ${response.statusText}`, errorText);
                 return [];
            }

            const data = (await response.json()) as OpenRouterApiResponse;
            if (!data || !Array.isArray(data.data)) {
                console.error('[OpenRouterProvider] Invalid API response format:', data);
                return [];
            }

            const models: ModelDefinition[] = data.data
                .filter((model): model is OpenRouterApiModel => !!model && !!model.id && !!model.name)
                .map((model) => ({
                    // Standardize the ID format
                    id: `${this.id}:${model.id}`,
                    name: model.name,
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            return models;

        } catch (error: any) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                 console.error(`[OpenRouterProvider] Error fetching models: Request timed out after ${timeoutMs}ms`);
            } else {
                 console.error('[OpenRouterProvider] Error fetching models:', error);
            }
            return [];
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