import * as vscode from 'vscode';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';
// import { fetchWithTimeout } from '../../utils/fetchWithTimeout'; // Removed import

// Removed hardcoded model list

export class AnthropicProvider implements AiProvider {
    readonly id = 'anthropic';
    readonly name = 'Anthropic';
    readonly requiresApiKey = true;
    readonly apiKeyUrl = 'https://console.anthropic.com/settings/keys';
    readonly secretStorageKey = 'zenCoder.anthropicApiKey';
    readonly settingsEnabledKey = 'zencoder.provider.anthropic.enabled';

    // Store context for secretStorage access
    private _secretStorage: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this._secretStorage = context.secrets;
    }

    /**
     * Creates an Anthropic language model instance.
     */
    createModel(apiKey: string | undefined, modelId: string): LanguageModel {
        const keyToUse = apiKey; // Use the apiKey passed to createModel
        if (!keyToUse) {
            // Key is required
            throw new Error('Anthropic API key is required to create a model instance but was not provided.');
        }

        try {
            const anthropic = createAnthropic({
                apiKey: keyToUse,
            });
            // The instance returned by createAnthropic is the factory for models
            return anthropic(modelId);
        } catch (error: any) {
            console.error(`Failed to create Anthropic model instance for ${modelId}:`, error);
            throw new Error(`Failed to create Anthropic model instance: ${error.message || error}`);
        }
    }

    /**
     * Retrieves the list of known available Anthropic models.
     */
    async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
        console.log(`[AnthropicProvider] getAvailableModels called. Provided apiKey: ${!!apiKey}`);
        const keyToUse = apiKey || await this.getApiKey(this._secretStorage);
        console.log(`[AnthropicProvider] Using API key: ${keyToUse ? '******' + keyToUse.slice(-4) : 'Not found'}`);
        if (!keyToUse) {
            console.warn("[AnthropicProvider] API key not available for fetching Anthropic models.");
            return [];
        }
        return await this._fetchModelsFromApi(keyToUse);
    }

    /**
     * Fetches the model list from the Anthropic API.
     */
    private async _fetchModelsFromApi(apiKey: string): Promise<ModelDefinition[]> {
        const endpoint = 'https://api.anthropic.com/v1/models';
        const timeoutMs = 10000;
        console.log(`[AnthropicProvider] Fetching from endpoint: ${endpoint}`);
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(timeoutMs)
            });

            console.log(`[AnthropicProvider] API Response Status: ${response.status}`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to fetch Anthropic models: ${response.status} ${response.statusText}`, errorText);
                return [];
            }

            const jsonResponse: any = await response.json();
            if (!jsonResponse || !Array.isArray(jsonResponse.data)) {
                 console.error("[AnthropicProvider] Invalid response format from Anthropic /v1/models:", jsonResponse);
                 return [];
            }

            const models: ModelDefinition[] = jsonResponse.data
                .map((model: any) => ({
                    // Standardize the ID format
                    id: `${this.id}:${model.id}`,
                    name: model.display_name || model.id,
                }))
                .sort((a: ModelDefinition, b: ModelDefinition) => a.name.localeCompare(b.name));

            console.log(`[AnthropicProvider] Parsed ${models.length} models.`);
            return models;

        } catch (error: any) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                 console.error(`Error fetching Anthropic models: Request timed out after ${timeoutMs}ms`);
            } else {
                 console.error("Error fetching available Anthropic models:", error);
            }
            return [];
        }
    }
    // --- Interface methods using stored secretStorage ---

    async getApiKey(secretStorage: vscode.SecretStorage): Promise<string | undefined> {
        // Parameter secretStorage is ignored, use the instance's _secretStorage
        return await this._secretStorage.get(this.secretStorageKey);
    }

    async setApiKey(secretStorage: vscode.SecretStorage, apiKey: string): Promise<void> {
        // Parameter secretStorage is ignored, use the instance's _secretStorage
        await this._secretStorage.store(this.secretStorageKey, apiKey);
    }

    async deleteApiKey(secretStorage: vscode.SecretStorage): Promise<void> {
        // Parameter secretStorage is ignored, use the instance's _secretStorage
        await this._secretStorage.delete(this.secretStorageKey);
    }

    isEnabled(): boolean {
        const config = vscode.workspace.getConfiguration();
        return config.get<boolean>(this.settingsEnabledKey, true); // Default to true
    }
}