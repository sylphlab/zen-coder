import * as vscode from 'vscode';
// Import Output and the new schema
// Import necessary types, remove non-exported ones
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText, Tool, StepResult, ToolCallPart, ToolResultPart, StreamTextResult, ToolCall, ToolExecutionOptions, LanguageModel, Output, TextStreamPart, ToolSet, generateObject } from 'ai';
import { structuredAiResponseSchema, StructuredAiResponse } from '../common/types';
import { allTools, ToolName } from '../tools';
// Import Provider Classes and interface
import { AiProvider, ModelDefinition } from './providers/providerInterface';
import { AnthropicProvider } from './providers/anthropicProvider';
import { GoogleProvider } from './providers/googleProvider';
import { OpenRouterProvider } from './providers/openRouterProvider';
import { DeepseekProvider } from './providers/deepseekProvider';
import { OpenAiProvider } from './providers/openaiProvider';
import { OllamaProvider } from './providers/ollamaProvider';
// Import the specific execution logic, callback type, AND the standard tool definition
import { executeUuidGenerateWithProgress, UuidUpdateCallback, uuidGenerateTool as uuidGenerateToolDefinition } from '../tools/utils/uuidGenerate';
import z from 'zod';

// SECRET_KEYS constant removed - managed by individual providers now.
// ProviderInfoAndStatus moved to common/types.ts
// ProviderStatus type removed as ProviderInfoAndStatus is used.

// Define ApiProviderKey based on provider IDs
// This assumes provider IDs match the keys previously used in SECRET_KEYS
// If IDs change, this might need adjustment or a different approach.
// Re-export ApiProviderKey type derived from the instances
export type ApiProviderKey = AiService['allProviders'][number]['id'];
// Model list (Removed as models are resolved dynamically)
// const availableModelIds = [...]

// type ModelId = typeof availableModelIds[number]; // Keep this for known IDs (Removed)

// ResolvedModel type removed, AvailableModel from common/types.ts is used by ModelResolver.
// Define the expected structure for the MCP tool executor function
type McpToolExecutor = (serverName: string, toolName: string, args: any) => Promise<any>;

// Remove duplicate imports

// Remove AiServiceResponse definition

// HistoryManager import is not needed here

export class AiService {
    // currentModelId is still used for setModel, but not directly by getAiResponseStream
    private currentModelId: string = 'claude-3-5-sonnet';
    // conversationHistory is removed, as history is managed by the caller (extension.ts)
    // private conversationHistory: CoreMessage[] = [];
    private postMessageCallback?: (message: any) => void;

    // Store providers and map internally
    public readonly allProviders: AiProvider[];
    public readonly providerMap: Map<string, AiProvider>;

    constructor(private context: vscode.ExtensionContext) {
        // Instantiate all providers and create the map
        const providerClasses = [
            AnthropicProvider,
            GoogleProvider,
            OpenRouterProvider,
            DeepseekProvider,
            OpenAiProvider,
            OllamaProvider,
        ];
        this.allProviders = providerClasses.map(ProviderClass => new ProviderClass(context));
        this.providerMap = new Map(this.allProviders.map(provider => [provider.id, provider]));
        console.log(`[AiService] Initialized ${this.allProviders.length} providers.`);
    }

    public async initialize(): Promise<void> {
        console.log('[AiService] Initializing... (API keys will be loaded on demand)');
        console.log('[AiService] Initialization complete.');
    }

    // --- Getters ---
    public getCurrentModelId(): string { return this.currentModelId; }
    // getConversationHistory removed
    public getActiveToolNames(): ToolName[] { return this._getActiveToolNames(); }

    // --- Setters ---
    public setPostMessageCallback(callback: (message: any) => void): void {
        this.postMessageCallback = callback;
        console.log('AiService: postMessage callback registered.');
    }

    // setModel still updates the internal state, which might be used elsewhere or as a default
    public setModel(modelId: string) {
        this.currentModelId = modelId;
        console.log(`AI Model set to: ${modelId}`);
        // Resetting conversationHistory here is no longer needed as it's managed externally
    }

    // --- Private Helpers ---

