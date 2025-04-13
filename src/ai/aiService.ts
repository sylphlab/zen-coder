import * as vscode from 'vscode';
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText, Tool, StepResult, ToolCallPart, ToolResultPart, StreamTextResult, ToolCall, ToolExecutionOptions, LanguageModel, Output, TextStreamPart, ToolSet, generateObject, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { structuredAiResponseSchema, StructuredAiResponse } from '../common/types';
import { allTools, ToolName } from '../tools';
import { AiProvider, ModelDefinition } from './providers/providerInterface';
import { AnthropicProvider } from './providers/anthropicProvider';
import { GoogleProvider } from './providers/googleProvider';
import { OpenRouterProvider } from './providers/openRouterProvider';
import { DeepseekProvider } from './providers/deepseekProvider';
import { OpenAiProvider } from './providers/openaiProvider';
import { OllamaProvider } from './providers/ollamaProvider';
import z from 'zod';
import { McpManager, McpServerStatus } from './mcpManager';
import * as path from 'path';
import { HistoryManager } from '../historyManager'; // Import HistoryManager

// Key for storing MCP tool overrides in globalState
const MCP_TOOL_OVERRIDES_KEY = 'mcpToolEnabledOverrides';

// Define ApiProviderKey based on provider IDs
export type ApiProviderKey = AiService['allProviders'][number]['id'];

export class AiService {
    // currentModelId is less relevant now, model is per-chat
    // private currentModelId: string = 'claude-3-5-sonnet';
    private postMessageCallback?: (message: any) => void;
    private activeAbortController: AbortController | null = null;

    public readonly allProviders: AiProvider[];
    public readonly providerMap: Map<string, AiProvider>;
    private mcpManager: McpManager;
    private historyManager: HistoryManager; // Add HistoryManager instance

    constructor(
        private context: vscode.ExtensionContext,
        historyManager: HistoryManager // Inject HistoryManager
    ) {
        this.historyManager = historyManager; // Store the instance

        // Instantiate all providers and create the map
        const providerClasses = [
            AnthropicProvider, GoogleProvider, OpenRouterProvider,
            DeepseekProvider, OpenAiProvider, OllamaProvider,
        ];
        this.allProviders = providerClasses.map(ProviderClass => new ProviderClass(context));
        this.providerMap = new Map(this.allProviders.map(provider => [provider.id, provider]));
        console.log(`[AiService] Initialized ${this.allProviders.length} providers.`);

        // Instantiate McpManager
        this.mcpManager = new McpManager(context, (msg) => this.postMessageCallback?.(msg));
    }

    public async initialize(): Promise<void> {
        console.log('[AiService] Initializing...');
        // McpManager initializes itself in its constructor.
        console.log('[AiService] Initialization complete.');
    }

    // --- Getters ---
    // getCurrentModelId is deprecated, use historyManager.getChatEffectiveConfig(chatId)
    // public getCurrentModelId(): string { return this.currentModelId; }

    // --- Setters ---
    public setPostMessageCallback(callback: (message: any) => void): void {
        this.postMessageCallback = callback;
        console.log('AiService: postMessage callback registered.');
    }

    // setModel is deprecated, use historyManager.updateChatSession(chatId, { config: ... })
    // public setModel(modelId: string) {
    //     this.currentModelId = modelId;
    //     console.log(`AI Model set to: ${modelId}`);
    // }

    // --- Private Helpers ---

