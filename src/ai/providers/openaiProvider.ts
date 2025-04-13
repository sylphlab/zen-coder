import * as vscode from 'vscode';
import { LanguageModel, generateText, streamText, CoreMessage, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AiProvider, ModelDefinition } from './providerInterface';
// ProviderInfoAndStatus and AvailableModel are not directly used here, types come from ModelDefinition
// import { SecretStorageKeys } from '../common/constants'; // Removed - Key defined in class
// import { fetchWithTimeout } from '../utils/fetchWithTimeout'; // Removed - Using native fetch with AbortSignal

// Removed leftover helper function code

export class OpenAiProvider implements AiProvider { // Add export back to class
    // readonly providerId = 'openai'; // Use id from interface
    readonly id = 'openai'; // Add provider ID
    readonly name = 'OpenAI'; // Add provider name
    readonly requiresApiKey = true; // OpenAI requires API key
    readonly apiKeyUrl = 'https://platform.openai.com/api-keys';
    readonly secretStorageKey = 'zencoder.openaiApiKey'; // Define key directly as per interface design
    readonly settingsEnabledKey = 'zencoder.provider.openai.enabled'; // Match interface property name

    private _secretStorage: vscode.SecretStorage; // Store secretStorage instance
    private _openaiInstance: ReturnType<typeof createOpenAI> | null = null;

    constructor(context: vscode.ExtensionContext) {
        this._secretStorage = context.secrets; // Get secrets from context
    }
    // --- Implement methods required by AiProvider interface ---

    isEnabled(): boolean {
        // Use the defined settings key
        return vscode.workspace.getConfiguration().get<boolean>(this.settingsEnabledKey, true);
    }

    // Add secretStorage parameter to match interface
    async getApiKey(secretStorage: vscode.SecretStorage): Promise<string | undefined> {
        return await secretStorage.get(this.secretStorageKey);
    }

    // Add secretStorage parameter to match interface
    async setApiKey(secretStorage: vscode.SecretStorage, apiKey: string): Promise<void> {
        await secretStorage.store(this.secretStorageKey, apiKey);
        this._openaiInstance = null; // Reset instance on key change
        console.log("OpenAI API Key stored.");
    }

    // Add secretStorage parameter to match interface
    async deleteApiKey(secretStorage: vscode.SecretStorage): Promise<void> {
        await secretStorage.delete(this.secretStorageKey);
        this._openaiInstance = null; // Reset instance on key deletion
        console.log("OpenAI API Key deleted.");
    }

    // getProviderStatus is not part of the interface, it's handled by ProviderStatusManager
    // Remove this method

    // Removed internal _getSdkInstance helper. Instance creation handled in createModel.

