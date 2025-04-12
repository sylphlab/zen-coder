import * as vscode from 'vscode';
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText, Tool, StepResult, ToolCallPart, ToolResultPart, StreamTextResult, ToolCall, ToolExecutionOptions, LanguageModel } from 'ai'; // Added LanguageModel
import { allTools, ToolName } from '../tools';
import { allProviders, providerMap, AiProvider, ModelDefinition } from './providers'; // Import new provider structure
// Import the specific execution logic, callback type, AND the standard tool definition
import { executeUuidGenerateWithProgress, UuidUpdateCallback, uuidGenerateTool as uuidGenerateToolDefinition } from '../tools/utils/uuidGenerate';

// SECRET_KEYS constant removed - managed by individual providers now.
 // Type combining static provider info and dynamic status
 export type ProviderInfoAndStatus = {
     id: string;
     name: string;
     apiKeyUrl?: string;
     requiresApiKey: boolean;
     enabled: boolean;
     apiKeySet: boolean;
 };
 // Keep original ProviderStatus type if needed elsewhere, or remove if fully replaced
 export type ProviderStatus = {
      enabled: boolean;
      apiKeySet: boolean;
  };

// Define ApiProviderKey based on provider IDs
// This assumes provider IDs match the keys previously used in SECRET_KEYS
// If IDs change, this might need adjustment or a different approach.
export type ApiProviderKey = typeof allProviders[number]['id'];

// Model list
const availableModelIds = [
    'claude-3-5-sonnet',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'openrouter/claude-3.5-sonnet',
    'deepseek-coder',
] as const;

type ModelId = typeof availableModelIds[number]; // Keep this for known IDs

// Define structure for resolved models
type ResolvedModel = {
    id: string; // The actual ID to use in API calls
    label: string; // User-friendly label
    provider: ApiProviderKey; // Associated provider
    source: 'api' | 'web-scrape' | 'hardcoded'; // Where the model info came from
};

// Define the expected structure for the MCP tool executor function
type McpToolExecutor = (serverName: string, toolName: string, args: any) => Promise<any>;

export class AiService {
    private currentModelId: string = 'claude-3-5-sonnet'; // Change to string to allow custom models
    private conversationHistory: CoreMessage[] = [];
    // In-memory API key properties removed - fetched JIT via provider modules.
    private postMessageCallback?: (message: any) => void;

    constructor(private context: vscode.ExtensionContext) {}

    public async initialize(): Promise<void> {
        // Initialization no longer needs to pre-load API keys into memory.
        // Keys will be fetched Just-In-Time (JIT) by the provider modules when needed.
        console.log('[AiService] Initializing... (API keys will be loaded on demand)');
        // Potential future initialization steps could go here (e.g., warming up caches)
        console.log('[AiService] Initialization complete.');
    }

    // --- Getters ---
    public getCurrentModelId(): string { return this.currentModelId; } // Return type changed to string
    public getConversationHistory(): CoreMessage[] { return [...this.conversationHistory]; }
    public getActiveToolNames(): ToolName[] { return this._getActiveToolNames(); }

    // --- Setters ---
    public setPostMessageCallback(callback: (message: any) => void): void {
        this.postMessageCallback = callback;
        console.log('AiService: postMessage callback registered.');
    }

    public setModel(modelId: string) {
        // Allow setting any string, but log a warning if it's not in the known/resolved list (implement later)
        this.currentModelId = modelId;
        console.log(`AI Model set to: ${modelId}`);
        // TODO: Add check against resolved models and log warning if not found
        this.conversationHistory = []; // Reset history when model changes
    }

    // --- Private Helpers ---
    // _isProviderEnabled removed - handled by provider.isEnabled() now.
 
