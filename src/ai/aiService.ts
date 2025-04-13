import * as vscode from 'vscode';
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText, Tool, StepResult, ToolCallPart, ToolResultPart, StreamTextResult, ToolCall, ToolExecutionOptions, LanguageModel, Output, TextStreamPart, ToolSet, generateObject, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { structuredAiResponseSchema, StructuredAiResponse, ToolAuthorizationConfig, ParentStatus, ToolStatus, DefaultChatConfig } from '../common/types'; // Added DefaultChatConfig
import { allTools as standardToolsMap, ToolName as StandardToolName } from '../tools'; // Use correct import name
import { AiProvider, ModelDefinition } from './providers/providerInterface';
import { AnthropicProvider } from './providers/anthropicProvider';
import { GoogleProvider } from './providers/googleProvider';
import { OpenRouterProvider } from './providers/openRouterProvider';
import { DeepseekProvider } from './providers/deepseekProvider';
import { OpenAiProvider } from './providers/openaiProvider';
import { OllamaProvider } from './providers/ollamaProvider';
import z from 'zod';
import { McpManager, McpServerStatus } from './mcpManager'; // McpTool type might not be exported, remove for now
import { ProviderInfoAndStatus } from '../common/types'; // Import missing type
import * as path from 'path';
import { HistoryManager } from '../historyManager';

// Define standard tool categories using the correct exported tool names
const STANDARD_TOOL_CATEGORIES: { [key in StandardToolName]?: string } = {
    // Filesystem
    readFilesTool: 'filesystem',
    writeFilesTool: 'filesystem',
    listFilesTool: 'filesystem',
    createFolderTool: 'filesystem',
    statItemsTool: 'filesystem',
    deleteItemsTool: 'filesystem',
    moveRenameTool: 'filesystem',
    copyFileTool: 'filesystem',
    copyFolderTool: 'filesystem',
    editFileTool: 'filesystem',
    searchContentTool: 'filesystem',
    replaceContentTool: 'filesystem',
    // VS Code Interaction
    getOpenTabsTool: 'vscode',
    getActiveEditorContextTool: 'vscode',
    replaceInActiveEditorTool: 'vscode',
    formatDocumentTool: 'vscode',
    saveActiveFileTool: 'vscode',
    closeActiveFileTool: 'vscode',
    openFileTool: 'vscode',
    // Utils
    fetchUrlTool: 'utils',
    base64EncodeTool: 'utils',
    base64DecodeTool: 'utils',
    md5HashTool: 'utils',
    sha256HashTool: 'utils',
    uuidGenerateTool: 'utils',
    jsonParseTool: 'utils',
    jsonStringifyTool: 'utils',
    // System
    getOsInfoTool: 'system',
    getCurrentTimeTool: 'system',
    getTimezoneTool: 'system',
    getPublicIpTool: 'system',
    getActiveTerminalsTool: 'system',
    runCommandTool: 'system',
};

// Default status if not specified in config
const DEFAULT_PARENT_STATUS = ParentStatus.AlwaysAllow;
const DEFAULT_TOOL_STATUS = ToolStatus.Inherit;

// Define ApiProviderKey based on provider IDs
export type ApiProviderKey = AiService['allProviders'][number]['id'];

export class AiService {
    private postMessageCallback?: (message: any) => void;
    private activeAbortController: AbortController | null = null;

    public readonly allProviders: AiProvider[];
    public readonly providerMap: Map<string, AiProvider>;
    private readonly _mcpManager: McpManager; // Keep private
    private readonly historyManager: HistoryManager;
    private readonly context: vscode.ExtensionContext;

    constructor(
        context: vscode.ExtensionContext,
        historyManager: HistoryManager
    ) {
        this.context = context;
        this.historyManager = historyManager;

        const providerClasses = [
            AnthropicProvider, GoogleProvider, OpenRouterProvider,
            DeepseekProvider, OpenAiProvider, OllamaProvider,
        ];
        this.allProviders = providerClasses.map(ProviderClass => new ProviderClass(context));
        this.providerMap = new Map(this.allProviders.map(provider => [provider.id, provider]));
        console.log(`[AiService] Initialized ${this.allProviders.length} providers.`);

        this._mcpManager = new McpManager(context, (msg) => this.postMessageCallback?.(msg));
    }

