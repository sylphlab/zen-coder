import * as vscode from 'vscode';
import { createVertex } from '@ai-sdk/google-vertex';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';
import { ProjectsClient } from '@google-cloud/resource-manager'; // Correct client for searching projects
// Use ModelServiceClient for listing publisher models
import { ModelServiceClient, protos } from '@google-cloud/aiplatform';
// import { LocationsClient } from 'google-gax'; // Reverted

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
   * in `@google-cloud/aiplatform` v4.1.0 (e.g., `modelServiceClient.listModels`, `listPublisherModels`, etc.)
   * and the correct response structure (`IPublisherModel` seems incorrect or lacks expected fields like `displayName`).
   * The Node.js SDK might differ significantly from the REST API documentation for this specific call.
   * Requires credentials, project ID, and location. Ensure service account has
   * `aiplatform.models.list` or `aiplatform.publisherModels.list` permission.
   */
  async getAvailableModels(credentialsObject?: any): Promise<ModelDefinition[]> {
    console.log(`[VertexProvider] getAvailableModels called. Provided credentials object: ${!!credentialsObject}`);
    console.warn('[VertexProvider] Dynamic model fetching is not yet correctly implemented due to SDK issues. Returning static list.');
    // Placeholder: Return static list until dynamic fetching is fixed.
    return [...KNOWN_VERTEX_MODELS];
  }

  /**
   * Fetches available Google Cloud projects accessible by the credentials.
   */
  async getAvailableProjects(credentialsJsonString?: string): Promise<{ id: string; name: string }[]> {
    if (!credentialsJsonString) {
      console.warn('[VertexProvider] Cannot fetch projects without credentials JSON.');
      return [];
    }
    try {
      const clientOptions = { credentials: JSON.parse(credentialsJsonString) };
      const projectsClient = new ProjectsClient(clientOptions); // Use ProjectsClient
      const [projects] = await projectsClient.searchProjects(); // Use correct client method
      console.log(`[VertexProvider] Fetched ${projects.length} projects.`);
      return projects
        .filter((p: any) => p.projectId && p.displayName) // Add 'any' type for filter param
        .map((p: any) => ({ id: p.projectId!, name: p.displayName! })) // Add 'any' type for map param
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)); // Add explicit types for sort params
    } catch (error) {
      console.error('[VertexProvider] Error fetching projects:', error);
      // Inform the user about potential permission issues
      vscode.window.showWarningMessage('Failed to fetch Google Cloud projects. Ensure the service account has "resourcemanager.projects.list" permission.');
      return [];
    }
  }

  /**
   * Fetches available Google Cloud locations.
   * Requires credentials and project ID.
   * TODO: Implement dynamic location fetching. Still facing issues finding the correct client/method
   * for `google.cloud.location.Locations` service within the available Node.js libraries.
   * Requires credentials and project ID. Ensure service account has `aiplatform.locations.list` or similar permission.
   */
  async getAvailableLocations(credentialsJsonString?: string, projectId?: string): Promise<{ id: string; name: string }[]> {
     if (!credentialsJsonString || !projectId) {
       console.warn('[VertexProvider] Cannot fetch locations without credentials JSON and Project ID.');
       return [];
     }
     console.warn(`[VertexProvider] Dynamic location fetching for project ${projectId} is not yet implemented due to SDK client issues. Returning empty list.`);
     // Placeholder: Return empty array until implemented
     return [];
  }


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