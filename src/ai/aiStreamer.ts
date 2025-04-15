import * as vscode from 'vscode';
import { CoreMessage, streamText, generateText, Tool, ToolSet, LanguageModel, StreamTextResult } from 'ai';
import { HistoryManager } from '../historyManager'; // HistoryManager still needed for history access
import { ToolManager } from './toolManager';
import { AiProvider } from './providers/providerInterface';
import { ConfigResolver, EffectiveChatConfig } from './configResolver'; // Import ConfigResolver and EffectiveChatConfig
import { translateUiHistoryToCoreMessages } from '../utils/historyUtils'; // Import translation utility

/**
 * Handles the core logic of interacting with AI models,
 * including preparing messages, managing tools, and streaming responses.
 */
export class AiStreamer {
    private readonly historyManager: HistoryManager;
    private readonly toolManager: ToolManager;
    private readonly providerMap: Map<string, AiProvider>;
    private readonly configResolver: ConfigResolver; // Add ConfigResolver instance
    private readonly context: vscode.ExtensionContext;
    private activeAbortController: AbortController | null = null;

    constructor(
        context: vscode.ExtensionContext,
        historyManager: HistoryManager, // Keep historyManager for getHistory
        toolManager: ToolManager,
        providerMap: Map<string, AiProvider>,
        configResolver: ConfigResolver // Inject ConfigResolver
    ) {
        this.context = context;
        this.historyManager = historyManager;
        this.toolManager = toolManager;
        this.providerMap = providerMap;
        this.configResolver = configResolver; // Store injected instance
    }

    /**
     * Fetches an AI provider instance based on ID and model ID.
     * Handles API key retrieval and provider enablement checks.
     */
    private async _getProviderInstance(providerId: string | undefined, modelId: string | undefined): Promise<LanguageModel | null> {
        console.log(`[AiStreamer] _getProviderInstance called for provider: ${providerId}, model: ${modelId}`);
        if (!providerId || !modelId) {
            const errorMsg = `Missing providerId (${providerId}) or modelId (${modelId})`;
            console.error(`[AiStreamer] ${errorMsg}`);
            vscode.window.showErrorMessage(`錯誤：未指定 AI 提供者或模型。`);
            return null;
        }

        const provider = this.providerMap.get(providerId);
        if (!provider) {
            console.error(`[AiStreamer] Internal error: Provider implementation not found for ID: ${providerId}`);
            vscode.window.showErrorMessage(`內部錯誤：找不到 Provider ${providerId} 的實作。`);
            return null;
        }

        const isEnabled = provider.isEnabled();
        if (!isEnabled) {
            console.warn(`[AiStreamer] Provider ${providerId} is disabled.`);
            vscode.window.showWarningMessage(`AI Provider '${provider.name}' 已停用。請在設定中啟用佢。`);
            return null;
        }

        let apiKey: string | undefined;
        if (provider.requiresApiKey) {
            try {
                apiKey = await provider.getApiKey(this.context.secrets);
                if (!apiKey) {
                    vscode.window.showErrorMessage(`Provider ${provider.name} 缺少 API Key。請在設定中加入。`);
                    return null; // Stop if API key is missing and required
                }
            } catch (error: any) {
                console.error(`[AiStreamer] Error fetching API key for ${provider.name}:`, error);
                vscode.window.showErrorMessage(`獲取 Provider ${provider.name} 的 API Key 時出錯: ${error.message}`);
                return null;
            }
        }

        try {
            const modelInstance = provider.createModel(apiKey, modelId);
            console.log(`[AiStreamer] Successfully created model instance for ${provider.id}/${modelId}`);
            return modelInstance;
        } catch (error: any) {
            console.error(`[AiStreamer] Error creating model instance via provider '${provider.id}' for model '${modelId}':`, error);
            vscode.window.showErrorMessage(`創建模型實例時出錯 (${provider.name}): ${error.message}`);
            return null;
        }
    }

    /**
     * Loads and combines global and project-specific custom instructions.
     */
    private async _loadCustomInstructions(): Promise<string> {
        let combinedInstructions = '';
        try {
            const globalInstructions = vscode.workspace.getConfiguration('zencoder').get<string>('customInstructions.global');
            if (globalInstructions?.trim()) {
                combinedInstructions += globalInstructions.trim();
            }
        } catch (error) {
            console.error('[AiStreamer] Error reading global custom instructions setting:', error);
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders?.[0]) {
            const projectInstructionUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.zen', 'custom_instructions.md');
            try {
                const fileContent = await vscode.workspace.fs.readFile(projectInstructionUri);
                const projectInstructions = Buffer.from(fileContent).toString('utf8');
                if (projectInstructions?.trim()) {
                    if (combinedInstructions) { combinedInstructions += '\n\n---\n\n'; }
                    combinedInstructions += projectInstructions.trim();
                }
            } catch (error: any) {
                if (error.code !== 'FileNotFound') {
                    console.error(`[AiStreamer] Error reading project custom instructions file ${projectInstructionUri.fsPath}:`, error);
                }
            }
        }
        return combinedInstructions;
    }