    // Now returns a Promise as it needs to fetch the API key asynchronously
    private async _getProviderInstance(): Promise<LanguageModel | null> {
        console.log(`[AiService] _getProviderInstance called for model: ${this.currentModelId}`);
        const modelId = this.currentModelId;
        let providerId: string | null = null; // Use provider ID (string)
        let actualModelId = modelId;

        // 1. Determine Provider ID based on modelId pattern
        //    This logic remains largely the same, but assigns to providerId (string)
        if (modelId.startsWith('claude-')) {
            providerId = 'anthropic';
        } else if (modelId.startsWith('models/')) {
            providerId = 'google';
        } else if (modelId.startsWith('deepseek-')) {
            providerId = 'deepseek';
        } else if (modelId.includes('/')) { // Assume OpenRouter if it contains a slash
            providerId = 'openrouter';
            // OpenRouter model IDs often include the original provider, e.g., 'anthropic/claude-3.5-sonnet'
            // We pass the full ID to the OpenRouter provider.
        } else {
            console.error(`[AiService] Cannot determine provider for model ID: ${modelId} using pattern matching.`);
            // Consider trying to find the provider by checking which provider lists this model ID?
            // This would require calling getAvailableModels on all enabled providers first.
            // For now, fail if pattern doesn't match.
        }

        console.log(`[AiService] Determined provider ID: ${providerId}`);
        if (!providerId) {
            vscode.window.showErrorMessage(`無法從模型 ID "${modelId}" 判斷 Provider.`);
            return null;
        }

        // 2. Get Provider Implementation from Map
        const provider = providerMap.get(providerId);
        if (!provider) {
            console.error(`[AiService] Internal error: Provider implementation not found in map for ID: ${providerId}`);
            vscode.window.showErrorMessage(`內部錯誤：找不到 Provider ${providerId} 的實作。`);
            return null;
        }

        // 3. Check if the provider is enabled (using the provider's own method)
        const isEnabled = provider.isEnabled();
        console.log(`[AiService] Provider ${provider.name} enabled status from provider.isEnabled(): ${isEnabled}`);
        if (!isEnabled) {
            vscode.window.showErrorMessage(`Provider ${provider.name} 已在 Settings 頁面停用.`);
            return null;
        }

        // 4. Get API Key if required (using the provider's own method)
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


        // 5. Create Model Instance
        try {
            console.log(`[AiService] Creating model instance using provider '${provider.id}' for model '${actualModelId}'`);
            // Pass the potentially undefined apiKey (provider handles the check if required)
            const modelInstance = provider.createModel(apiKey, actualModelId);
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
            // Check if the tool exists in allTools before checking config
            if (allTools[toolName] && config.get<boolean>(`${toolName}.enabled`, true)) {
                activeToolNames.push(toolName);
            }
        }
        console.log("Active tools based on configuration:", activeToolNames);
        return activeToolNames;
    }