    private async _getProviderInstance(providerId: string | undefined, modelId: string | undefined): Promise<LanguageModel | null> {
        console.log(`[AiService] _getProviderInstance called for provider: ${providerId}, model: ${modelId}`);

        if (!providerId) {
             console.error(`[AiService] No providerId provided.`);
             vscode.window.showErrorMessage(`錯誤：未指定 AI 提供者。`);
             return null;
        }
        if (!modelId) {
            console.error(`[AiService] No modelId provided for provider ${providerId}.`);
            vscode.window.showErrorMessage(`錯誤：未指定 AI 模型 (提供者: ${providerId})。`);
            return null;
       }

        const provider = this.providerMap.get(providerId);
        if (!provider) {
            console.error(`[AiService] Internal error: Provider implementation not found in map for ID: ${providerId}`);
            vscode.window.showErrorMessage(`內部錯誤：找不到 Provider ${providerId} 的實作。`);
            return null;
        }

        const isEnabled = provider.isEnabled();
        if (!isEnabled) {
            console.warn(`[AiService] Provider ${providerId} is disabled.`);
            // Don't show error message here, just return null if disabled
            return null;
        }

        let apiKey: string | undefined;
        if (provider.requiresApiKey) {
            try {
                apiKey = await provider.getApiKey(this.context.secrets);
                if (!apiKey) {
                    vscode.window.showErrorMessage(`Provider ${provider.name} 缺少 API Key。`);
                    return null;
                }
            } catch (error: any) {
                 console.error(`[AiService] Error fetching API key for ${provider.name}:`, error);
                 vscode.window.showErrorMessage(`獲取 Provider ${provider.name} 的 API Key 時出錯: ${error.message}`);
                 return null;
            }
        }

        try {
            // Split the modelId (which is expected to be providerId:modelName)
            let modelNameOnly = modelId;
            const separatorIndex = modelId.indexOf(':');
            if (separatorIndex > 0) {
                modelNameOnly = modelId.substring(separatorIndex + 1);
                console.log(`[AiService] Extracted model name '${modelNameOnly}' from full ID '${modelId}' for provider '${providerId}'`);
            } else {
                console.warn(`[AiService] Model ID '${modelId}' for provider '${providerId}' does not seem to follow 'providerId:modelName' format. Using original ID for provider.`);
                // Keep modelNameOnly as the original modelId in this case
            }

            // Pass only the model name part to the provider's createModel
            const modelInstance = provider.createModel(apiKey, modelNameOnly);
            console.log(`[AiService] Successfully created model instance for ${provider.id}/${modelNameOnly} (from ${modelId})`);
            return modelInstance;
        } catch (error: any) {
            console.error(`[AiService] Error creating model instance via provider '${provider.id}' for model '${modelId}':`, error);
            vscode.window.showErrorMessage(`創建模型實例時出錯 (${provider.name}): ${error.message}`);
            return null;
        }
    }

    /**
     * Prepares the combined and FILTERED toolset for the AI,
     * including enabled built-in tools and enabled MCP tools.
     */
    private _prepareToolSet(): ToolSet {
        const finalTools: ToolSet = {};
        // Unified key for storing enablement status of ALL tools
        const TOOL_ENABLED_STATUS_KEY = 'toolEnabledStatus';
        const toolEnabledStatus = this.context.globalState.get<{ [toolIdentifier: string]: boolean }>(TOOL_ENABLED_STATUS_KEY, {});

        // 1. Process Standard Tools
        const standardToolNames = Object.keys(allTools) as ToolName[];
        standardToolNames.forEach(toolName => {
            const toolDefinition = allTools[toolName];
            // Check enablement status in globalState, default to true if not found
            const isEnabled = toolEnabledStatus[toolName] !== false;
            if (toolDefinition && isEnabled) {
                finalTools[toolName] = toolDefinition;
            }
        });

        // 2. Process MCP Tools
        const mcpToolsMap = this.mcpManager.getMcpServerTools();
        for (const [serverName, tools] of mcpToolsMap.entries()) {
             for (const [mcpToolName, mcpToolDefinition] of Object.entries(tools)) {
                 // Use the unified format mcp_serverName_toolName everywhere
                 const unifiedIdentifier = `mcp_${serverName}_${mcpToolName}`;
                 // Check enablement status in globalState using the unified ID, default to true
                 const isEnabled = toolEnabledStatus[unifiedIdentifier] !== false;
                 if (isEnabled) {
                     finalTools[unifiedIdentifier] = mcpToolDefinition;
                 }
             }
        }

        // console.log(`[AiService] Total tools available for AI (filtered): ${Object.keys(finalTools).length}`);
        return finalTools;
    }