    public async initialize(): Promise<void> {
        console.log('[AiService] Initializing...');
        // McpManager initializes itself in its constructor.
        console.log('[AiService] Initialization complete.');
    }

    public setPostMessageCallback(callback: (message: any) => void): void {
        this.postMessageCallback = callback;
        console.log('AiService: postMessage callback registered.');
    }

    private async _getProviderInstance(providerId: string | undefined, modelId: string | undefined): Promise<LanguageModel | null> {
        console.log(`[AiService] _getProviderInstance called for provider: ${providerId}, model: ${modelId}`);
        if (!providerId || !modelId) {
            const errorMsg = `Missing providerId (${providerId}) or modelId (${modelId})`;
            console.error(`[AiService] ${errorMsg}`);
            vscode.window.showErrorMessage(`錯誤：未指定 AI 提供者或模型。`);
            return null;
        }

        const provider = this.providerMap.get(providerId);
        if (!provider) {
            console.error(`[AiService] Internal error: Provider implementation not found for ID: ${providerId}`);
            vscode.window.showErrorMessage(`內部錯誤：找不到 Provider ${providerId} 的實作。`);
            return null;
        }

        const isEnabled = provider.isEnabled();
        if (!isEnabled) {
            console.warn(`[AiService] Provider ${providerId} is disabled.`);
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
            // Pass the modelId directly (assuming it's just the model name/ID now)
            const modelInstance = provider.createModel(apiKey, modelId);
            console.log(`[AiService] Successfully created model instance for ${provider.id}/${modelId}`);
            return modelInstance;
        } catch (error: any) {
            console.error(`[AiService] Error creating model instance via provider '${provider.id}' for model '${modelId}':`, error);
            vscode.window.showErrorMessage(`創建模型實例時出錯 (${provider.name}): ${error.message}`);
            return null;
        }
    }

    private _prepareToolSet(): ToolSet {
        const finalTools: ToolSet = {};
        const authConfig = this._getToolAuthConfig();

        // 1. Process Standard Tools
        const standardToolNames = Object.keys(standardToolsMap) as StandardToolName[];
        standardToolNames.forEach(toolName => {
            const toolDefinition = standardToolsMap[toolName];
            if (!toolDefinition) return;
            const category = this._getStandardToolCategory(toolName);
            const enabled = this._isToolEnabled(toolName, category, null, authConfig);
            if (enabled) {
                finalTools[toolName] = toolDefinition;
            }
        });

        // 2. Process MCP Tools
        const mcpStatuses = this._mcpManager.getMcpServerConfiguredStatus(); // Use correct method
        for (const [serverName, serverStatus] of Object.entries(mcpStatuses)) {
            if (serverStatus.isConnected && serverStatus.tools) {
                for (const [mcpToolName, mcpToolDefinition] of Object.entries(serverStatus.tools)) {
                    const unifiedIdentifier = `mcp_${serverName}_${mcpToolName}`;
                    const enabled = this._isToolEnabled(unifiedIdentifier, serverName, serverName, authConfig);
                    if (enabled) {
                        finalTools[unifiedIdentifier] = mcpToolDefinition;
                    }
                }
            }
        }
        return finalTools;
    }

    private async _loadCustomInstructions(): Promise<string> {
        let combinedInstructions = '';
        try {
            const globalInstructions = vscode.workspace.getConfiguration('zencoder').get<string>('customInstructions.global');
            if (globalInstructions?.trim()) {
                combinedInstructions += globalInstructions.trim();
            }
        } catch (error) {
            console.error('[AiService] Error reading global custom instructions setting:', error);
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders?.[0]) {
            const projectInstructionUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.zen', 'custom_instructions.md');
            try {
                const fileContent = await vscode.workspace.fs.readFile(projectInstructionUri);
                const projectInstructions = Buffer.from(fileContent).toString('utf8');
                if (projectInstructions?.trim()) {
                    if (combinedInstructions) combinedInstructions += '\n\n---\n\n';
                    combinedInstructions += projectInstructions.trim();
                }
            } catch (error: any) {
                if (error.code !== 'FileNotFound') {
                    console.error(`[AiService] Error reading project custom instructions file ${projectInstructionUri.fsPath}:`, error);
                }
            }
        }
        return combinedInstructions;
    }