    // --- Core AI Interaction ---
    // Return type changed to include a promise for the final message
    public async getAiResponseStream(prompt: string, history: CoreMessage[] = []): Promise<{ stream: ReadableStream; finalMessagePromise: Promise<CoreMessage | null> } | null> {
        // Get model instance asynchronously
        const modelInstance = await this._getProviderInstance(); // Added await

        if (!modelInstance) {
            // Error handling remains the same, message already sent by _getProviderInstance if needed
            // Ensure history is cleaned up if needed and streaming state is reset in UI
             if (this.conversationHistory[this.conversationHistory.length - 1]?.role === 'user') {
                 this.conversationHistory.pop(); // Remove last user message if it exists
             }
            return null;
        }

        // Use the passed history, add the new user prompt
        const messagesForApi: CoreMessage[] = [...history, { role: 'user', content: prompt }];
        // Note: We are not updating this.conversationHistory here anymore,
        // the extension host will manage the canonical history.

        const activeToolNames = this._getActiveToolNames();
        const activeTools: Record<string, Tool<any, any>> = {};

        // --- Build activeTools, wrapping uuidGenerateTool ---
        for (const toolName of activeToolNames) {
            const originalToolDefinition = allTools[toolName];
            if (!originalToolDefinition) continue;

            if (toolName === 'uuidGenerateTool') {
                // Create the wrapped tool definition that conforms to the Tool type
                activeTools[toolName] = {
                    description: uuidGenerateToolDefinition.description,
                    parameters: uuidGenerateToolDefinition.parameters,
                    // This execute function is the wrapper
                    execute: async (args: any, options: ToolExecutionOptions): Promise<any> => { // Ensure return type matches SDK expectation
                        const toolCallId = options?.toolCallId;
                        if (!toolCallId) {
                            console.error("Wrapper Error: Missing toolCallId for uuidGenerateTool");
                            return { success: false, error: "Internal wrapper error: Missing toolCallId" };
                        }

                        // Check if the callback is available to send progress updates
                        if (this.postMessageCallback) {
                            // Create the updateCallback that uses postMessage
                            const updateCallback: UuidUpdateCallback = (update) => {
                                this.postMessageCallback!({ // Use non-null assertion
                                    type: 'uuidProgressUpdate', // Specific type for UI
                                    payload: update
                                });
                            };
                            // Call the function designed for progress updates
                            console.log(`Calling executeUuidGenerateWithProgress for ${toolCallId}`);
                            // IMPORTANT: Return the result from the progress function
                            const progressResult = await executeUuidGenerateWithProgress(args, { toolCallId, updateCallback });
                            // The progress function returns {success, error?}.
                            // We might need to return a placeholder or the final UUID array if the SDK expects it.
                            // For now, let's return the success/error status. The actual UUIDs are sent via callback.
                            // If SDK complains about missing result data later, we might need to adjust this return.
                            return progressResult;
                        } else {
                             // If no callback, execute the standard tool definition as a fallback
                             console.warn("postMessageCallback not set. Executing standard uuidGenerateTool.");
                             try {
                                 // Ensure the standard execute exists before calling
                                 if (typeof uuidGenerateToolDefinition.execute === 'function') {
                                     // Call the standard execute, which expects only args
                                     // Pass a minimal valid ToolExecutionOptions object for the fallback
                                     const fallbackOptions: ToolExecutionOptions = {
                                         toolCallId: options?.toolCallId || `fallback-${Date.now()}`, // Use original toolCallId if available, else generate one
                                         messages: [] // Provide empty messages array
                                     };
                                     const fallbackResult = await uuidGenerateToolDefinition.execute(args, fallbackOptions);
                                     return fallbackResult; // Return the final array of UUIDs
                                 } else {
                                     throw new Error("Standard execute function not found on uuidGenerateToolDefinition.");
                                 }
                             } catch (e: any) {
                                 console.error("Error during fallback execution:", e);
                                 return { success: false, error: e.message || "Fallback execution failed" };
                             }
                        }
                    }
                };
            } else {
                // For other tools, use the original definition directly
                activeTools[toolName] = originalToolDefinition;
            }
        } // End of for loop

        // --- Call streamText ---
        try {
            // Promise setup to capture the final message
            let resolveFinalMessagePromise: (value: CoreMessage | null) => void;
            const finalMessagePromise = new Promise<CoreMessage | null>((resolve) => {
                resolveFinalMessagePromise = resolve;
            });

            // Call streamText ONCE, configuring the onFinish callback
            const streamTextResult = await streamText({
                model: modelInstance,
                messages: messagesForApi, // Pass the constructed messages array
                tools: activeTools, // Pass the map containing original and wrapped tools
                maxSteps: 5, // Adjust as needed
                onFinish: async (event) => {
                    // Construct the final message object based on the event
                    const assistantContent: (ToolCallPart | { type: 'text'; text: string })[] = [];
                    if (event.text) {
                        assistantContent.push({ type: 'text', text: event.text });
                    }
                    if (event.toolCalls) {
                        assistantContent.push(...event.toolCalls);
                    }
                    // Note: Tool results are handled in separate 'tool' role messages

                    let finalAssistantMessage: CoreMessage | null = null;
                    if (assistantContent.length > 0) {
                         finalAssistantMessage = { role: 'assistant', content: assistantContent };
                    }

                    console.log("[AiService] Stream finished processing. Final assistant message:", finalAssistantMessage);
                    resolveFinalMessagePromise(finalAssistantMessage); // Resolve the promise with the final message
                },
                experimental_repairToolCall: async ({ toolCall, error, messages, system }) => {
                    console.warn(`Attempting to repair tool call for ${toolCall.toolName} due to error: ${error.message}`);
                    try {
                        const repairResult = await generateText({
                            model: modelInstance, system, messages: [
                                ...messages,
                                { role: 'assistant', content: [{ type: 'tool-call', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, args: toolCall.args }] },
                                { role: 'tool', content: [{ type: 'tool-result', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, result: `Error executing tool: ${error.message}. Please try again.` }] }
                            ],
                            tools: allTools, // Use original tools for repair
                        });
                        const newToolCall = repairResult.toolCalls.find(newTc => newTc.toolName === toolCall.toolName);
                        if (newToolCall) {
                            console.log(`Tool call ${toolCall.toolName} successfully repaired.`);
                            // Return the structure expected by the SDK for repair
                            return { toolCallType: 'function', toolCallId: toolCall.toolCallId, toolName: newToolCall.toolName, args: JSON.stringify(newToolCall.args) };
                        }
                        console.error(`Tool call repair failed for ${toolCall.toolName}: Model did not generate a new call.`); return null;
                    } catch (repairError: any) {
                        console.error(`Error during tool call repair attempt for ${toolCall.toolName}:`, repairError); return null;
                    }
                }
            }); // End of streamText call

            // Return the stream from the result and the promise
            return { stream: streamTextResult.toDataStream(), finalMessagePromise };
        } catch (error: any) {
            // Handle specific tool errors
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
            // Ensure history is cleaned up on general SDK errors too
            if (this.conversationHistory[this.conversationHistory.length - 1]?.role === 'user') {
                 this.conversationHistory.pop();
            }
            return null;
        }
    }

