import * as vscode from 'vscode';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';
// import { fetchWithTimeout } from '../../utils/fetchWithTimeout'; // Removed import

// Removed hardcoded model list

export class DeepseekProvider implements AiProvider {
    readonly id = 'deepseek';
    readonly name = 'DeepSeek';
    readonly requiresApiKey = true;
    readonly apiKeyUrl = 'https://platform.deepseek.com/docs/getting-started/apply-for-an-api-key';
    readonly secretStorageKey = 'zenCoder.deepseekApiKey';
    readonly settingsEnabledKey = 'zencoder.provider.deepseek.enabled';

    // Store context for secretStorage access
    private _secretStorage: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this._secretStorage = context.secrets;
    }

    /**
     * Creates a DeepSeek language model instance.
     */
    createModel(apiKey: string | undefined, modelId: string): LanguageModel {
        const keyToUse = apiKey;
        if (!keyToUse) {
            throw new Error('DeepSeek API key is required to create a model instance but was not provided.');
        }

        try {
            const deepseek = createDeepSeek({
                apiKey: keyToUse,
            });
            // The deepseek provider instance from ai-sdk takes the model ID directly.
            return deepseek(modelId);
        } catch (error: any) {
             console.error(`Failed to create DeepSeek model instance for ${modelId}:`, error);
             throw new Error(`Failed to create DeepSeek model instance: ${error.message || error}`);
        }
    }

    /**
     * Retrieves the list of known available DeepSeek models.
     */
    async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
        const keyToUse = apiKey || await this.getApiKey(this._secretStorage);
        if (!keyToUse) {
            console.warn("[DeepseekProvider] API key not available for fetching models.");
            return [];
        }
        return await this._fetchModelsFromApi(keyToUse);
    }

    /**
     * Fetches the model list from the DeepSeek API.
     */
    private async _fetchModelsFromApi(apiKey: string): Promise<ModelDefinition[]> {
        const endpoint = 'https://api.deepseek.com/models';
        const timeoutMs = 10000;
        console.log(`[DeepseekProvider] Fetching from endpoint: ${endpoint}`);
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                signal: AbortSignal.timeout(timeoutMs)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[DeepseekProvider] Failed to fetch models: ${response.status} ${response.statusText}`, errorText);
                return [];
            }

            const jsonResponse: any = await response.json();
            if (!jsonResponse || !Array.isArray(jsonResponse.data)) {
                 console.error("[DeepseekProvider] Invalid API response format:", jsonResponse);
                 return [];
            }

            const models: ModelDefinition[] = jsonResponse.data
                .map((model: any) => ({
                    // Standardize the ID format
                    id: `${this.id}:${model.id}`,
                    name: model.id, // Use ID as name for DeepSeek
                }))
                .sort((a: ModelDefinition, b: ModelDefinition) => a.id.localeCompare(b.id));

            console.log(`[DeepseekProvider] Parsed ${models.length} models.`);
            return models;

        } catch (error: any) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                 console.error(`[DeepseekProvider] Error fetching models: Request timed out after ${timeoutMs}ms`);
            } else {
                 console.error("[DeepseekProvider] Error fetching models:", error);
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