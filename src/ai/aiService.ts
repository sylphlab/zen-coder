import * as vscode from 'vscode';
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText, Tool, StepResult, ToolCallPart, ToolResultPart, StreamTextResult, ToolCall, ToolExecutionOptions, LanguageModel, Output, TextStreamPart, ToolSet, generateObject, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { structuredAiResponseSchema, StructuredAiResponse } from '../common/types'; // Assuming this path is correct
import { allTools, ToolName } from '../tools'; // Assuming this path is correct
import { AiProvider, ModelDefinition } from './providers/providerInterface';
import { AnthropicProvider } from './providers/anthropicProvider';
import { GoogleProvider } from './providers/googleProvider';
import { OpenRouterProvider } from './providers/openRouterProvider';
import { DeepseekProvider } from './providers/deepseekProvider';
import { OpenAiProvider } from './providers/openaiProvider';
import { OllamaProvider } from './providers/ollamaProvider';
import z from 'zod';
import { McpManager, McpServerStatus } from './mcpManager'; // Import McpManager
import * as path from 'path'; // Needed for custom instructions path

// Key for storing MCP tool overrides in globalState (consistent with handler)
const MCP_TOOL_OVERRIDES_KEY = 'mcpToolEnabledOverrides';

// Define ApiProviderKey based on provider IDs
export type ApiProviderKey = AiService['allProviders'][number]['id'];

export class AiService {
    private currentModelId: string = 'claude-3-5-sonnet';
    private postMessageCallback?: (message: any) => void;
    private activeAbortController: AbortController | null = null; // Controller for the active stream

    public readonly allProviders: AiProvider[];
    public readonly providerMap: Map<string, AiProvider>;
    private mcpManager: McpManager; // Instance of McpManager

    constructor(private context: vscode.ExtensionContext) {
        // Instantiate all providers and create the map
        const providerClasses = [
            AnthropicProvider, GoogleProvider, OpenRouterProvider,
            DeepseekProvider, OpenAiProvider, OllamaProvider,
        ];
        this.allProviders = providerClasses.map(ProviderClass => new ProviderClass(context));
        this.providerMap = new Map(this.allProviders.map(provider => [provider.id, provider]));
        console.log(`[AiService] Initialized ${this.allProviders.length} providers.`);

        // Instantiate McpManager, passing context and a way to set the callback later
        // Pass the callback function directly
        this.mcpManager = new McpManager(context, (msg) => this.postMessageCallback?.(msg));
    }

    public async initialize(): Promise<void> {
        console.log('[AiService] Initializing...');
        // Initialization logic for AiService itself, if any.
        // McpManager initializes itself in its constructor.
        console.log('[AiService] Initialization complete.');
    }

    // --- Getters ---
    public getCurrentModelId(): string { return this.currentModelId; }
    // getActiveToolNames is now effectively replaced by _prepareToolSet logic
    // public getActiveToolNames(): ToolName[] { return this._getActiveToolNames(); }

    // --- Setters ---
    public setPostMessageCallback(callback: (message: any) => void): void {
        this.postMessageCallback = callback;
        // McpManager already received the callback function reference via constructor
        console.log('AiService: postMessage callback registered.');
    }

    public setModel(modelId: string) {
        this.currentModelId = modelId;
        console.log(`AI Model set to: ${modelId}`);
    }

    // --- Private Helpers ---

    private async _getProviderInstance(providerId: string, modelId: string): Promise<LanguageModel | null> {
        console.log(`[AiService] _getProviderInstance called for provider: ${providerId}, model: ${modelId}`);
        let actualModelId = modelId;

        if (!providerId) {
             console.error(`[AiService] No providerId passed to _getProviderInstance.`);
             vscode.window.showErrorMessage(`內部錯誤：未提供 Provider ID。`);
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
            // Don't show error message here, just return null if disabled
            return null;
        }

        let apiKey: string | undefined;
        if (provider.requiresApiKey) {
            try {
                apiKey = await provider.getApiKey(this.context.secrets);
                if (!apiKey) {
                    vscode.window.showErrorMessage(`Provider ${provider.name} 缺少 API Key.`);
                    return null;
                }
            } catch (error: any) {
                 console.error(`[AiService] Error fetching API key for ${provider.name}:`, error);
                 vscode.window.showErrorMessage(`獲取 Provider ${provider.name} 的 API Key 時出錯: ${error.message}`);
                 return null;
            }
        }

        try {
            const modelInstance = provider.createModel(apiKey, actualModelId);
            console.log(`[AiService] Successfully created model instance for ${provider.id}/${actualModelId}`);
            return modelInstance;
        } catch (error: any) {
            console.error(`[AiService] Error creating model instance via provider '${provider.id}' for model '${actualModelId}':`, error);
            vscode.window.showErrorMessage(`創建模型實例時出錯 (${provider.name}): ${error.message}`);
            return null;
        }
    }

