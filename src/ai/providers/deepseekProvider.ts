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
        // Use provided key or fetch from storage
        const keyToUse = apiKey || await this.getApiKey(this._secretStorage);
        if (!keyToUse) {
            console.warn("API key not available for fetching DeepSeek models.");
            return [];
        }

        const endpoint = 'https://api.deepseek.com/models';
        const timeoutMs = 10000; // 10 seconds timeout
        try {
            const response = await fetch(endpoint, { // Use native fetch
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${keyToUse}`,
                },
                signal: AbortSignal.timeout(timeoutMs) // Use AbortSignal for timeout
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch DeepSeek models: ${response.status} ${response.statusText}`, errorText);
                return [];
            }

            const jsonResponse: any = await response.json();

            // According to docs, response structure is { object: 'list', data: [{ id, object, owned_by }] }
            if (!jsonResponse || !Array.isArray(jsonResponse.data)) {
                 console.error("Invalid response format from DeepSeek /models:", jsonResponse);
                 return [];
            }

            const models: ModelDefinition[] = jsonResponse.data
                .map((model: any) => ({
                    id: model.id,
                    name: model.id, // Use ID as name, API doesn't provide a display name
                }))
                 // Optional: Filter based on 'owned_by' or other properties if needed
                .sort((a: ModelDefinition, b: ModelDefinition) => a.id.localeCompare(b.id)); // Sort by id

            return models;

        } catch (error: any) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                 console.error(`Error fetching DeepSeek models: Request timed out after ${timeoutMs}ms`);
            } else {
                 console.error("Error fetching available DeepSeek models:", error);
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