    public async getAiResponseStream(chatId: string): Promise<StreamTextResult<ToolSet, undefined>> {
        const effectiveConfig = this.historyManager.getChatEffectiveConfig(chatId);
        const effectiveProviderId = effectiveConfig.providerId;
        // Use chatModelId from effectiveConfig and parse it
        const combinedModelId = effectiveConfig.chatModelId;
        const effectiveModelId = combinedModelId?.includes(':') ? combinedModelId.split(':').slice(1).join(':') : combinedModelId; // Extract model part

        if (!effectiveProviderId || !effectiveModelId) {
             const errorMsg = `[AiService] Could not determine effective provider/model for chat ${chatId}. Provider: ${effectiveProviderId}, Model: ${effectiveModelId}`;
             console.error(errorMsg);
             vscode.window.showErrorMessage(`無法確定聊天 ${chatId} 的有效 AI 提供者或模型。請檢查聊天設定或預設設定。`);
             throw new Error(errorMsg);
        }

        const modelInstance = await this._getProviderInstance(effectiveProviderId, effectiveModelId);
        if (!modelInstance) {
            throw new Error(`Failed to get model instance for chat ${chatId}.`);
        }

        const history = this.historyManager.translateUiHistoryToCoreMessages(chatId);
        const messagesForApi: CoreMessage[] = [...history];
        const customInstructions = await this._loadCustomInstructions();
        if (customInstructions) {
            // Simplified: Prepend as system message if none exists, otherwise ignore for now
            // TODO: Refine merging logic if needed
            if (!messagesForApi.some(m => m.role === 'system')) {
                 messagesForApi.unshift({ role: 'system', content: customInstructions });
            } else {
                 console.warn("[AiService] Existing system message found, custom instructions not prepended.");
            }
        }

        const enabledTools = this._prepareToolSet();
        console.log('[AiService] Enabled tools being passed to AI:', Object.keys(enabledTools));

        if (this.activeAbortController) {
            this.activeAbortController.abort('New stream started');
        }
        this.activeAbortController = new AbortController();
        const abortSignal = this.activeAbortController.signal;

        try {
            console.log(`[AiService] Starting streamText for chat ${chatId} with model ${effectiveProviderId}/${effectiveModelId}`);
            const streamTextResult = await streamText({
                model: modelInstance,
                messages: messagesForApi,
                tools: enabledTools,
                maxSteps: 100, // Consider making configurable
                abortSignal: abortSignal,
                experimental_continueSteps: true, // Keep this for multi-step tool use
                onFinish: ({ finishReason }) => {
                    console.log(`[AiService] streamText finished for chat ${chatId}. Reason: ${finishReason}`);
                    if (this.activeAbortController?.signal === abortSignal) {
                         this.activeAbortController = null;
                    }
                },
                // Repair logic might need adjustment based on separate provider/model IDs
                // TODO: Review generateText message types if errors persist
                experimental_repairToolCall: async ({ toolCall, tools, messages, system, error }: any) => { // Use any temporarily for complex type mismatch
                    console.warn(`[AiService] Attempting to repair tool call ${toolCall.toolName} for chat ${chatId}. Error: ${error.message}`);
                    // Basic repair attempt, might need refinement
                    // Cast messages to any to bypass CoreMessage vs Message type conflict for now
                    const result = await generateText({ model: modelInstance, system, messages: [...(messages as any[]), { role: 'assistant', content: [toolCall] }, { role: 'tool', content: [{ type: 'tool-result', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, result: error.message }] }], tools });
                    const newToolCall = result.toolCalls.find(tc => tc.toolName === toolCall.toolName);
                    if (newToolCall) {
                        console.log(`[AiService] Tool call ${toolCall.toolName} repaired for chat ${chatId}.`);
                        return { toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, args: newToolCall.args };
                    }
                    console.error(`[AiService] Failed to repair tool call ${toolCall.toolName} for chat ${chatId}.`);
                    return null;
                },
            });
            return streamTextResult;
        } catch (error: any) {
            console.error(`[AiService] Error during streamText execution for chat ${chatId}:`, error);
             if (error.name === 'AbortError') {
                 console.log(`[AiService] Stream aborted for chat ${chatId}.`);
             } else {
                  vscode.window.showErrorMessage(`與 AI 互動時出錯: ${error.message}`);
             }
             throw error;
        } finally {
            if (this.activeAbortController?.signal === abortSignal) {
                this.activeAbortController = null;
                console.log(`[AiService] Active AbortController cleared in finally block for chat ${chatId}.`);
            }
        }
    }