    // This private method is no longer the single source of truth for active tools,
    // but can be kept for internal use if needed elsewhere, or removed.
    // For now, _prepareToolSet handles the filtering logic directly.
    // private _getActiveStandardToolNames(): ToolName[] {
    //     const config = vscode.workspace.getConfiguration('zencoder.tools');
    //     const activeToolNames: ToolName[] = [];
    //     for (const toolName of Object.keys(allTools) as ToolName[]) {
    //         if (allTools[toolName] && config.get<boolean>(`${toolName}.enabled`, true)) {
    //             activeToolNames.push(toolName);
    //         }
    //     }
    //     return activeToolNames;
    // }

    /**
     * Prepares the combined and FILTERED toolset for the AI,
     * including enabled built-in tools and enabled MCP tools.
     */
    private _prepareToolSet(): ToolSet {
        const finalTools: ToolSet = {};
        const config = vscode.workspace.getConfiguration('zencoder.tools');
        const mcpOverrides = this.context.globalState.get<{ [toolId: string]: boolean }>(MCP_TOOL_OVERRIDES_KEY, {});

        // 1. Filter Standard Tools based on VS Code settings
        const standardToolNames = Object.keys(allTools) as ToolName[];
        standardToolNames.forEach(toolName => {
            const toolDefinition = allTools[toolName];
            const isEnabled = config.get<boolean>(`${toolName}.enabled`, true); // Default to true if setting missing
            if (toolDefinition && isEnabled) {
                finalTools[toolName] = toolDefinition;
            }
        });
        console.log(`[AiService] Added ${Object.keys(finalTools).length} enabled standard tools.`);

        // 2. Filter MCP Tools based on connection status and overrides
        const mcpToolsMap = this.mcpManager.getMcpServerTools(); // Get all tools from connected servers
        let mcpToolCount = 0;
        for (const [serverName, tools] of mcpToolsMap.entries()) {
             for (const [mcpToolName, mcpToolDefinition] of Object.entries(tools)) {
                 const toolIdentifier = `${serverName}/${mcpToolName}`;
                 // Enabled if override is explicitly true OR if override doesn't exist (default true)
                 const isEnabled = mcpOverrides[toolIdentifier] !== false;
                 if (isEnabled) {
                     // Use the identifier as the key in the final toolset to avoid name collisions
                     finalTools[toolIdentifier] = mcpToolDefinition;
                     mcpToolCount++;
                 }
             }
        }
        console.log(`[AiService] Added ${mcpToolCount} enabled MCP tools.`);

        console.log(`[AiService] Total tools available for AI (filtered): ${Object.keys(finalTools).length}`);
        return finalTools;
    }

