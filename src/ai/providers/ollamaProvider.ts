import * as vscode from 'vscode';
import { LanguageModel, CoreMessage, tool, GenerateTextResult, StreamTextResult } from 'ai'; // Removed GenerateTextParams, StreamTextParams
import { createOllama } from 'ollama-ai-provider'; // Import the actual package
import { AiProvider, ModelDefinition } from './providerInterface';

// Placeholder for Ollama SDK instance type
type OllamaInstance = any; // Replace with actual type if SDK is found

export class OllamaProvider implements AiProvider { // Add export back to class
    readonly id = 'ollama';
    readonly name = 'Ollama';
    readonly requiresApiKey = false; // Ollama typically runs locally without API key
    readonly secretStorageKey = 'zencoder.ollamaApiKey'; // Not strictly needed, but defined by interface
    readonly settingsEnabledKey = 'zencoder.provider.ollama.enabled';
    // readonly apiKeyUrl = undefined; // No API key URL

    private _context: vscode.ExtensionContext;
    private _ollamaInstance: OllamaInstance | null = null;
    private _ollamaEndpoint: string;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        // TODO: Make endpoint configurable via settings
        this._ollamaEndpoint = vscode.workspace.getConfiguration('zencoder.provider.ollama').get<string>('endpoint', 'http://localhost:11434');
    }

    isEnabled(): boolean {
        return vscode.workspace.getConfiguration().get<boolean>(this.settingsEnabledKey, true); // Default to enabled
    }

    // API Key methods are required by interface, but likely no-op for Ollama
    async getApiKey(secretStorage: vscode.SecretStorage): Promise<string | undefined> {
        // Ollama doesn't use API keys in the traditional sense
        return Promise.resolve(undefined);
    }

    async setApiKey(secretStorage: vscode.SecretStorage, apiKey: string): Promise<void> {
        // No-op
        console.warn("Ollama provider does not use API keys.");
        return Promise.resolve();
    }

    async deleteApiKey(secretStorage: vscode.SecretStorage): Promise<void> {
        // No-op
        return Promise.resolve();
    }

    // --- createModel Implementation ---
    createModel(apiKey: string | undefined, modelId: string, options?: any): LanguageModel {
        // Since Ollama doesn't use API keys, apiKey is ignored.
        // We use the createOllama function from the SDK package.
        if (!this.isEnabled()) {
             throw new Error("Ollama provider is disabled.");
        }
        try {
            
            // Create the Ollama provider instance, configuring the base URL
            const ollamaInstance = createOllama({
                baseURL: this._ollamaEndpoint + '/api', // Set the base URL for the Ollama API
            });

            console.log(`Creating Ollama model instance for ${modelId} at ${this._ollamaEndpoint}`);

            // The ollamaInstance function takes the modelId and options directly
            return ollamaInstance(modelId, {
                ...options,
                simulateStreaming: true, // Enable streaming simulation if needed
            }); // Pass modelId and options to the instance
        } catch (error: any) {
            console.error(`Failed to create Ollama model instance for ${modelId} at ${this._ollamaEndpoint}:`, error);
            throw new Error(`Failed to create Ollama model instance: ${error.message || error}`);
        }
    }

    // --- getAvailableModels Implementation ---
    async getAvailableModels(apiKey?: string): Promise<ModelDefinition[]> {
        if (!this.isEnabled()) {
            return [];
        }
        const endpoint = `${this._ollamaEndpoint}/api/tags`;
        const timeoutMs = 5000; // Shorter timeout for local service

        try {
            console.log(`Fetching Ollama models from: ${endpoint}`);
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(timeoutMs)
            });

            if (!response.ok) {
                // Handle common case where Ollama server isn't running
                if (response.status === 404 || response.status === 503) {
                     console.warn(`Ollama server not responding at ${this._ollamaEndpoint}. Status: ${response.status}`);
                     // Optionally notify user once?
                } else {
                    const errorText = await response.text();
                    console.error(`Failed to fetch Ollama models: ${response.status} ${response.statusText}`, errorText);
                }
                return []; // Return empty list on error
            }

            const jsonResponse: any = await response.json();

            if (!jsonResponse || !Array.isArray(jsonResponse.models)) {
                 console.error("Invalid response format from Ollama /api/tags:", jsonResponse);
                 return [];
            }

            const models: ModelDefinition[] = jsonResponse.models
                .map((model: any) => ({
                    id: model.name, // Ollama uses 'name' which includes tag, e.g., "llama3:latest"
                    name: model.name, // Use the full name as display name
                    // Add other details if needed, e.g., model.details.parameter_size
                }))
                .sort((a: ModelDefinition, b: ModelDefinition) => a.name.localeCompare(b.name));

            console.log(`Found ${models.length} Ollama models.`);
            return models;

        } catch (error: any) {
             if (error.name === 'TimeoutError' || error.name === 'AbortError') {
                 console.warn(`Error fetching Ollama models: Request timed out after ${timeoutMs}ms. Is Ollama running at ${this._ollamaEndpoint}?`);
             } else if (error.code === 'ECONNREFUSED') {
                 console.warn(`Error fetching Ollama models: Connection refused. Is Ollama running at ${this._ollamaEndpoint}?`);
             }
             else {
                 console.error("Error fetching available Ollama models:", error);
             }
            return [];
        }
    }
}
// Removed instance export and placeholder context