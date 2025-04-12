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

// Model list (Removed as models are resolved dynamically)
// const availableModelIds = [...]

// type ModelId = typeof availableModelIds[number]; // Keep this for known IDs (Removed)

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
    // currentModelId is still used for setModel, but not directly by getAiResponseStream
    private currentModelId: string = 'claude-3-5-sonnet';
    // conversationHistory is removed, as history is managed by the caller (extension.ts)
    // private conversationHistory: CoreMessage[] = [];
    private postMessageCallback?: (message: any) => void;

    constructor(private context: vscode.ExtensionContext) {}

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

    // Modified signature to accept modelId
    private async _getProviderInstance(modelId: string): Promise<LanguageModel | null> {
        console.log(`[AiService] _getProviderInstance called for model: ${modelId}`);
        // Use the passed modelId directly
        let providerId: string | null = null;
        let actualModelId = modelId; // Use the passed modelId for creating the instance

        // 1. Determine Provider ID based on modelId pattern
        if (modelId.startsWith('claude-')) {
            providerId = 'anthropic';
        } else if (modelId.startsWith('models/')) {
            providerId = 'google';
            // Keep the full 'models/...' ID for Gemini
        } else if (modelId.startsWith('deepseek-')) {
            providerId = 'deepseek';
        } else if (modelId.includes('/')) { // Assume OpenRouter if it contains a slash
            providerId = 'openrouter';
            // Keep the full ID like 'openrouter/google/gemini-pro-1.5'
        } else {
            console.error(`[AiService] Cannot determine provider for model ID: ${modelId} using pattern matching.`);
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
    public async getAiResponseStream(prompt: string, history: CoreMessage[] = [], modelId: string): Promise<{ stream: ReadableStream; finalMessagePromise: Promise<CoreMessage | null> } | null> {
        // Get model instance asynchronously, passing the specific modelId
        const modelInstance = await this._getProviderInstance(modelId); // Pass modelId

        if (!modelInstance) {
            // Error handled in _getProviderInstance
            // History is managed by the caller (extension.ts)
            return null;
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
        const activeTools: Record<string, Tool<any, any>> = {};

        // --- Build activeTools, wrapping uuidGenerateTool ---
        for (const toolName of activeToolNames) {
            const originalToolDefinition = allTools[toolName];
            if (!originalToolDefinition) continue;

            if (toolName === 'uuidGenerateTool') {
                activeTools[toolName] = {
                    description: uuidGenerateToolDefinition.description,
                    parameters: uuidGenerateToolDefinition.parameters,
                    execute: async (args: any, options: ToolExecutionOptions): Promise<any> => {
                        const toolCallId = options?.toolCallId;
                        if (!toolCallId) {
                            console.error("Wrapper Error: Missing toolCallId for uuidGenerateTool");
                            return { success: false, error: "Internal wrapper error: Missing toolCallId" };
                        }
                        if (this.postMessageCallback) {
                            const updateCallback: UuidUpdateCallback = (update) => {
                                this.postMessageCallback!({ type: 'uuidProgressUpdate', payload: update });
                            };
                            console.log(`Calling executeUuidGenerateWithProgress for ${toolCallId}`);
                            return await executeUuidGenerateWithProgress(args, { toolCallId, updateCallback });
                        } else {
                             console.warn("postMessageCallback not set. Executing standard uuidGenerateTool.");
                             try {
                                 if (typeof uuidGenerateToolDefinition.execute === 'function') {
                                     const fallbackOptions: ToolExecutionOptions = { toolCallId: options?.toolCallId || `fallback-${Date.now()}`, messages: [] };
                                     return await uuidGenerateToolDefinition.execute(args, fallbackOptions);
                                 } else { throw new Error("Standard execute function not found."); }
                             } catch (e: any) {
                                 console.error("Error during fallback execution:", e);
                                 return { success: false, error: e.message || "Fallback execution failed" };
                             }
                        }
                    }
                };
            } else {
                activeTools[toolName] = originalToolDefinition;
            }
        } // End of for loop

        // --- Call streamText ---
        try {
            let resolveFinalMessagePromise: (value: CoreMessage | null) => void;
            const finalMessagePromise = new Promise<CoreMessage | null>((resolve) => {
                resolveFinalMessagePromise = resolve;
            });

            const streamTextResult = await streamText({
                model: modelInstance,
                messages: messagesForApi,
                tools: activeTools,
                maxSteps: 5,
                onFinish: async (event) => {
                    const assistantContent: (ToolCallPart | { type: 'text'; text: string })[] = [];
                    if (event.text) { assistantContent.push({ type: 'text', text: event.text }); }
                    if (event.toolCalls) { assistantContent.push(...event.toolCalls); }
                    let finalAssistantMessage: CoreMessage | null = null;
                    if (assistantContent.length > 0) {
                         finalAssistantMessage = { role: 'assistant', content: assistantContent };
                    }
                    console.log("[AiService] Stream finished processing. Final assistant message:", finalAssistantMessage);
                    resolveFinalMessagePromise(finalAssistantMessage);
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
                            tools: allTools,
                        });
                        const newToolCall = repairResult.toolCalls.find(newTc => newTc.toolName === toolCall.toolName);
                        if (newToolCall) {
                            console.log(`Tool call ${toolCall.toolName} successfully repaired.`);
                            return { toolCallType: 'function', toolCallId: toolCall.toolCallId, toolName: newToolCall.toolName, args: JSON.stringify(newToolCall.args) };
                        }
                        console.error(`Tool call repair failed for ${toolCall.toolName}: Model did not generate a new call.`); return null;
                    } catch (repairError: any) {
                        console.error(`Error during tool call repair attempt for ${toolCall.toolName}:`, repairError); return null;
                    }
                }
            });

            return { stream: streamTextResult.toDataStream(), finalMessagePromise };
        } catch (error: any) {
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
            // History is managed by the caller (extension.ts)
            return null;
        }
    }

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
     public async getApiKeyStatus(): Promise<Record<string, boolean>> {
         const status: Record<string, boolean> = {};
         for (const provider of allProviders) {
             if (provider.requiresApiKey) {
                 try {
                     const key = await provider.getApiKey(this.context.secrets);
                     status[provider.id] = !!key;
                 } catch (error) {
                     console.error(`[AiService] Error checking API key status for ${provider.name}:`, error);
                     status[provider.id] = false;
                 }
             } else {
                 status[provider.id] = true;
             }
         }
         console.log("[AiService] Calculated API Key Status:", status);
         return status;
     }

    // --- Provider Status ---
    public async getProviderStatus(): Promise<ProviderInfoAndStatus[]> {
        const apiKeyStatusMap = await this.getApiKeyStatus();
        const combinedStatusList: ProviderInfoAndStatus[] = [];

        for (const provider of allProviders) {
            const isEnabled = provider.isEnabled();
            const hasApiKey = apiKeyStatusMap[provider.id] ?? false;

            combinedStatusList.push({
                id: provider.id,
                name: provider.name,
                apiKeyUrl: provider.apiKeyUrl,
                requiresApiKey: provider.requiresApiKey,
                enabled: isEnabled,
                apiKeySet: hasApiKey,
            });
        }
        combinedStatusList.sort((a, b) => a.name.localeCompare(b.name));
        console.log("[AiService] Calculated Combined Provider Status List:", combinedStatusList);
        return combinedStatusList;
    }

    // --- Model Resolver ---
    public async resolveAvailableModels(): Promise<ResolvedModel[]> {
        const allResolvedModels: ResolvedModel[] = [];
        const providerInfoList = await this.getProviderStatus();

        for (const providerInfo of providerInfoList) {
            const status = { enabled: providerInfo.enabled, apiKeySet: providerInfo.apiKeySet };
            const provider = providerMap.get(providerInfo.id);

            if (!provider) {
                 console.warn(`[AiService] Provider implementation not found for ID '${providerInfo.id}' during model resolution. Skipping.`);
                 continue;
            }

            if (status?.enabled && (status.apiKeySet || !provider.requiresApiKey)) {
                try {
                    console.log(`[AiService] Fetching models for provider: ${provider.name}`);
                    let apiKey: string | undefined;
                    if (provider.requiresApiKey) {
                        apiKey = await provider.getApiKey(this.context.secrets);
                    }
                    const modelsFromProvider: ModelDefinition[] = await provider.getAvailableModels(apiKey);
                    const resolvedPortion: ResolvedModel[] = modelsFromProvider.map(m => ({
                        id: m.id,
                        label: m.name,
                        provider: provider.id as ApiProviderKey,
                        source: provider.id === 'openrouter' ? 'api' : 'hardcoded',
                    }));
                    allResolvedModels.push(...resolvedPortion);
                    console.log(`[AiService] Successfully fetched/retrieved ${resolvedPortion.length} models from ${provider.name}.`);
                } catch (error) {
                    console.error(`[AiService] Failed to fetch models for provider ${provider.name}:`, error);
                    vscode.window.showWarningMessage(`無法從 ${provider.name} 獲取模型列表。`);
                }
            } else {
                 console.log(`[AiService] Skipping model fetch for disabled/keyless provider: ${provider.name}`);
            }
        }

        const uniqueModels = Array.from(new Map(allResolvedModels.map(m => [m.id, m])).values());
        uniqueModels.sort((a, b) => a.label.localeCompare(b.label));
        console.log("[AiService] Final resolved available models:", uniqueModels.length);
        return uniqueModels;
    }
} // End of AiService class