    /**
     * Loads global and project-specific custom instructions and merges them.
     */
    private async _loadCustomInstructions(): Promise<string> {
        let combinedInstructions = '';

        // 1. Load Global Instructions from VS Code Settings
        try {
            const globalInstructions = vscode.workspace.getConfiguration('zencoder.customInstructions').get<string>('global');
            if (globalInstructions && globalInstructions.trim()) {
                combinedInstructions += globalInstructions.trim();
                console.log('[AiService] Loaded global custom instructions.');
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
                        combinedInstructions += '\\n\\n---\\n\\n'; // Add separator if global instructions exist
                    }
                    combinedInstructions += projectInstructions.trim();
                    console.log(`[AiService] Loaded project custom instructions from: ${projectInstructionUri.fsPath}`);
                }
            } catch (error: any) {
                if (error.code === 'FileNotFound') {
                    // It's okay if the project file doesn't exist
                    console.log(`[AiService] Project custom instructions file not found (optional): ${projectInstructionUri.fsPath}`);
                } else {
                    console.error(`[AiService] Error reading project custom instructions file ${projectInstructionUri.fsPath}:`, error);
                    vscode.window.showWarningMessage(`Error reading project custom instructions from ${projectInstructionUri.fsPath}.`);
                }
            }
        }

        if (combinedInstructions) {
             console.log(`[AiService] Combined custom instructions length: ${combinedInstructions.length}`);
        } else {
             console.log(`[AiService] No custom instructions found or loaded.`);
        }

        return combinedInstructions;
    }

    // --- Core AI Interaction ---
    public async getAiResponseStream(
        history: CoreMessage[] = [],
        providerId: string,
        modelId: string
    ) { // Return type specified for clarity
        const modelInstance = await this._getProviderInstance(providerId, modelId);

        if (!modelInstance) {
            console.error("[AiService] Failed to get model instance. Cannot proceed with AI request.");
            throw new Error("Failed to get model instance. Cannot proceed with AI request.");
        }

        const messagesForApi: CoreMessage[] = [...history]; // Start with history

        // --- Load and Prepend Custom Instructions ---
        const customInstructions = await this._loadCustomInstructions();
        if (customInstructions) {
            const systemMessageIndex = messagesForApi.findIndex(msg => msg.role === 'system');
            if (systemMessageIndex !== -1) {
                // Append to existing system message, ensuring it's actually a message with string content
                const existingMessage = messagesForApi[systemMessageIndex];
                if (existingMessage.role === 'system' || existingMessage.role === 'user' || existingMessage.role === 'assistant') {
                    // Safely update content for roles that have string content
                    messagesForApi[systemMessageIndex] = {
                        ...existingMessage,
                        content: `${existingMessage.content}\\n\\n---\\n\\n${customInstructions}`
                    };
                    console.log(`[AiService] Appended custom instructions to existing ${existingMessage.role} message.`);
                } else {
                    // Should not happen if findIndex is correct, but handle defensively
                    console.warn(`[AiService] Found message at system index ${systemMessageIndex}, but it was not a system/user/assistant message. Prepending new system message instead.`);
                    messagesForApi.unshift({ role: 'system', content: customInstructions });
                }
            } else {
                // Prepend new system message
                messagesForApi.unshift({ role: 'system', content: customInstructions });
                 console.log('[AiService] Prepended custom instructions as new system message.');
            }
        }

        const enabledTools = this._prepareToolSet(); // Get the filtered toolset

        // --- Call streamText ---
        // Ensure any previous controller is cleared (shouldn't happen often, but safety)
        if (this.activeAbortController) {
            console.warn('[AiService] Found existing AbortController before starting new stream. Aborting previous.');
            this.activeAbortController.abort('New stream started');
        }
        this.activeAbortController = new AbortController();
        const abortSignal = this.activeAbortController.signal;

        try {
            const streamTextResult = await streamText({
                toolCallStreaming: true,
                model: modelInstance,
                messages: messagesForApi,
                tools: enabledTools, // Pass the filtered tools
                maxSteps: 100,
                abortSignal: abortSignal, // Pass the signal
                experimental_continueSteps: true,
                onFinish: async ({ text, toolCalls, toolResults, finishReason, usage }) => {
                    console.log('[AiService] streamText finished.');
                    // Clear the controller when finished naturally
                    this.activeAbortController = null;
                },
                experimental_repairToolCall: async ({
                    toolCall,
                    tools, // Note: 'tools' here will be the filtered set passed to streamText
                    error,
                    messages,
                    system,
                  }) => {
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
                              result: error.message,
                            },
                          ],
                        },
                      ],
                      tools, // Pass the filtered set to repair attempt
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
            return streamTextResult;
        } catch (error: any) {
            console.error('[AiService] Error during streamText execution:', error);
             if (NoSuchToolError.isInstance(error)) {
                  vscode.window.showErrorMessage(`Error: Unknown tool: ${error.toolName}`);
             } else if (InvalidToolArgumentsError.isInstance(error)) {
                  vscode.window.showErrorMessage(`Error: Invalid arguments for tool: ${error.toolName}`);
             } else if (ToolExecutionError.isInstance(error)) {
                  const causeMessage = (error.cause instanceof Error) ? error.cause.message : 'Unknown execution error';
                  vscode.window.showErrorMessage(`Error executing tool ${error.toolName}: ${causeMessage}`);
             } else {
                  vscode.window.showErrorMessage(`Error interacting with AI: ${error.message}`);
             }
             throw error; // Rethrow the error
        } finally {
            // Ensure the controller is cleared even if an error occurs during streaming setup or processing
            // Note: If abort() was called, this might be redundant but harmless.
            if (this.activeAbortController?.signal === abortSignal) {
                this.activeAbortController = null;
                console.log('[AiService] Active AbortController cleared in finally block.');
            }
        }
    }

    // --- API Key Management (Delegated to Providers) ---
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

    /**
     * Gets the current status of all configured MCP servers.
     * Delegates to McpManager.
     */
    public getMcpServerConfiguredStatus(): { [serverName: string]: McpServerStatus } {
        return this.mcpManager.getMcpServerConfiguredStatus();
    }

    /**
     * Retries the connection for a specific MCP server.
     * Delegates to McpManager.
     * @param serverName The name of the server to retry.
     */
    public async retryMcpConnection(serverName: string): Promise<void> {
        // No return value needed here, McpManager handles notifying UI
        await this.mcpManager.retryMcpConnection(serverName);
    }

    // Dispose McpManager when AiService is disposed
    public dispose(): void {
        console.log("[AiService] Disposing AiService...");
        this.mcpManager.dispose();
        console.log("[AiService] AiService disposed.");
    }
}
