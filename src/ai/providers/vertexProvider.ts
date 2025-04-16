import * as vscode from 'vscode';
import { createVertex } from '@ai-sdk/google-vertex';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';
import { ProjectsClient } from '@google-cloud/resource-manager'; // Correct client for searching projects
// Use ModelServiceClient for listing publisher models
import { ModelServiceClient, protos } from '@google-cloud/aiplatform';
// import { LocationsClient } from 'google-gax'; // Reverted - Cannot find module or correct export

// Define known Vertex models (add more as needed) - Keep as fallback
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
  readonly apiKeyDescription = '需要服務帳戶的 JSON 密鑰文件內容。將整個 JSON 內容貼在此處。Project ID 和 Location 是可選的（如果留空，將嘗試從 JSON 或環境變量中讀取）。';
  readonly secretStorageKey = 'zenCoder.vertexCredentialsJson'; // Store the JSON string
  readonly settingsEnabledKey = 'zencoder.provider.vertex.enabled';
  readonly supportsImages = true; // Gemini Pro Vision supports images
  readonly supportsAudio = false; // Check specific model capabilities
  readonly supportsVideo = false; // Check specific model capabilities
  readonly usesComplexCredentials = true; // Explicitly mark as using complex credentials

  // Store context for secretStorage access
  private _secretStorage: vscode.SecretStorage;

  constructor(context: vscode.ExtensionContext) {
    this._secretStorage = context.secrets;
  }

  /**
   * Creates a Vertex language model instance.
   * Expects credentialsObject to contain { credentialsJson: string, projectId?: string, location?: string }
   */
  createModel(credentialsObject: any | undefined, modelId: string): LanguageModel {
    if (!credentialsObject || typeof credentialsObject !== 'object' || !credentialsObject.credentialsJson) {
      throw new Error('Vertex credentials object (with credentialsJson) is required but was not provided or invalid.');
    }

    const { credentialsJson, projectId, location } = credentialsObject;

    let parsedCredentials: any;
    try {
      parsedCredentials = JSON.parse(credentialsJson);
    } catch (parseError) {
      console.error('[VertexProvider] Failed to parse credentials JSON string:', parseError);
      throw new Error('Failed to parse Vertex credentials JSON string.');
    }

    // Basic validation of the parsed JSON content
    if (
      typeof parsedCredentials !== 'object' ||
      parsedCredentials === null ||
      !('client_email' in parsedCredentials) ||
      !('private_key' in parsedCredentials)
    ) {
      console.error('[VertexProvider] Invalid credentials JSON structure: Missing client_email or private_key');
      throw new Error('Invalid Vertex credentials JSON structure: Missing client_email or private_key.');
    }

    // Use provided project/location, fallback to JSON content, then undefined (SDK default)
    const effectiveProjectId = projectId || parsedCredentials.project_id || undefined;
    const effectiveLocation = location || parsedCredentials.location || undefined; // Allow overriding location from JSON

    console.log(`[VertexProvider] Creating Vertex instance with project: ${effectiveProjectId}, location: ${effectiveLocation}`);

    try {
      const vertex = createVertex({
        project: effectiveProjectId,
        location: effectiveLocation,
        googleAuthOptions: {
          credentials: parsedCredentials, // Pass the parsed JSON object
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
   * TODO: Implement dynamic model fetching. Requires investigating the correct method
   * in `@google-cloud/aiplatform` v4.1.0 (e.g., `modelServiceClient.listModels` or similar)
   * and the correct response structure to extract model ID and display name.
   * The `publishers.models.list` endpoint might require a different client or method call
   * than initially assumed (`listPublisherModelsAsync` seems incorrect for this SDK version).
   * Requires credentials, project ID, and location. Ensure service account has
   * `aiplatform.models.list` or `aiplatform.publisherModels.list` permission.
   */
  async getAvailableModels(credentialsObject?: any): Promise<ModelDefinition[]> {
    console.log(`[VertexProvider] getAvailableModels called. Provided credentials object: ${!!credentialsObject}`);
    console.warn('[VertexProvider] Dynamic model fetching is not yet correctly implemented. Returning static list.');
    // Placeholder: Return static list until dynamic fetching is fixed.
    return [...KNOWN_VERTEX_MODELS];
  }

  // Removed getAvailableProjects and getAvailableLocations methods

  // --- Interface methods using stored secretStorage ---

  /**
   * Retrieves the credentials object { credentialsJson: string, projectId?: string, location?: string }
   * stored as a JSON string in secret storage.
   */
  async getApiKey(secretStorage: vscode.SecretStorage): Promise<string | undefined> {
    // Parameter secretStorage is ignored, use the instance's _secretStorage
    // Returns the JSON *string* representation of the credentials object
    return await this._secretStorage.get(this.secretStorageKey);
  }

  /**
   * Stores the credentials object { credentialsJson: string, projectId?: string, location?: string }
   * as a JSON string in secret storage.
   * The 'apiKey' parameter here is expected to be the JSON string representation of the object.
   */
  async setApiKey(secretStorage: vscode.SecretStorage, credentialsObjectJsonString: string): Promise<void> {
    // Parameter secretStorage is ignored, use the instance's _secretStorage
    // We expect 'credentialsObjectJsonString' here to be the JSON string of the object
    await this._secretStorage.store(this.secretStorageKey, credentialsObjectJsonString);
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