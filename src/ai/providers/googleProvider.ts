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

export class GoogleProvider implements AiProvider {
    readonly id = 'google';
    readonly name = 'Google Gemini';
    readonly requiresApiKey = true;
    readonly apiKeyUrl = 'https://aistudio.google.com/app/apikey';
    readonly secretStorageKey = 'zenCoder.googleApiKey';
    readonly settingsEnabledKey = 'zencoder.provider.google.enabled';

    // Store context for secretStorage access
    private _secretStorage: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this._secretStorage = context.secrets;
    }

    /**
     * Creates a Google Gemini language model instance.
     */
    createModel(apiKey: string | undefined, modelId: string): LanguageModel {
        const keyToUse = apiKey;
        if (!keyToUse) {
            throw new Error('Google API key is required to create a model instance but was not provided.');
        }
        // Validate if the modelId is one of the known ones (optional)
        // if (!GOOGLE_MODELS.some(m => m.id === modelId)) { // Keep hardcoded list for validation? Or remove? Let's remove for now.
        //     console.warn(`Google model '${modelId}' not in known list. Attempting to create anyway.`);
        // }

        try {
            const google = createGoogleGenerativeAI({
                apiKey: keyToUse,
            });
            // The google provider instance from ai-sdk takes the model ID directly.
            return google(modelId);
        } catch (error: any) {
             console.error(`Failed to create Google model instance for ${modelId}:`, error);
             throw new Error(`Failed to create Google model instance: ${error.message || error}`);
        }
    }

    /**
     * Retrieves the list of known available Google Gemini models.
     */
    async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
        // Google doesn't have a simple public API to list models dynamically easily.
        // Return the hardcoded list for now.
        // We could potentially try the discovery API if authenticated, but keep it simple.
        const GOOGLE_MODELS_STATIC: ModelDefinition[] = [
            { id: 'models/gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (latest)' },
            { id: 'models/gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (latest)' },
            { id: 'models/gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
        ];
        return Promise.resolve(GOOGLE_MODELS_STATIC);
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