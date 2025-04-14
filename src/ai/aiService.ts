import * as vscode from 'vscode';
import { EventEmitter } from 'events'; // Import EventEmitter
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText, Tool, StepResult, ToolCallPart, ToolResultPart, StreamTextResult, ToolCall, ToolExecutionOptions, LanguageModel, Output, TextStreamPart, ToolSet, generateObject, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { structuredAiResponseSchema, StructuredAiResponse, ToolAuthorizationConfig, CategoryStatus, ToolStatus, DefaultChatConfig, AllToolsStatusInfo, ToolCategoryInfo, ToolInfo } from '../common/types'; // Added DefaultChatConfig, Changed ParentStatus to CategoryStatus, Added new tool status types
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
import { ProviderStatusManager } from './providerStatusManager'; // Import ProviderStatusManager

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
    goToDefinitionTool: 'vscode',
    findReferencesTool: 'vscode',
    renameSymbolTool: 'vscode',
    getConfigurationTool: 'vscode',
    startDebuggingTool: 'vscode',
    stopDebuggingTool: 'vscode',
    debugStepOverTool: 'vscode',
    debugStepIntoTool: 'vscode',
    debugStepOutTool: 'vscode',
    addBreakpointsTool: 'vscode',
    removeBreakpointsTool: 'vscode',
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
const DEFAULT_CATEGORY_STATUS = CategoryStatus.AlwaysAvailable; // Changed from ParentStatus
const DEFAULT_TOOL_STATUS = ToolStatus.Inherited; // Changed from Inherit

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
    private readonly _providerStatusManager: ProviderStatusManager; // Rename to follow convention
    public readonly eventEmitter: EventEmitter; // Add EventEmitter instance
    private _isProviderStatusSubscribed: boolean = false; // Track provider status subscription
    private _isToolStatusSubscribed: boolean = false; // Track tool status subscription
    private _isDefaultConfigSubscribed: boolean = false; // Track default config subscription
    private _isCustomInstructionsSubscribed: boolean = false; // Track custom instructions subscription

    // Public getter for ProviderStatusManager
    public get providerStatusManager(): ProviderStatusManager {
        return this._providerStatusManager;
    }

    constructor(
        context: vscode.ExtensionContext,
        historyManager: HistoryManager,
        providerStatusManager: ProviderStatusManager // Inject ProviderStatusManager
    ) {
        this.context = context;
        this.historyManager = historyManager;
        this._providerStatusManager = providerStatusManager; // Store injected instance
        this.eventEmitter = new EventEmitter(); // Initialize EventEmitter

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

    /**
     * Sets the subscription status for provider status updates.
     * @param isSubscribed Whether the webview is currently subscribed.
     */
    public setProviderStatusSubscription(isSubscribed: boolean): void {
        console.log(`[AiService] Provider status subscription set to: ${isSubscribed}`);
        this._isProviderStatusSubscribed = isSubscribed;
    }

    /**
     * Sets the subscription status for tool status updates.
     * @param isSubscribed Whether the webview is currently subscribed.
     */
    public setToolStatusSubscription(isSubscribed: boolean): void {
        console.log(`[AiService] Tool status subscription set to: ${isSubscribed}`);
        this._isToolStatusSubscribed = isSubscribed;
    }

    /**
     * Sets the subscription status for default config updates.
     * @param isSubscribed Whether the webview is currently subscribed.
     */
    public setDefaultConfigSubscription(isSubscribed: boolean): void {
        console.log(`[AiService] Default config subscription set to: ${isSubscribed}`);
        this._isDefaultConfigSubscribed = isSubscribed;
    }

    /**
     * Sets the subscription status for custom instructions updates.
     * @param isSubscribed Whether the webview is currently subscribed.
     */
    public setCustomInstructionsSubscription(isSubscribed: boolean): void {
        console.log(`[AiService] Custom instructions subscription set to: ${isSubscribed}`);
        this._isCustomInstructionsSubscribed = isSubscribed;
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
            const categoryId = this._getStandardToolCategory(toolName);
            const enabled = this._isToolEffectivelyEnabled(toolName, categoryId, null, authConfig); // Corrected method name
            if (enabled) {
                finalTools[toolName] = toolDefinition;
            }
        });

        // 2. Process MCP Tools
        const mcpStatuses = this._mcpManager.getMcpServerConfiguredStatus(); // Use correct method
        for (const [serverName, serverStatus] of Object.entries(mcpStatuses)) {
            if (serverStatus.isConnected && serverStatus.tools) {
                for (const [mcpToolName, mcpToolDefinition] of Object.entries(serverStatus.tools)) {
                    const toolId = `mcp_${serverName}_${mcpToolName}`;
                    const enabled = this._isToolEffectivelyEnabled(toolId, serverName, serverName, authConfig); // Corrected method name
                    if (enabled) {
                        finalTools[toolId] = mcpToolDefinition;
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
                        return { toolCallType: 'function', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, args: newToolCall.args };
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
            const enabled = this._isToolEffectivelyEnabled(toolName, category, null, toolAuthConf); // Corrected method name
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
                    const enabled = this._isToolEffectivelyEnabled(toolIdentifier, serverName, serverName, toolAuthConf); // Corrected method name
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


    public async getDefaultConfig(): Promise<DefaultChatConfig> {
        // Reads the default config directly from VS Code settings
        const config = vscode.workspace.getConfiguration('zencoder');
        const defaultProviderId = config.get<string | null>('defaultChatConfig.defaultProviderId', null);
        const defaultModelId = config.get<string | null>('defaultChatConfig.defaultModelId', null);
        // Add other default config fields here if they exist
        return {
            defaultProviderId: defaultProviderId ?? undefined, // Use undefined if null
            defaultModelId: defaultModelId ?? undefined, // Use undefined if null
        };
    }

    /**
     * Computes the resolved status for all tools, categorized for the UI.
     * @returns A promise resolving to an array of ToolCategoryInfo.
     */
    public async getResolvedToolStatusInfo(): Promise<AllToolsStatusInfo> {
        const authConfig = this._getToolAuthConfig();
        const categories: { [id: string]: ToolCategoryInfo } = {};

        // Helper to get or create a category
        const getOrCreateCategory = (id: string, name: string, defaultStatus: CategoryStatus): ToolCategoryInfo => {
            if (!categories[id]) {
                const configuredStatus = (id.startsWith('mcp_')
                    ? authConfig.mcpServers?.[id.substring(4)] // Extract server name
                    : authConfig.categories?.[id]) ?? defaultStatus;

                categories[id] = { id, name, status: configuredStatus, tools: [] };
            }
            // Ensure the status reflects the current config, even if category existed
            categories[id].status = (id.startsWith('mcp_')
                    ? authConfig.mcpServers?.[id.substring(4)]
                    : authConfig.categories?.[id]) ?? defaultStatus;
            return categories[id];
        };

        // 1. Process Standard Tools
        const standardToolNames = Object.keys(standardToolsMap) as StandardToolName[];
        for (const toolName of standardToolNames) {
            const toolDefinition = standardToolsMap[toolName];
            if (!toolDefinition) continue;

            const categoryId = this._getStandardToolCategory(toolName); // e.g., 'filesystem'
            const categoryName = categoryId.charAt(0).toUpperCase() + categoryId.slice(1); // e.g., 'Filesystem'
            const category = getOrCreateCategory(categoryId, categoryName, DEFAULT_CATEGORY_STATUS);

            const configuredStatus = authConfig.overrides?.[toolName] ?? DEFAULT_TOOL_STATUS;
            const resolvedStatus = this._resolveToolStatus(configuredStatus, category.status);

            category.tools.push({
                id: toolName,
                name: toolName, // Use the internal name for now
                description: toolDefinition.description,
                status: configuredStatus,
                resolvedStatus: resolvedStatus,
            });
        }

        // 2. Process MCP Tools
        const mcpStatuses = this.getMcpStatuses();
        for (const serverName in mcpStatuses) {
            const serverStatus = mcpStatuses[serverName];
            // Only add category if server is configured (even if not connected)
            if (serverStatus.config) {
                 const categoryId = `mcp_${serverName}`;
                 const categoryName = `${serverName} (MCP)`; // Display name for MCP category
                 const category = getOrCreateCategory(categoryId, categoryName, DEFAULT_CATEGORY_STATUS);

                 if (serverStatus.isConnected && serverStatus.tools) {
                     for (const mcpToolName in serverStatus.tools) {
                         const mcpToolDefinition: any = serverStatus.tools[mcpToolName]; // Use any as type not available
                         const toolId = `mcp_${serverName}_${mcpToolName}`;

                         const configuredStatus = authConfig.overrides?.[toolId] ?? DEFAULT_TOOL_STATUS;
                         const resolvedStatus = this._resolveToolStatus(configuredStatus, category.status);

                         category.tools.push({
                             id: toolId,
                             name: `${serverName}: ${mcpToolName}`, // Display name like github: create_issue
                             description: mcpToolDefinition.description,
                             status: configuredStatus,
                             resolvedStatus: resolvedStatus,
                         });
                     }
                 }
                 // Sort tools within the MCP category alphabetically by name
                 category.tools.sort((a, b) => a.name.localeCompare(b.name));
            }
        }

        // Sort standard categories' tools
        Object.values(categories).forEach(cat => {
            if (!cat.id.startsWith('mcp_')) {
                cat.tools.sort((a, b) => a.name.localeCompare(b.name));
            }
        });


        // Convert categories map to array and sort categories
        const sortedCategories = Object.values(categories).sort((a, b) => {
             // Prioritize standard categories, then sort alphabetically
             const aIsMcp = a.id.startsWith('mcp_');
             const bIsMcp = b.id.startsWith('mcp_');
             if (aIsMcp && !bIsMcp) return 1;
             if (!aIsMcp && bIsMcp) return -1;
             return a.name.localeCompare(b.name);
         });

        return sortedCategories;
    }

    // --- Helper Methods for Tool Authorization ---

    private _getToolAuthConfig(): ToolAuthorizationConfig {
        const config = vscode.workspace.getConfiguration('zencoder');
        return {
            categories: config.get<Record<string, CategoryStatus>>('toolAuthorization.categories') ?? {}, // Changed ParentStatus to CategoryStatus
            mcpServers: config.get<Record<string, CategoryStatus>>('toolAuthorization.mcpServers') ?? {}, // Changed ParentStatus to CategoryStatus
            overrides: config.get<Record<string, ToolStatus>>('toolAuthorization.overrides') ?? {} // Changed tools to overrides
        };
    }

    private _getStandardToolCategory(toolName: StandardToolName): string {
        const lowerToolName = toolName.toLowerCase();
        if (lowerToolName.includes('file') || lowerToolName.includes('dir') || lowerToolName.includes('path') || lowerToolName.includes('item')) return 'filesystem';
        if (lowerToolName.includes('editor') || lowerToolName.includes('vscode') || lowerToolName.includes('tab') || lowerToolName.includes('terminal')) return 'vscode';
        return 'utilities';
    }

    /**
     * Determines if a tool is effectively enabled (not disabled) based on resolved status.
     * The AI should only receive tools that return true here.
     */
    private _isToolEffectivelyEnabled(toolIdentifier: string, categoryName: string, serverName: string | null, config: ToolAuthorizationConfig): boolean {
        const toolOverride = config.overrides?.[toolIdentifier];
        let resolvedStatus: CategoryStatus;

        if (toolOverride && toolOverride !== ToolStatus.Inherited) {
            // Resolve based on override
            resolvedStatus = this._resolveToolStatus(toolOverride, CategoryStatus.Disabled); // Pass dummy category status, it won't be used
        } else {
            // Resolve based on category
            const categoryStatus: CategoryStatus = (serverName
                ? config.mcpServers?.[serverName]
                : config.categories?.[categoryName]) ?? DEFAULT_CATEGORY_STATUS;
            resolvedStatus = categoryStatus;
        }

        // A tool is considered enabled if its resolved status is not Disabled
        return resolvedStatus !== CategoryStatus.Disabled;
    }

    /**
     * Resolves the final status of a tool based on its override and its category's status.
     */
    private _resolveToolStatus(toolOverride: ToolStatus, categoryStatus: CategoryStatus): CategoryStatus {
        if (toolOverride === ToolStatus.Inherited) {
            return categoryStatus;
        }
        // Map specific tool override to final CategoryStatus
        switch (toolOverride) {
            case ToolStatus.AlwaysAvailable:
                return CategoryStatus.AlwaysAvailable;
            case ToolStatus.RequiresAuthorization:
                return CategoryStatus.RequiresAuthorization;
            case ToolStatus.Disabled:
                return CategoryStatus.Disabled;
            default: // Should not happen if types are correct
                return categoryStatus;
        }
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
            await this._notifyProviderStatusChange(); // Notify change
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
             await this._notifyProviderStatusChange(); // Notify change
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
    // --- Provider Enable/Disable ---
    public async setProviderEnabled(providerId: string, enabled: boolean): Promise<void> {
        const provider = this.providerMap.get(providerId);
        if (!provider) {
            throw new Error(`Unknown provider ID '${providerId}'.`);
        }
        try {
            // Update the VS Code configuration setting
            // Note: We need to ensure the provider's internal isEnabled() reflects this change too.
            // This might require the provider instance to read from config or be updated.
            // For now, we assume the config change is the source of truth for the next status check.
            const config = vscode.workspace.getConfiguration('zencoder.providers');
            await config.update(providerId, enabled, vscode.ConfigurationTarget.Global); // Or appropriate target
            console.log(`[AiService] Provider ${provider.name} enabled status set to ${enabled} in configuration.`);
            vscode.window.showInformationMessage(`Provider ${provider.name} ${enabled ? 'enabled' : 'disabled'}.`);
            await this._notifyProviderStatusChange(); // Notify change
        } catch (error: any) {
            console.error(`[AiService] Error setting enabled status for ${provider.name}:`, error);
            vscode.window.showErrorMessage(`Failed to update enabled status for ${provider.name}: ${error.message}`);
        }
    }

    // Notify tool status change (called by SetToolEnabledHandler)
    public async _notifyToolStatusChange(): Promise<void> {
        if (this._isToolStatusSubscribed) {
            try {
                // Call the new method to get categorized and resolved status
                const latestStatusInfo = await this.getResolvedToolStatusInfo();
                console.log('[AiService] Emitting toolsStatusChanged event.');
                // Use a specific event name for tool status push
                this.eventEmitter.emit('toolsStatusChanged', latestStatusInfo); // Send new structure
            } catch (error) {
                console.error('[AiService] Error fetching tool status for notification:', error);
            }
        } else {
             console.log('[AiService] Webview not subscribed to tool status, skipping event emission.');
        }
    }

    // --- Internal Notification Helper ---
    private async _notifyProviderStatusChange(): Promise<void> {
        try {
            // Use the injected ProviderStatusManager to get the latest status, passing necessary args
            const latestStatus = await this._providerStatusManager.getProviderStatus(this.allProviders, this.providerMap);
            if (this._isProviderStatusSubscribed) {
                console.log('[AiService] Emitting providerStatusChanged event to subscribed webview.');
                this.eventEmitter.emit('providerStatusChanged', latestStatus);
            } else {
                console.log('[AiService] Webview not subscribed to provider status, skipping event emission.');
            }
        } catch (error) {
            console.error('[AiService] Error fetching provider status for notification:', error);
        }
    }

    // Notify default config change (called by SetDefaultConfigHandler)
    public async _notifyDefaultConfigChange(): Promise<void> {
        if (this._isDefaultConfigSubscribed) {
            try {
                const latestConfig = await this.getDefaultConfig();
                console.log('[AiService] Emitting defaultConfigChanged event.');
                // Use a specific event name for default config push
                this.eventEmitter.emit('defaultConfigChanged', latestConfig);
            } catch (error) {
                console.error('[AiService] Error fetching default config for notification:', error);
            }
        } else {
             console.log('[AiService] Webview not subscribed to default config, skipping event emission.');
        }
    }

    // Notify custom instructions change (called by SetGlobal/ProjectCustomInstructionsHandler)
    public async _notifyCustomInstructionsChange(): Promise<void> {
        if (this._isCustomInstructionsSubscribed) {
            try {
                const latestInstructions = await this.getCombinedCustomInstructions();
                console.log('[AiService] Emitting customInstructionsChanged event.');
                // Use a specific event name for custom instructions push
                this.eventEmitter.emit('customInstructionsChanged', latestInstructions);
            } catch (error) {
                console.error('[AiService] Error fetching custom instructions for notification:', error);
            }
        } else {
             console.log('[AiService] Webview not subscribed to custom instructions, skipping event emission.');
        }
    }
} // End of AiService class
