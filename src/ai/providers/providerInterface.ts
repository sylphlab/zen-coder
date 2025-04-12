import { LanguageModel } from 'ai';

/**
 * Defines the structure for representing an available AI model.
 */
export interface ModelDefinition {
  /** The unique identifier for the model (e.g., 'claude-3-5-sonnet-latest'). */
  id: string;
  /** A user-friendly name for the model (e.g., 'Claude 3.5 Sonnet'). */
  name: string;
  // Future potential properties: contextWindow?: number; capabilities?: string[]; etc.
}

/**
 * Defines the common interface that all AI provider modules must implement.
 */
export interface AiProvider {
  /**
   * A unique, machine-readable identifier for the provider (e.g., 'anthropic', 'google').
   * Used internally and for configuration keys.
   */
  readonly id: string;

  /**
   * A user-friendly name for the provider (e.g., 'Anthropic', 'Google Gemini').
   * Displayed in the UI.
   */
  readonly name: string;

  /**
   * Indicates whether this provider requires an API key for its operation.
   */
  readonly requiresApiKey: boolean;

  /**
   * Creates an instance of a specific language model provided by this provider.
   *
   * @param apiKey - The API key for the provider, passed as `undefined` if `requiresApiKey` is false or the key is not set.
   * @param modelId - The specific model identifier to instantiate (e.g., 'claude-3-5-sonnet-latest').
   * @param options - Optional provider-specific configuration options for model creation.
   * @returns An instance conforming to the Vercel AI SDK's `LanguageModel` interface.
   * @throws {Error} If an API key is required but not provided, if the modelId is invalid, or if model instantiation fails for other reasons.
   */
  createModel(apiKey: string | undefined, modelId: string, options?: any): LanguageModel;

  /**
   * Retrieves the list of models available from this provider.
   * This might involve an API call (requiring an API key for some providers) or return a predefined list.
   *
   * @param apiKey - The API key, required by some providers to list their available models. Passed as `undefined` if not needed or not set.
   * @returns A promise that resolves to an array of `ModelDefinition` objects.
   * @throws {Error} If an API key is required for fetching but not provided, or if the API request fails.
   */
  getAvailableModels(apiKey?: string): Promise<ModelDefinition[]>;

  /**
   * Optional: Provides a URL or information about where to obtain an API key for this provider.
   * Displayed in the settings UI to help users.
   */
  readonly apiKeyUrl?: string;

  // Optional future enhancement:
  // /**
  //  * Optional: Validates the provided API key, e.g., by making a simple test API call.
  //  * @param apiKey - The API key to validate.
  //  * @returns A promise resolving to true if the key is valid, false otherwise.
  //  */
  // validateApiKey?(apiKey: string): Promise<boolean>;
}