    /**
     * Initiates the AI response stream for a given chat.
     * Prepares messages, loads instructions, enables tools, and calls the AI SDK.
     */
    public async getAiResponseStream(chatId: string): Promise<StreamTextResult<ToolSet, undefined>> {
        const effectiveConfig: EffectiveChatConfig = this.configResolver.getChatEffectiveConfig(chatId);
        const effectiveProviderId = effectiveConfig.providerId;
        const combinedModelId = effectiveConfig.chatModelId;
        const effectiveModelId = combinedModelId?.includes(':') ? combinedModelId.split(':').slice(1).join(':') : combinedModelId;

        if (!effectiveProviderId || !effectiveModelId) {
            const errorMsg = `[AiStreamer] Could not determine effective provider/model for chat ${chatId}. Provider: ${effectiveProviderId}, Model: ${effectiveModelId}`;
            console.error(errorMsg);
            vscode.window.showErrorMessage(`無法確定聊天 ${chatId} 的有效 AI 提供者或模型。請檢查聊天設定或預設設定。`);
            throw new Error(errorMsg);
        }

        const modelInstance = await this._getProviderInstance(effectiveProviderId, effectiveModelId);
        if (!modelInstance) {
            throw new Error(`Failed to get model instance for chat ${chatId}.`);
        }

        const uiHistory = this.historyManager.getHistory(chatId);
        const messagesForApi: CoreMessage[] = translateUiHistoryToCoreMessages(uiHistory);
        const customInstructions = await this._loadCustomInstructions();
        if (customInstructions) {
            if (!messagesForApi.some(m => m.role === 'system')) {
                messagesForApi.unshift({ role: 'system', content: customInstructions });
            } else {
                console.warn("[AiStreamer] Existing system message found, custom instructions not prepended.");
            }
        }

        const enabledTools = this.toolManager.prepareToolSet();
        console.log('[AiStreamer] Enabled tools being passed to AI:', Object.keys(enabledTools));

        // --- Explicitly abort and clear previous controller ---
        if (this.activeAbortController) {
            console.log('[AiStreamer] Aborting previous active stream before starting new one.');
            this.activeAbortController.abort('New stream initiated by user');
            this.activeAbortController = null; // Nullify immediately
        }
        // --- End Abort ---

        // Create a new controller for the current stream
        this.activeAbortController = new AbortController();
        const abortSignal = this.activeAbortController.signal;

        try {
            console.log(`[AiStreamer] Starting streamText for chat ${chatId} with model ${effectiveProviderId}/${effectiveModelId}`);
            const streamTextResult = await streamText({
                model: modelInstance,
                messages: messagesForApi,
                tools: enabledTools,
                maxSteps: 100,
                abortSignal: abortSignal,
                experimental_continueSteps: true,
                onFinish: ({ finishReason, usage }) => {
                    console.log(`[AiStreamer] streamText finished for chat ${chatId}. Reason: ${finishReason}, Usage: ${JSON.stringify(usage)}`);
                    if (this.activeAbortController?.signal === abortSignal) {
                        this.activeAbortController = null;
                    }
                },
                experimental_repairToolCall: async ({ toolCall, tools, messages, system, error }: any) => {
                    console.warn(`[AiStreamer] Attempting to repair tool call ${toolCall.toolName} for chat ${chatId}. Error: ${error.message}`);
                    try {
                         const result = await generateText({
                             model: modelInstance,
                             system,
                             messages: [...(messages as any[]), { role: 'assistant', content: [toolCall] }, { role: 'tool', content: [{ type: 'tool-result', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, result: `Error during execution: ${error.message}. Please provide corrected arguments.` }] }],
                             tools
                         });
                        const newToolCall = result.toolCalls.find(tc => tc.toolName === toolCall.toolName);
                        if (newToolCall) {
                            console.log(`[AiStreamer] Tool call ${toolCall.toolName} repaired for chat ${chatId}.`);
                            return { toolCallType: 'function', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, args: newToolCall.args };
                        }
                         console.error(`[AiStreamer] Failed to repair tool call ${toolCall.toolName} for chat ${chatId} - AI did not return a new call.`);
                    } catch (repairError: any) {
                         console.error(`[AiStreamer] Error during tool call repair attempt for ${toolCall.toolName}:`, repairError);
                    }
                    return null;
                },
            });
            return streamTextResult;
        } catch (error: any) {
            console.error(`[AiStreamer] Error during streamText execution for chat ${chatId}:`, error);
            if (error.name === 'AbortError') {
                // Check if the error message indicates it was aborted due to a new stream
                if (error.message === 'New stream initiated by user') {
                     console.log(`[AiStreamer] Previous stream for chat ${chatId} correctly aborted by new stream request.`);
                } else {
                     console.log(`[AiStreamer] Stream aborted for chat ${chatId}. Reason: ${error.message}`);
                }
            } else {
                vscode.window.showErrorMessage(`與 AI 互動時出錯: ${error.message}`);
            }
            if (this.activeAbortController?.signal === abortSignal) {
                this.activeAbortController = null;
            }
            throw error;
        }
    }

    /**
     * Aborts the currently active AI response stream, if any.
     */
    public abortCurrentStream(): void {
        if (this.activeAbortController) {
            console.log('[AiStreamer] Aborting current AI stream...');
            this.activeAbortController.abort('User requested cancellation');
            this.activeAbortController = null; // Clear immediately after aborting
            console.log('[AiStreamer] Stream aborted by user request.');
        } else {
            console.warn('[AiStreamer] Attempted to abort stream, but no active stream found.');
        }
    }
}