    // Modified signature to accept providerId and modelId
    private async _getProviderInstance(providerId: string, modelId: string): Promise<LanguageModel | null> {
        console.log(`[AiService] _getProviderInstance called for provider: ${providerId}, model: ${modelId}`);
        // Use the passed providerId directly
        let actualModelId = modelId; // Use the passed modelId for creating the instance

        // 1. Determine Provider ID based on modelId pattern - REMOVED
        // Removed the logic that infers providerId from modelId pattern.

        // Use the passed providerId directly
        if (!providerId) {
             console.error(`[AiService] No providerId passed to _getProviderInstance.`);
             vscode.window.showErrorMessage(`內部錯誤：未提供 Provider ID。`);
             return null;
        }

        // 2. Get Provider Implementation from Map
        // Use the instance's providerMap
        const provider = this.providerMap.get(providerId);
        if (!provider) {
            console.error(`[AiService] Internal error: Provider implementation not found in map for ID: ${providerId}`);
            vscode.window.showErrorMessage(`內部錯誤：找不到 Provider ${providerId} 的實作。`);
            return null;
        }

        // 3. Check if the provider is enabled
        const isEnabled = provider.isEnabled();
        console.log(`[AiService] Provider ${provider.name} enabled status from provider.isEnabled(): ${isEnabled}`);
        if (!isEnabled) {
            vscode.window.showErrorMessage(`Provider ${provider.name} 已在 Settings 頁面停用.`);
            return null;
        }

        // 4. Get API Key if required
        let apiKey: string | undefined;
        if (provider.requiresApiKey) {
            try {
                apiKey = await provider.getApiKey(this.context.secrets);
                console.log(`[AiService] API key fetched for ${provider.name}: ${!!apiKey}`);
                if (!apiKey) {
                    vscode.window.showErrorMessage(`Provider ${provider.name} 缺少 API Key.`);
                    return null;
                }
            } catch (error: any) {
                 console.error(`[AiService] Error fetching API key for ${provider.name}:`, error);
                 vscode.window.showErrorMessage(`獲取 Provider ${provider.name} 的 API Key 時出錯: ${error.message}`);
                 return null;
            }
        } else {
             console.log(`[AiService] Provider ${provider.name} does not require an API key.`);
        }

        // 5. Create Model Instance using the correct modelId
        try {
            console.log(`[AiService] Creating model instance using provider '${provider.id}' for model '${actualModelId}'`);
            const modelInstance = provider.createModel(apiKey, actualModelId); // Use actualModelId
            console.log(`[AiService] Successfully created model instance for ${provider.id}/${actualModelId}`);
            return modelInstance;
        } catch (error: any) {
            console.error(`[AiService] Error creating model instance via provider '${provider.id}' for model '${actualModelId}':`, error);
            vscode.window.showErrorMessage(`創建模型實例時出錯 (${provider.name}): ${error.message}`);
            return null;
        }
    }

    private _getActiveToolNames(): ToolName[] {
        const config = vscode.workspace.getConfiguration('zencoder.tools');
        const activeToolNames: ToolName[] = [];
        for (const toolName of Object.keys(allTools) as ToolName[]) {
            if (allTools[toolName] && config.get<boolean>(`${toolName}.enabled`, true)) {
                activeToolNames.push(toolName);
            }
        }
        console.log("Active tools based on configuration:", activeToolNames);
        return activeToolNames;
    }