    /**
     * Loads global and project-specific custom instructions and merges them.
     * TODO: Consider adding chat-specific instructions later.
     */
    private async _loadCustomInstructions(): Promise<string> {
        let combinedInstructions = '';

        // 1. Load Global Instructions from VS Code Settings
        try {
            const globalInstructions = vscode.workspace.getConfiguration('zencoder.customInstructions').get<string>('global');
            if (globalInstructions && globalInstructions.trim()) {
                combinedInstructions += globalInstructions.trim();
                // console.log('[AiService] Loaded global custom instructions.'); // Reduce noise
            }
        } catch (error) {
            console.error('[AiService] Error reading global custom instructions setting:', error);
        }

        // 2. Load Project-Specific Instructions from .zen/custom_instructions.md
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const projectInstructionUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.zen', 'custom_instructions.md');
            try {
                const fileContent = await vscode.workspace.fs.readFile(projectInstructionUri);
                const projectInstructions = Buffer.from(fileContent).toString('utf8');
                if (projectInstructions && projectInstructions.trim()) {
                    if (combinedInstructions) {
                        combinedInstructions += '\n\n---\n\n'; // Add separator if global instructions exist
                    }
                    combinedInstructions += projectInstructions.trim();
                    // console.log(`[AiService] Loaded project custom instructions from: ${projectInstructionUri.fsPath}`); // Reduce noise
                }
            } catch (error: any) {
                if (error.code !== 'FileNotFound') {
                    console.error(`[AiService] Error reading project custom instructions file ${projectInstructionUri.fsPath}:`, error);
                    vscode.window.showWarningMessage(`Error reading project custom instructions from ${projectInstructionUri.fsPath}.`);
                }
            }
        }

        // if (combinedInstructions) {
        //      console.log(`[AiService] Combined custom instructions length: ${combinedInstructions.length}`); // Reduce noise
        // }

