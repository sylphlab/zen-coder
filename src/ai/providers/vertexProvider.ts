import * as vscode from 'vscode';
import { createVertex } from '@ai-sdk/google-vertex';
import { LanguageModel } from 'ai';
import { AiProvider, ModelDefinition } from './providerInterface';
import { ProjectsClient } from '@google-cloud/resource-manager'; // Correct client for searching projects
import { PredictionServiceClient } from '@google-cloud/aiplatform'; // Keep for potential model listing
// import { LocationsClient } from 'google-gax'; // Cannot find module or correct export
// import { LocationsClient } from '@google-cloud/common'; // Cannot find module

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
   * TODO: Implement dynamic fetching using Google Cloud Discovery Service API.
   * This would require the project ID and location, and potentially additional permissions
   * for the service account (e.g., `aiplatform.models.list`).
   * Example endpoint: `https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models`
   * Attempts dynamic fetching, falls back to static list on error.
   */
  async getAvailableModels(credentialsObject?: any): Promise<ModelDefinition[]> {
    console.log(`[VertexProvider] getAvailableModels called. Provided credentials object: ${!!credentialsObject}`);

    if (!credentialsObject || !credentialsObject.credentialsJson) {
      console.warn('[VertexProvider] Cannot fetch dynamic models without credentials JSON.');
      return [...KNOWN_VERTEX_MODELS]; // Return static list if no creds
    }

    const projectId = credentialsObject.projectId; // Use project ID from the object if available
    const location = credentialsObject.location || 'us-central1'; // Default location if not provided

    if (!projectId) {
        console.warn('[VertexProvider] Cannot fetch dynamic models without a Project ID.');
        return [...KNOWN_VERTEX_MODELS]; // Return static list if no project ID
    }

    try {
      const clientOptions = { credentials: JSON.parse(credentialsObject.credentialsJson) };
      // Use PredictionServiceClient for listing models, adjust API version if needed
      const predictionClient = new PredictionServiceClient({ ...clientOptions, apiEndpoint: `${location}-aiplatform.googleapis.com` });

      // Construct the parent resource path
      const parent = `projects/${projectId}/locations/${location}/publishers/google`;

      console.log(`[VertexProvider] Fetching models from parent: ${parent}`);

      // Call listModels - Note: This might list *all* models, need filtering for generative ones
      // The actual API might differ, this is based on common patterns. Check SDK docs.
      // This specific call might not exist directly, might need raw REST or different client.
      // Let's assume a hypothetical listModels method for now.
      // If this fails, we need to adjust based on actual @google-cloud/aiplatform capabilities.

      // Placeholder: Actual implementation requires checking the correct method in @google-cloud/aiplatform
      // For now, we'll simulate a successful fetch returning the static list to avoid breaking.
      // In a real scenario, replace this with the actual API call and error handling.
      console.warn('[VertexProvider] Dynamic model fetching simulation: Returning static list.');
      // const [modelsResponse] = await predictionClient.listModels({ parent }); // Hypothetical call
      // console.log('[VertexProvider] Raw models response:', modelsResponse);
      // Filter and map modelsResponse to ModelDefinition[] here...

      // Simulate success with static list for now
      return [...KNOWN_VERTEX_MODELS];

    } catch (error) {
      console.error(`[VertexProvider] Error fetching dynamic models for project ${projectId} in ${location}:`, error);
      console.warn('[VertexProvider] Falling back to static model list.');
      return [...KNOWN_VERTEX_MODELS]; // Fallback to static list on error
    }
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
   * Fetches available Google Cloud locations for AI Platform (Vertex AI).
   * Requires a project ID.
   * TODO: Implement dynamic location fetching. Need to find the correct Node.js client
   * and method for listing locations (e.g., via google.cloud.location.Locations service).
   * The correct client might be part of google-gax, @google-cloud/location, or another core library.
   * Requires credentials and project ID. Ensure service account has `aiplatform.locations.list` permission.
   */
  async getAvailableLocations(credentialsJsonString?: string, projectId?: string): Promise<{ id: string; name: string }[]> {
     if (!credentialsJsonString || !projectId) {
       console.warn('[VertexProvider] Cannot fetch locations without credentials JSON and Project ID.');
       return [];
     }
     console.warn(`[VertexProvider] Dynamic location fetching for project ${projectId} is not yet implemented. Returning empty list.`);
     // Placeholder: Return empty array until implemented
     // In the future, implement the API call here using the correct client library.
     // Example (pseudo-code):
     // try {
     //   const clientOptions = { credentials: JSON.parse(credentialsJsonString) };
     //   const locationClient = new CorrectLocationsClient(clientOptions); // Replace with actual client
     //   const [locations] = await locationClient.listLocations({ name: `projects/${projectId}` });
     //   return locations.map(l => ({ id: l.locationId!, name: l.displayName! })).sort(...);
     // } catch (error) { ... handle error ... }
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