    // --- Core AI Interaction ---
    // Modified signature to accept modelId
    // Return StreamTextResult directly
    public async getAiResponseStream<TOOLS extends ToolSet, PARTIAL_OUTPUT>(
        prompt: string,
        history: CoreMessage[] = [],
        providerId: string, // Add providerId parameter
        modelId: string
    ) {
        const modelInstance = await this._getProviderInstance(providerId, modelId); // Pass providerId and modelId

        if (!modelInstance) {
            // Error handled in _getProviderInstance
            // History is managed by the caller (extension.ts)
            console.error("[AiService] Failed to get model instance. Cannot proceed with AI request.");
            throw new Error("Failed to get model instance. Cannot proceed with AI request.");
        }

        // Use the passed history, add the new user prompt
        const messagesForApi: CoreMessage[] = [...history]; // Use the translated history directly
        // The prompt is already included in the translated history by the caller (extension.ts) if it's the last message
        // If history is empty or last message isn't user, add prompt (though caller should handle this)
        if (messagesForApi.length === 0 || messagesForApi[messagesForApi.length - 1].role !== 'user') {
             console.warn("[AiService] History passed to getAiResponseStream doesn't end with user message. Adding prompt explicitly.");
             messagesForApi.push({ role: 'user', content: prompt });
        }


        const activeToolNames = this._getActiveToolNames();
        const activeTools = activeToolNames.reduce((acc, toolName) => {
            const toolDefinition = allTools[toolName];
            if (toolDefinition) {
                acc[toolName] = toolDefinition;
            } else {
                console.warn(`Tool ${toolName} not found in allTools.`);
            }
            return acc;
        }
        , {} as Record<ToolName, Tool>);

        // --- Call streamText ---
        try {
            // finalMessagePromise is removed. Caller will use streamTextResult.final()

            // Provide correct generic types for tools and the structured output schema
            // Use streamText without explicit generics for output schema due to type issues
            // Remove the first generic (tools), explicitly provide the second (output schema)
            // Remove all generics from streamText call
            const streamTextResult = await streamText({
                toolCallStreaming: true,
                model: modelInstance,
                messages: messagesForApi,
                tools: activeTools,
                // experimental_output removed - we will parse JSON from the end of the text stream
                maxSteps: 100,
                experimental_continueSteps: true,
                // Use 'any' for event type temporarily to bypass complex type checking issues with experimental_output
                // We will use optional chaining and safeParse inside
                // onFinish callback removed
                experimental_repairToolCall: async ({ toolCall, error, messages, system }) => {
                    const result = await generateText({
                        model: modelInstance,
                        system,
                        messages: [
                          ...messages,
                          {
                            role: 'assistant',
                            content: [
                              {
                                type: 'tool-call',
                                toolCallId: toolCall.toolCallId,
                                toolName: toolCall.toolName,
                                args: toolCall.args,
                              },
                            ],
                          },
                          {
                            role: 'tool' as const,
                            content: [
                              {
                                type: 'tool-result',
                                toolCallId: toolCall.toolCallId,
                                toolName: toolCall.toolName,
                                result: error.message,
                              },
                            ],
                          },
                        ],
                        tools: activeTools,
                      });
                  
                      const newToolCall = result.toolCalls.find(
                        newToolCall => newToolCall.toolName === toolCall.toolName,
                      );
                  
                      return newToolCall !== undefined
                        ? {
                            toolCallType: 'function' as const,
                            toolCallId: toolCall.toolCallId,
                            toolName: toolCall.toolName,
                            args: JSON.stringify(newToolCall.args),
                          }
                        : null;
                    },
            });

            // Return the StreamTextResult object directly
            return streamTextResult;
        } catch (error: any) {
            // ... (error handling remains the same)
             if (NoSuchToolError.isInstance(error)) {
                  console.error("Tool Error: Unknown tool:", error.toolName);
                  vscode.window.showErrorMessage(`Error: Unknown tool: ${error.toolName}`);
             } else if (InvalidToolArgumentsError.isInstance(error)) {
                  console.error("Tool Error: Invalid arguments:", error.toolName, error.message);
                  vscode.window.showErrorMessage(`Error: Invalid arguments for tool: ${error.toolName}`);
             } else if (ToolExecutionError.isInstance(error)) {
                  console.error("Tool Error: Execution error:", error.toolName, error.cause);
                  const causeMessage = (error.cause instanceof Error) ? error.cause.message : 'Unknown execution error';
                  vscode.window.showErrorMessage(`Error executing tool ${error.toolName}: ${causeMessage}`);
             } else {
                  console.error('Error calling AI SDK:', error);
                  vscode.window.showErrorMessage(`Error interacting with AI: ${error.message}`);
             }
             throw error; // Rethrow the error to be handled by the caller
        }
    }

    // --- API Key Management (Delegated to Providers) ---
    public async setApiKey(providerId: string, apiKey: string): Promise<void> {
        const provider = this.providerMap.get(providerId); // Use this.providerMap
        if (!provider) {
            const errorMsg = `[AiService] Cannot set API key: Unknown provider ID '${providerId}'.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!provider.requiresApiKey) {
             console.warn(`[AiService] Attempted to set API key for provider '${providerId}' which does not require one.`);
             return;
        }
        try {
            console.log(`[AiService] Delegating setApiKey for '${providerId}' to provider module.`);
            await provider.setApiKey(this.context.secrets, apiKey);
            console.log(`[AiService] API Key for ${provider.name} updated successfully.`);
            vscode.window.showInformationMessage(`API Key for ${provider.name} updated.`);
        } catch (error: any) {
            console.error(`[AiService] Error setting API Key for ${provider.name}:`, error);
            vscode.window.showErrorMessage(`Failed to store API key for ${provider.name} securely: ${error.message}`);
        }
    }

    public async deleteApiKey(providerId: string): Promise<void> {
         const provider = this.providerMap.get(providerId); // Use this.providerMap
         if (!provider) {
             const errorMsg = `[AiService] Cannot delete API key: Unknown provider ID '${providerId}'.`;
             console.error(errorMsg);
             throw new Error(errorMsg);
         }
         if (!provider.requiresApiKey) {
              console.warn(`[AiService] Attempted to delete API key for provider '${providerId}' which does not require one.`);
              return;
         }
         try {
             console.log(`[AiService] Delegating deleteApiKey for '${providerId}' to provider module.`);
             await provider.deleteApiKey(this.context.secrets);
             console.log(`[AiService] API Key for ${provider.name} deleted successfully.`);
             vscode.window.showInformationMessage(`API Key for ${provider.name} deleted.`);
         } catch (error: any) {
             console.error(`[AiService] Error deleting API Key for ${provider.name}:`, error);
             vscode.window.showErrorMessage(`Failed to delete API key for ${provider.name}: ${error.message}`);
         }
     }

    // --- API Key Status, Provider Status, and Model Resolver methods removed ---
    // These responsibilities are now handled by ProviderStatusManager and ModelResolver
} // End of AiService class