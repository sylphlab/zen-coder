import { LanguageModel } from 'ai';
import * as vscode from 'vscode';

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
   * @param credentials - The credentials (API key string or complex object) required by some providers to list their available models. Passed as `undefined` if not needed or not set.
   * @param useStaticFallback - If true, return static data if dynamic fetching fails or is not implemented.
   * @returns A promise that resolves to an array of `ModelDefinition` objects.
   * @throws {Error} If credentials are required for fetching but not provided, or if the API request fails and `useStaticFallback` is false.
   */
  getAvailableModels(credentials?: any, useStaticFallback?: boolean): Promise<ModelDefinition[]>;

  /**
   * Optional: Provides a URL or information about where to obtain an API key for this provider.
   * Displayed in the settings UI to help users.
   */
  readonly apiKeyUrl?: string;

  /**
   * The key used to store this provider's API key in vscode.SecretStorage.
   */
  readonly secretStorageKey: string;

  /**
   * The key used in vscode settings (e.g., 'zencoder.provider.anthropic.enabled')
   * to control whether this provider is enabled.
   */
  readonly settingsEnabledKey: string;

  /**
   * Retrieves the API key for this provider from vscode.SecretStorage.
   * @param secretStorage - The vscode.SecretStorage instance.
   * @returns A promise resolving to the API key string or undefined if not set.
   */
  getApiKey(secretStorage: vscode.SecretStorage): Promise<string | undefined>;

  /**
   * Stores the API key for this provider in vscode.SecretStorage.
   * @param secretStorage - The vscode.SecretStorage instance.
   * @param apiKey - The API key string to store.
   * @returns A promise that resolves when the key is stored.
   */
  setApiKey(secretStorage: vscode.SecretStorage, apiKey: string): Promise<void>;

  /**
   * Deletes the API key for this provider from vscode.SecretStorage.
   * @param secretStorage - The vscode.SecretStorage instance.
   * @returns A promise that resolves when the key is deleted.
   */
  deleteApiKey(secretStorage: vscode.SecretStorage): Promise<void>;

  /**
   * Checks if the provider is enabled in the VS Code settings.
   * @returns True if enabled, false otherwise. Defaults to true if setting not found.
   */
  isEnabled(): boolean;

  // Optional future enhancement:
  // /**
  //  * Optional: Validates the provided API key, e.g., by making a simple test API call.
  //  * @param apiKey - The API key to validate.
  //  * @returns A promise resolving to true if the key is valid, false otherwise.
  //  */
  // validateApiKey?(apiKey: string): Promise<boolean>;
}