    // --- Methods for Request Handlers ---

    public getProviderStatus(): ProviderInfoAndStatus[] {
         // This logic was previously in ProviderStatusManager, assuming it's moved here or called from here
         // For now, let's replicate the logic simply
         return this.allProviders.map(provider => ({
             id: provider.id,
             name: provider.name,
             requiresApiKey: provider.requiresApiKey,
             // Check API key status directly using secrets
             // Cannot use await in a synchronous function. Check key status synchronously.
             // Cannot check synchronously if key is set via async getApiKey.
             // Report as undefined. UI should handle this state.
             apiKeySet: undefined,
             enabled: provider.isEnabled(), // Check actual status
             apiKeyUrl: provider.apiKeyUrl,
             models: [], // Models fetched separately now
         }));
    }

    public getMcpStatuses(): { [serverName: string]: McpServerStatus } {
        return this._mcpManager.getMcpServerConfiguredStatus(); // Correct method call
    }

    public async getAllToolsWithStatus(): Promise<{ [toolIdentifier: string]: { description?: string, enabled: boolean, type: 'standard' | 'mcp', serverName?: string } }> {
        const toolAuthConf = this._getToolAuthConfig();
        const allStatuses: { [toolIdentifier: string]: { description?: string, enabled: boolean, type: 'standard' | 'mcp', serverName?: string } } = {};

        // Process Standard Tools
        for (const toolName in standardToolsMap) {
            const toolDefinition = standardToolsMap[toolName as StandardToolName];
            const description = toolDefinition.description;
            const category = this._getStandardToolCategory(toolName as StandardToolName);
            const enabled = this._isToolEnabled(toolName, category, null, toolAuthConf);
            allStatuses[toolName] = { description, enabled, type: 'standard' };
        }

        // Process MCP Tools
        const mcpStatuses = this.getMcpStatuses();
        for (const serverName in mcpStatuses) {
            const serverStatus = mcpStatuses[serverName];
            if (serverStatus.isConnected && serverStatus.tools) {
                for (const toolName in serverStatus.tools) {
                    const mcpTool: any = serverStatus.tools[toolName]; // Use any as McpTool type isn't exported/available
                    const toolIdentifier = `mcp_${serverName}_${toolName}`;
                    const description = mcpTool.description;
                    const enabled = this._isToolEnabled(toolIdentifier, serverName, serverName, toolAuthConf);
                    allStatuses[toolIdentifier] = { description, enabled, type: 'mcp', serverName };
                }
            }
        }
        return allStatuses;
    }