        return combinedInstructions;
    }

    // --- Core AI Interaction ---
    public async getAiResponseStream(
        chatId: string // Now requires chatId
        // Removed history, providerId, modelId parameters
    ): Promise<StreamTextResult<ToolSet, undefined>> { // Corrected return type

        // --- Get Chat-Specific Config and History ---
        const effectiveConfig = this.historyManager.getChatEffectiveConfig(chatId);
        // TODO: Update getChatEffectiveConfig to return providerId
        // TODO: Update getChatEffectiveConfig to return providerId and uncomment
        const effectiveProviderId = effectiveConfig.providerId; // Cast removed, type is now correct
        const effectiveModelId = effectiveConfig.chatModelId;

        if (!effectiveProviderId || !effectiveModelId) {
             const errorMsg = `[AiService] Could not determine effective provider/model for chat ${chatId}. Provider: ${effectiveProviderId}, Model: ${effectiveModelId}`;
             console.error(errorMsg);
             vscode.window.showErrorMessage(`無法確定聊天 ${chatId} 的有效 AI 提供者或模型。請檢查聊天設定或預設設定。`);
             throw new Error(errorMsg);
        }

        const modelInstance = await this._getProviderInstance(effectiveProviderId, effectiveModelId);

        if (!modelInstance) {
            console.error(`[AiService] Failed to get model instance for chat ${chatId} (Provider: ${effectiveProviderId}, Model: ${effectiveModelId}). Cannot proceed.`);
            // Error message already shown by _getProviderInstance
            throw new Error(`Failed to get model instance for chat ${chatId}.`);
        }

        const history = this.historyManager.translateUiHistoryToCoreMessages(chatId);
        const messagesForApi: CoreMessage[] = [...history]; // Start with history for this chat

        // --- Load and Prepend Custom Instructions ---
        const customInstructions = await this._loadCustomInstructions();
        if (customInstructions) {
            const systemMessageIndex = messagesForApi.findIndex(msg => msg.role === 'system');
            if (systemMessageIndex !== -1) {
                const existingMessage = messagesForApi[systemMessageIndex];
                 // Ensure content is treated as string for system/user/assistant roles
                 let existingContent = '';
                 if (typeof existingMessage.content === 'string') {
                     existingContent = existingMessage.content;
                 } else if (Array.isArray(existingMessage.content)) {
                     // Attempt to stringify array content, might need refinement
                     existingContent = existingMessage.content.map(part => typeof part === 'string' ? part : JSON.stringify(part)).join('\n');
                 }
                 // Explicitly construct the message to satisfy CoreMessage type
                 if (existingMessage.role === 'system') {
                     messagesForApi[systemMessageIndex] = { role: 'system', content: `${existingContent}\n\n---\n\n${customInstructions}` };
                 } else if (existingMessage.role === 'user') {
                      // This case might be less common, but handle defensively
                      messagesForApi[systemMessageIndex] = { role: 'user', content: `${existingContent}\n\n---\n\n${customInstructions}` };
                 } else if (existingMessage.role === 'assistant') {
                      // This case might be less common, but handle defensively
                      messagesForApi[systemMessageIndex] = { role: 'assistant', content: `${existingContent}\n\n---\n\n${customInstructions}` };
                 } else {
                      // Fallback if role is unexpected (e.g., 'tool'), prepend instead
                      console.warn(`[AiService] Unexpected role '${existingMessage.role}' found at system message index. Prepending new system message.`);
                      messagesForApi.unshift({ role: 'system', content: customInstructions });
                 }

                // console.log(`[AiService] Appended custom instructions to existing message for chat ${chatId}.`); // Reduce noise
            } else {
                messagesForApi.unshift({ role: 'system', content: customInstructions });
                // console.log(`[AiService] Prepended custom instructions as new system message for chat ${chatId}.`); // Reduce noise
            }
        }

        const enabledTools = this._prepareToolSet(); // Get the filtered toolset

        // --- Add logging here ---
        console.log('[AiService] Enabled tools being passed to AI:', Object.keys(enabledTools));
        // --- End logging ---

        // --- Call streamText ---
        if (this.activeAbortController) {
            console.warn('[AiService] Found existing AbortController before starting new stream. Aborting previous.');
            this.activeAbortController.abort('New stream started');
        }
        this.activeAbortController = new AbortController();
        const abortSignal = this.activeAbortController.signal;

        try {
            console.log(`[AiService] Starting streamText for chat ${chatId} with model ${effectiveProviderId}/${effectiveModelId}`);
            const streamTextResult = await streamText({
                toolCallStreaming: true,
                model: modelInstance,
                messages: messagesForApi,
                tools: enabledTools,
                maxSteps: 100,
                abortSignal: abortSignal,
                experimental_continueSteps: true,
                onFinish: async ({ text, toolCalls, toolResults, finishReason, usage }) => {
                    console.log(`[AiService] streamText finished for chat ${chatId}. Reason: ${finishReason}`);
                    if (this.activeAbortController?.signal === abortSignal) {
                         this.activeAbortController = null; // Clear the controller only if it's the one for this stream
                    }
                },
                experimental_repairToolCall: async ({
                    toolCall,
                    tools,
                    error,
                    messages,
                    system,
                  }) => {
                    console.warn(`[AiService] Attempting to repair tool call ${toolCall.toolName} for chat ${chatId}. Error: ${error.message}`);
                    // Repair logic might need adjustment if it relies on having ALL tools available
                    // For now, assume it works with the filtered set.
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
                              toolName: toolCall.toolName, // This might be the prefixed name for MCP tools
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
                              result: error.message, // Provide error message as result for repair context
                            },
                          ],
                        },
                      ],
                      tools, // Pass the filtered set to repair attempt
                    });

                    const newToolCall = result.toolCalls.find(
                      newToolCall => newToolCall.toolName === toolCall.toolName,
                    );

                    if (newToolCall !== undefined) {
                        console.log(`[AiService] Tool call ${toolCall.toolName} repaired for chat ${chatId}.`);
                        return {
                            toolCallType: 'function' as const,
                            toolCallId: toolCall.toolCallId,
                            toolName: toolCall.toolName,
                            args: JSON.stringify(newToolCall.args), // Ensure args are stringified
                        };
                    } else {
                         console.error(`[AiService] Failed to repair tool call ${toolCall.toolName} for chat ${chatId}.`);
                         return null; // Indicate repair failed
                    }
                  },
            });
            return streamTextResult;
        } catch (error: any) {
            console.error(`[AiService] Error during streamText execution for chat ${chatId}:`, error);
             if (NoSuchToolError.isInstance(error)) {
                  vscode.window.showErrorMessage(`錯誤：未知的工具: ${error.toolName}`);
             } else if (InvalidToolArgumentsError.isInstance(error)) {
                  vscode.window.showErrorMessage(`錯誤：工具參數無效: ${error.toolName}`);
             } else if (ToolExecutionError.isInstance(error)) {
                  const causeMessage = (error.cause instanceof Error) ? error.cause.message : 'Unknown execution error';
                  vscode.window.showErrorMessage(`執行工具 ${error.toolName} 時出錯: ${causeMessage}`);
             } else if (error.name === 'AbortError') {
                 console.log(`[AiService] Stream aborted for chat ${chatId}.`);
                 // Don't show error message for user-initiated abort
             } else {
                  vscode.window.showErrorMessage(`與 AI 互動時出錯: ${error.message}`);
             }
             throw error; // Rethrow the error
        } finally {
            // Ensure the controller is cleared only if it's the one for this stream and hasn't been cleared by onFinish/abort
            if (this.activeAbortController?.signal === abortSignal) {
                this.activeAbortController = null;
                console.log(`[AiService] Active AbortController cleared in finally block for chat ${chatId}.`);
            }
        }
    }

    // --- API Key Management (Delegated to Providers) ---
    // These methods remain unchanged as they operate on provider level, not chat level.
    public async setApiKey(providerId: string, apiKey: string): Promise<void> {
        const provider = this.providerMap.get(providerId);
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
            await provider.setApiKey(this.context.secrets, apiKey);
            console.log(`[AiService] API Key for ${provider.name} updated successfully.`);
            vscode.window.showInformationMessage(`API Key for ${provider.name} updated.`);
        } catch (error: any) {
            console.error(`[AiService] Error setting API Key for ${provider.name}:`, error);
            vscode.window.showErrorMessage(`Failed to store API key for ${provider.name} securely: ${error.message}`);
        }
    }

    public async deleteApiKey(providerId: string): Promise<void> {
         const provider = this.providerMap.get(providerId);
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
             await provider.deleteApiKey(this.context.secrets);
             console.log(`[AiService] API Key for ${provider.name} deleted successfully.`);
             vscode.window.showInformationMessage(`API Key for ${provider.name} deleted.`);
         } catch (error: any) {
             console.error(`[AiService] Error deleting API Key for ${provider.name}:`, error);
             vscode.window.showErrorMessage(`Failed to delete API key for ${provider.name}: ${error.message}`);
         }
     }

   // --- Stream Control ---
   // This remains global for now, aborts the single active stream regardless of chat.
   public abortCurrentStream(): void {
       if (this.activeAbortController) {
           console.log('[AiService] Aborting current AI stream...');
           this.activeAbortController.abort('User requested cancellation');
           this.activeAbortController = null; // Clear immediately after aborting
           console.log('[AiService] Stream aborted.');
       } else {
           console.warn('[AiService] Attempted to abort stream, but no active stream found.');
       }
   }

   // --- Public Methods Delegating to McpManager ---
   // These remain unchanged.
    public getMcpServerConfiguredStatus(): { [serverName: string]: McpServerStatus } {
        return this.mcpManager.getMcpServerConfiguredStatus();
    }

    public async retryMcpConnection(serverName: string): Promise<void> {
        await this.mcpManager.retryMcpConnection(serverName);
    }

    // Dispose McpManager when AiService is disposed
    public dispose(): void {
        console.log("[AiService] Disposing AiService...");
        this.mcpManager.dispose();
        console.log("[AiService] AiService disposed.");
    }
}