    // --- History Management --- (REMOVED - History is now managed by the extension host)
    // public addAssistantResponseToHistory(content: string | undefined) { ... }
    // public addToolCallToHistory(toolCall: ToolCallPart) { ... }
    // public addToolResultToHistory(toolResult: ToolResultPart) { ... }

    // --- API Key Management (Delegated to Providers) ---
    public async setApiKey(providerId: string, apiKey: string): Promise<void> {
        const provider = providerMap.get(providerId);
        if (!provider) {
            const errorMsg = `[AiService] Cannot set API key: Unknown provider ID '${providerId}'.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        if (!provider.requiresApiKey) {
             console.warn(`[AiService] Attempted to set API key for provider '${providerId}' which does not require one.`);
             // Optionally show a message or just ignore
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

    // getApiKey is no longer needed here, as keys are fetched JIT by _getProviderInstance

    public async deleteApiKey(providerId: string): Promise<void> {
         const provider = providerMap.get(providerId);
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

    // --- API Key Status ---
     // This method now needs to iterate through providers and call their getApiKey method
     public async getApiKeyStatus(): Promise<Record<string, boolean>> {
         const status: Record<string, boolean> = {};
         for (const provider of allProviders) {
             if (provider.requiresApiKey) {
                 try {
                     const key = await provider.getApiKey(this.context.secrets);
                     status[provider.id] = !!key; // Store boolean indicating if key is set
                 } catch (error) {
                     console.error(`[AiService] Error checking API key status for ${provider.name}:`, error);
                     status[provider.id] = false; // Assume not set if error occurs
                 }
             } else {
                 status[provider.id] = true; // Always true if no key is required
             }
         }
         console.log("[AiService] Calculated API Key Status:", status);
         return status;
     }

    // --- Provider Status ---
    // Now returns an array of objects containing both static info and dynamic status
    public async getProviderStatus(): Promise<ProviderInfoAndStatus[]> {
        const apiKeyStatusMap = await this.getApiKeyStatus(); // Fetches current key status map { providerId: boolean }
        const combinedStatusList: ProviderInfoAndStatus[] = [];

        for (const provider of allProviders) {
            const isEnabled = provider.isEnabled(); // Use provider's own method
            const hasApiKey = apiKeyStatusMap[provider.id] ?? false; // Get status from fetched map

            combinedStatusList.push({
                id: provider.id,
                name: provider.name,
                apiKeyUrl: provider.apiKeyUrl,
                requiresApiKey: provider.requiresApiKey,
                enabled: isEnabled,
                apiKeySet: hasApiKey,
            });
        }
        // Sort alphabetically by name for consistent UI order
        combinedStatusList.sort((a, b) => a.name.localeCompare(b.name));

        console.log("[AiService] Calculated Combined Provider Status List:", combinedStatusList);
        return combinedStatusList;
    }

    // --- Model Resolver ---
    // The hardcodedModels property has been removed.
    // Model resolution is now handled dynamically by iterating through providers
    // in the resolveAvailableModels method.

    public async resolveAvailableModels(): Promise<ResolvedModel[]> {
        const allResolvedModels: ResolvedModel[] = [];
        // Get the combined status list first
        const providerInfoList = await this.getProviderStatus();

        // Iterate through the combined list
        for (const providerInfo of providerInfoList) {
            // Use the status directly from the combined object
            const status = { enabled: providerInfo.enabled, apiKeySet: providerInfo.apiKeySet };
            const provider = providerMap.get(providerInfo.id); // Get the provider implementation if needed

            if (!provider) {
                 console.warn(`[AiService] Provider implementation not found for ID '${providerInfo.id}' during model resolution. Skipping.`);
                 continue; // Skip if provider implementation is missing for some reason
            }

            // Check if the provider is enabled and has an API key if required
            if (status?.enabled && (status.apiKeySet || !provider.requiresApiKey)) {
                try {
                    console.log(`[AiService] Fetching models for provider: ${provider.name}`);
                    // Get the API key for this provider using its own method
                    let apiKey: string | undefined;
                    if (provider.requiresApiKey) {
                        // Fetch the key only if required
                        apiKey = await provider.getApiKey(this.context.secrets);
                        // No need to check if apiKey is set here, as getAvailableModels handles it
                    }

                    // Call the provider's method to get models
                    const modelsFromProvider: ModelDefinition[] = await provider.getAvailableModels(apiKey);

                    // Map the result to the ResolvedModel structure
                    const resolvedPortion: ResolvedModel[] = modelsFromProvider.map(m => ({
                        id: m.id,
                        label: m.name, // Use the name from ModelDefinition
                        provider: provider.id as ApiProviderKey, // Store the provider ID
                        // Determine source based on provider implementation (OpenRouter fetches, others are hardcoded for now)
                        source: provider.id === 'openrouter' ? 'api' : 'hardcoded',
                    }));

                    allResolvedModels.push(...resolvedPortion);
                    console.log(`[AiService] Successfully fetched/retrieved ${resolvedPortion.length} models from ${provider.name}.`);

                } catch (error) {
                    console.error(`[AiService] Failed to fetch models for provider ${provider.name}:`, error);
                    vscode.window.showWarningMessage(`無法從 ${provider.name} 獲取模型列表。`);
                    // Optionally add hardcoded fallbacks specifically for this provider if needed
                    // e.g., addHardcodedForProvider(provider.id, allResolvedModels);
                }
            } else {
                 console.log(`[AiService] Skipping model fetch for disabled/keyless provider: ${provider.name}`);
            }
        }

        // Remove duplicates (e.g., if a hardcoded list contained something also fetched)
        // Using Map ensures the last occurrence wins if IDs collide, which is fine here.
        const uniqueModels = Array.from(new Map(allResolvedModels.map(m => [m.id, m])).values());

        // Sort the final list by label
        uniqueModels.sort((a, b) => a.label.localeCompare(b.label));

        console.log("[AiService] Final resolved available models:", uniqueModels.length); // Log count for brevity
        // console.log("[AiService] Final resolved available models:", uniqueModels); // Uncomment for full list if needed
        return uniqueModels;
    }
    // --- Helper to fetch OpenRouter Models --- (REMOVED - Logic now in openRouterProvider.ts)
} // End of AiService class