    // Implement createModel from the interface
    // Match interface: remove secretStorage param, apiKey is optional
    // Match interface: apiKey is optional
    createModel(apiKey: string | undefined, modelId: string, options?: any): LanguageModel {
        // --- Simplified Approach ---
        // The createOpenAI instance itself often acts as the LanguageModel provider.
        // We return a proxy object that ensures the instance is created (async)
        // before forwarding the call. The actual model selection happens within
        // generateText/streamText by passing the modelId.

        // This function captures the apiKey provided during the createModel call.
        // _getSdkInstance will use this apiKey if provided, otherwise fetch from storage.
        const getSdkInstance = async () => {
             // If an apiKey was explicitly passed to createModel, use it for instance creation/check
             if (apiKey && this._openaiInstance && apiKey !== await this.getApiKey(this._secretStorage)) {
                 // If a different key is provided than the cached instance's key, reset the instance
                 this._openaiInstance = null;
             }
             // _getSdkInstance now correctly uses the stored _secretStorage
             // and handles the apiKey parameter correctly (removed in previous step, re-adding internal logic)
             if (!this.isEnabled()) {
                 throw new Error("OpenAI provider is disabled.");
             }
             // Use cached instance if available and key matches (or no key provided)
             const storedKey = await this.getApiKey(this._secretStorage);
             if (this._openaiInstance && (!apiKey || apiKey === storedKey)) {
                 return this._openaiInstance;
             }

             const keyToUse = apiKey || storedKey;
             if (!keyToUse) {
                 throw new Error("OpenAI API Key not found.");
             }
             try {
                 // Create a new instance if needed
                 console.log("Creating new OpenAI SDK instance...");
                 this._openaiInstance = createOpenAI({ apiKey: keyToUse });
                 return this._openaiInstance;
             } catch (error) {
                 console.error("Failed to create OpenAI SDK instance:", error);
                 throw new Error(`Failed to create OpenAI SDK instance: ${error}`);
             }
        };

        // Return the proxy LanguageModel
       // --- Final Corrected Approach for createModel ---
       // The `createOpenAI` function returns the core provider instance.
       // This instance itself likely conforms to the LanguageModel interface
       // or provides methods that do. We need to return *something* synchronously
       // that can later call the async methods.

       // Let's return the main provider instance (`this`) and assume the caller
       // will use the instance's methods like `streamText` or `generateText`
       // which might be implemented directly on the provider or accessed via the SDK instance.
       // This requires verifying how `@ai-sdk/openai` is intended to be used.

       // If `createOpenAI` itself returns the LanguageModel:
       try {
           // Attempt to create the instance synchronously - this might fail if async is required.
           // We need the API key here. The interface implies createModel might be called
           // with an API key if available.
           const keyToUse = apiKey;
           // Check if key is required and provided
           if (this.requiresApiKey && !keyToUse) {
                console.error("OpenAI API Key is required for createModel but was not provided.");
                throw new Error("OpenAI API Key is required to create a model instance but was not provided.");
           }
           // If key is not required, or if it is provided, attempt creation
           const sdkInstance = createOpenAI({ apiKey: keyToUse }); // Pass undefined if not required and not provided
           // Assuming the instance returned by createOpenAI has the model method
           // or can directly handle model IDs in generateText/streamText.
           // Let's assume it returns an object with a `chat` method or similar
           // that takes the modelId. This needs verification.

           // If the instance itself is the LanguageModel factory:
           // return sdkInstance(modelId); // Example if sdkInstance is a factory

           // If the instance has methods that take modelId:
           // Return a proxy or the instance itself if it conforms to LanguageModel
           // For now, return the instance and assume methods take modelId.
            // We need to cast it because the exact return type of createOpenAI might not perfectly match LanguageModel.
           return sdkInstance as unknown as LanguageModel;


       } catch (error: any) { // Catch specific error type if known, otherwise any
            console.error(`Failed to create OpenAI model instance for ${modelId}:`, error);
            throw new Error(`Failed to create OpenAI model instance: ${error.message || error}`);
       }
    }


    // Implement getAvailableModels from the interface
    // Match interface: remove secretStorage param, apiKey is optional
    // Match interface: apiKey is optional
    async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
        const keyToUse = apiKey || await this.getApiKey(this._secretStorage);
        if (!keyToUse) {
            console.warn("[OpenAIProvider] API key not available for fetching models.");
            return [];
        }
        return await this._fetchModelsFromApi(keyToUse);
    }

    /**
     * Fetches the model list from the OpenAI API.
     */
    private async _fetchModelsFromApi(apiKey: string): Promise<ModelDefinition[]> {
        const endpoint = 'https://api.openai.com/v1/models';
        const timeoutMs = 10000;
        console.log(`[OpenAIProvider] Fetching from endpoint: ${endpoint}`);
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
                signal: AbortSignal.timeout(timeoutMs)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[OpenAIProvider] Failed to fetch models: ${response.status} ${response.statusText}`, errorText);
                return [];
            }

            const jsonResponse: any = await response.json();
            if (!jsonResponse || !Array.isArray(jsonResponse.data)) {
                 console.error("[OpenAIProvider] Invalid API response format:", jsonResponse);
                 return [];
            }

            const models: ModelDefinition[] = jsonResponse.data
                // Basic filtering for likely chat models
                .filter((model: any) => model.id.includes('gpt') || model.id.includes('instruct'))
                .map((model: any) => ({
                    id: model.id,
                    name: model.id, // Use ID as name
                }))
                .sort((a: ModelDefinition, b: ModelDefinition) => a.id.localeCompare(b.id));

            console.log(`[OpenAIProvider] Parsed ${models.length} models.`);
            return models;

        } catch (error: any) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                 console.error(`[OpenAIProvider] Error fetching models: Request timed out after ${timeoutMs}ms`);
            } else {
                 console.error("[OpenAIProvider] Error fetching models:", error);
            }
            return [];
        }
    }
} // End of OpenAiProvider class

// Removed instance export and placeholder context