     public async getCombinedCustomInstructions(): Promise<{ global?: string; project?: string; projectPath?: string | null }> {
        const globalInstructions = vscode.workspace.getConfiguration('zencoder').get<string>('customInstructions.global');
        let projectInstructions: string | undefined;
        let projectPath: string | null = null;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders?.[0]) {
            const projectRootUri = workspaceFolders[0].uri;
            const zenFolderUri = vscode.Uri.joinPath(projectRootUri, '.zen');
            const instructionsUri = vscode.Uri.joinPath(zenFolderUri, 'custom_instructions.md');
            projectPath = instructionsUri.fsPath;
            try {
                const fileContent = await vscode.workspace.fs.readFile(instructionsUri);
                projectInstructions = Buffer.from(fileContent).toString('utf-8');
            } catch (error) {
                console.log(`Project custom instructions file not found or failed to read: ${projectPath}`);
                projectPath = null;
            }
        }
        return { global: globalInstructions, project: projectInstructions, projectPath: projectPath };
    }

    // --- Helper Methods for Tool Authorization ---

    private _getToolAuthConfig(): ToolAuthorizationConfig {
        const config = vscode.workspace.getConfiguration('zencoder');
        return {
            categories: config.get<Record<string, ParentStatus>>('toolAuthorization.categories') ?? {},
            mcpServers: config.get<Record<string, ParentStatus>>('toolAuthorization.mcpServers') ?? {},
            tools: config.get<Record<string, ToolStatus>>('toolAuthorization.tools') ?? {}
        };
    }

    private _getStandardToolCategory(toolName: StandardToolName): string {
        const lowerToolName = toolName.toLowerCase();
        if (lowerToolName.includes('file') || lowerToolName.includes('dir') || lowerToolName.includes('path') || lowerToolName.includes('item')) return 'filesystem';
        if (lowerToolName.includes('editor') || lowerToolName.includes('vscode') || lowerToolName.includes('tab') || lowerToolName.includes('terminal')) return 'vscode';
        return 'utilities';
    }

    private _isToolEnabled(toolIdentifier: string, categoryName: string, serverName: string | null, config: ToolAuthorizationConfig): boolean {
        const toolOverride = config.tools[toolIdentifier];
        if (toolOverride && toolOverride !== ToolStatus.Inherit) {
            return toolOverride === ToolStatus.AlwaysAllow;
        }
        let parentStatus: ParentStatus | undefined = serverName
            ? config.mcpServers[serverName]
            : config.categories[categoryName];
        if (parentStatus === undefined) parentStatus = DEFAULT_PARENT_STATUS;
        return parentStatus === ParentStatus.AlwaysAllow;
    }

    // --- API Key Management ---
    public async setApiKey(providerId: string, apiKey: string): Promise<void> {
        const provider = this.providerMap.get(providerId);
        if (!provider) throw new Error(`Unknown provider ID '${providerId}'.`);
        if (!provider.requiresApiKey) {
             console.warn(`Attempted to set API key for provider '${providerId}' which does not require one.`);
             return;
        }
        try {
            await provider.setApiKey(this.context.secrets, apiKey);
            console.log(`[AiService] API Key for ${provider.name} updated successfully.`);
            vscode.window.showInformationMessage(`API Key for ${provider.name} updated.`);
            // TODO: Trigger provider status update/refetch?
        } catch (error: any) {
            console.error(`[AiService] Error setting API Key for ${provider.name}:`, error);
            vscode.window.showErrorMessage(`Failed to store API key for ${provider.name}: ${error.message}`);
        }
    }

    public async deleteApiKey(providerId: string): Promise<void> {
         const provider = this.providerMap.get(providerId);
         if (!provider) throw new Error(`Unknown provider ID '${providerId}'.`);
         if (!provider.requiresApiKey) {
              console.warn(`Attempted to delete API key for provider '${providerId}' which does not require one.`);
              return;
         }
         try {
             await provider.deleteApiKey(this.context.secrets);
             console.log(`[AiService] API Key for ${provider.name} deleted successfully.`);
             vscode.window.showInformationMessage(`API Key for ${provider.name} deleted.`);
             // TODO: Trigger provider status update/refetch?
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
           this.activeAbortController = null;
           console.log('[AiService] Stream aborted.');
       } else {
           console.warn('[AiService] Attempted to abort stream, but no active stream found.');
       }
   }

   // --- Public Methods Delegating to McpManager ---
   public async retryMcpConnection(serverName: string): Promise<void> {
       await this._mcpManager.retryMcpConnection(serverName);
   }

   public dispose(): void {
       console.log("[AiService] Disposing AiService...");
       this._mcpManager.dispose();
       console.log("[AiService] AiService disposed.");
   }
}
