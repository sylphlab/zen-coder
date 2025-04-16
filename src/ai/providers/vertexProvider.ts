import * as vscode from 'vscode';
import { createVertex } from '@ai-sdk/google-vertex';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';

// Define known Vertex models (add more as needed)
// Note: IDs should match the actual model IDs used by the Vertex AI API
const KNOWN_VERTEX_MODELS: ModelDefinition[] = [
  { id: 'vertex:gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro Latest' },
  { id: 'vertex:gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash Latest' },
  { id: 'vertex:gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
  // Add other models like text-bison etc. if desired, prefixing ID with 'vertex:'
];

export class VertexProvider implements AiProvider {
  readonly id = 'vertex';
  readonly name = 'Google Vertex AI';
  readonly requiresApiKey = true; // Technically requires credentials, handled via getApiKey returning JSON string
  readonly apiKeyUrl = 'https://console.cloud.google.com/apis/credentials/serviceaccountkey';
  readonly apiKeyDescription = 'Requires a JSON key file content (Service Account). Paste the entire JSON content here.';
  readonly secretStorageKey = 'zenCoder.vertexCredentialsJson'; // Store the JSON string
  readonly settingsEnabledKey = 'zencoder.provider.vertex.enabled';
  readonly supportsImages = true; // Gemini Pro Vision supports images
  readonly supportsAudio = false; // Check specific model capabilities
  readonly supportsVideo = false; // Check specific model capabilities

  // Store context for secretStorage access
  private _secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this._secretStorage = context.secrets;
  }

  /**
   * Creates a Vertex language model instance.
   */
  createModel(credentialsJsonString: string | undefined, modelId: string): LanguageModel {
    if (!credentialsJsonString) {
      throw new Error('Vertex credentials (JSON string) are required to create a model instance but were not provided.');
    }

    let parsedCredentials: any;
    try {
      parsedCredentials = JSON.parse(credentialsJsonString);
    } catch (parseError) {
      console.error('[VertexProvider] Failed to parse credentials JSON string:', parseError);
      throw new Error('Failed to parse Vertex credentials JSON string.');
    }

    // Basic validation
    if (
      typeof parsedCredentials !== 'object' ||
      parsedCredentials === null ||
      !('client_email' in parsedCredentials) ||
      !('private_key' in parsedCredentials)
    ) {
      console.error('[VertexProvider] Invalid credentials structure: Missing client_email or private_key');
      throw new Error('Invalid Vertex credentials structure: Missing client_email or private_key.');
    }

    // Extract project and location if provided, otherwise let the SDK use defaults/env vars
    const project = parsedCredentials.project_id || undefined; // Common field in service account keys
    const location = parsedCredentials.location || undefined; // Allow overriding location

    console.log(`[VertexProvider] Creating Vertex instance with project: ${project}, location: ${location}`);

    try {
      const vertex = createVertex({
        project: project,
        location: location,
        googleAuthOptions: {
          credentials: parsedCredentials, // Pass the parsed object
        },
      });

      // The AI SDK expects the provider ID prefix to be removed from the modelId
      const actualModelId = modelId.startsWith(`${this.id}:`)
        ? modelId.substring(this.id.length + 1)
        : modelId;

      console.log(`[VertexProvider] Requesting model: ${actualModelId} (Original: ${modelId})`);
      // The instance returned by createVertex is the factory for models
      return vertex(actualModelId);
    } catch (error: any) {
      console.error(`[VertexProvider] Failed to create Vertex model instance for ${modelId}:`, error);
      throw new Error(`Failed to create Vertex model instance: ${error.message || error}`);
    }
  }

  /**
   * Retrieves the list of known available Vertex models.
   * TODO: Implement dynamic fetching if possible and desired.
   */
  async getAvailableModels(credentialsJsonString?: string): Promise<ModelDefinition[]> {
    // For now, return the static list regardless of credentials validity.
    // A more robust implementation might try a simple API call to verify credentials
    // before returning models, but that adds complexity and potential cost/rate limits.
    console.log(`[VertexProvider] getAvailableModels called. Provided credentials: ${!!credentialsJsonString}`);
    // Return a copy to prevent modification
    return [...KNOWN_VERTEX_MODELS];
  }

  // --- Interface methods using stored secretStorage ---

  async getApiKey(secretStorage: vscode.SecretStorage): Promise<string | undefined> {
    // Parameter secretStorage is ignored, use the instance's _secretStorage
    return await this._secretStorage.get(this.secretStorageKey);
  }

  async setApiKey(secretStorage: vscode.SecretStorage, apiKey: string): Promise<void> {
    // Parameter secretStorage is ignored, use the instance's _secretStorage
    // We expect 'apiKey' here to be the JSON string
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