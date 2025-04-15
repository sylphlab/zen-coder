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
import { ProviderStatusManager } from './providerStatusManager';
import { ToolManager } from './toolManager';
import { SubscriptionManager } from './subscriptionManager';
import { AiStreamer } from './aiStreamer';
import { ProviderManager } from './providerManager';
import { ChatSessionManager } from '../session/chatSessionManager'; // Import ChatSessionManager
import { ConfigResolver } from './configResolver'; // Import ConfigResolver

// Define ApiProviderKey based on provider IDs
// This might be better placed in ProviderManager or types.ts if widely used
// For now, let's keep it based on ProviderManager's structure
export type ApiProviderKey = ProviderManager['allProviders'][number]['id'];

// Tool category definitions and defaults are now in ToolManager

export class AiService {
    private postMessageCallback?: (message: any) => void;
    // activeAbortController is managed by AiStreamer
    // private activeAbortController: AbortController | null = null;

    // Direct access to providers/map replaced by ProviderManager
    // public readonly allProviders: AiProvider[];
    // public readonly providerMap: Map<string, AiProvider>;
    private readonly _providerManager: ProviderManager; // Add ProviderManager instance
    private readonly _mcpManager: McpManager;
    private readonly historyManager: HistoryManager;
    private readonly context: vscode.ExtensionContext;
    // ProviderStatusManager might be used internally by ProviderManager now, review if needed here
    private readonly _providerStatusManager: ProviderStatusManager; // Keep for now, ProviderManager uses it
    private readonly _toolManager: ToolManager;
    private readonly _subscriptionManager: SubscriptionManager;
    private readonly _configResolver: ConfigResolver; // Add ConfigResolver instance
    private readonly _aiStreamer: AiStreamer;
    public readonly eventEmitter: EventEmitter;
    public readonly chatSessionManager: ChatSessionManager; // Expose ChatSessionManager

    // Public getter for ProviderStatusManager
    public get providerStatusManager(): ProviderStatusManager {
        return this._providerStatusManager;
    }
    // Public getter for ProviderManager
    public get providerManager(): ProviderManager {
        return this._providerManager;
    }
    // Public getter for ConfigResolver
    public get configResolver(): ConfigResolver {
        return this._configResolver;
    }
    // Public getter for ToolManager
    public get toolManager(): ToolManager {
        return this._toolManager;
    }

    constructor(
        context: vscode.ExtensionContext,
        historyManager: HistoryManager,
        providerStatusManager: ProviderStatusManager,
        chatSessionManager: ChatSessionManager // Inject ChatSessionManager
    ) {
        this.context = context;
        this.historyManager = historyManager;
        this._providerStatusManager = providerStatusManager;
        this.chatSessionManager = chatSessionManager; // Store ChatSessionManager
        this.eventEmitter = new EventEmitter();

        // Instantiate managers, injecting dependencies and callbacks
        this._subscriptionManager = new SubscriptionManager(() => this);
        // Pass SubscriptionManager's notification method to ProviderManager
        // Corrected: Pass method reference directly
        this._providerManager = new ProviderManager(context, providerStatusManager, this._subscriptionManager.notifyProviderStatusChange.bind(this._subscriptionManager));
        this._mcpManager = new McpManager(context, (msg) => this.postMessageCallback?.(msg));
        this._toolManager = new ToolManager(context, this._mcpManager);
        this._configResolver = new ConfigResolver(this.chatSessionManager); // Instantiate ConfigResolver
        // Pass ConfigResolver to AiStreamer
        this._aiStreamer = new AiStreamer(context, historyManager, this._toolManager, this._providerManager.providerMap, this._configResolver);

        // Listen for MCP status changes to trigger tool list updates
        this._mcpManager.eventEmitter.on('mcpStatusChanged', async () => {
            console.log('[AiService] Received mcpStatusChanged event from McpManager.');
            // No direct notification here; McpManager pushes via its own callback,
            // and tool status changes are handled separately if needed.
            // We still need to notify tool status *if* the list of available tools changes.
            await this._subscriptionManager.notifyToolStatusChange();
        });
    }

    public async initialize(): Promise<void> {
        console.log('[AiService] Initializing...');
        // McpManager initializes itself in its constructor.
        console.log('[AiService] Initialization complete.');
    }

    public setPostMessageCallback(callback: (message: any) => void): void {
        this.postMessageCallback = callback;
        // Also set it for the SubscriptionManager
        this._subscriptionManager.setPostMessageCallback(callback);
        console.log('AiService: postMessage callback registered for AiService and SubscriptionManager.');
    }

    // --- Removed set...Subscription methods ---

    // Delegate streaming to AiStreamer
    public async getAiResponseStream(chatId: string): Promise<StreamTextResult<ToolSet, undefined>> {
        return this._aiStreamer.getAiResponseStream(chatId);
    }

    // --- Methods for Request Handlers ---

    // Delegate Provider Status fetching to ProviderManager
    public async getProviderStatus(): Promise<ProviderInfoAndStatus[]> {
         return this._providerManager.getProviderStatus();
    }

    public getMcpStatuses(): { [serverName: string]: McpServerStatus } {
        return this._mcpManager.getMcpServerConfiguredStatus();
    }

    // Removed getAllToolsWithStatus as getResolvedToolStatusInfo provides necessary data for UI

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
            projectPath = null; // Explicitly nullify path if read fails
        }
    }
    // Ensure the returned object matches the expected shape (string/undefined)
    return {
        global: globalInstructions ?? '', // Default to empty string if undefined/null
        project: projectInstructions ?? undefined, // Use undefined if null/undefined
        projectPath: projectPath // Already null if read failed
    };
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
     * Delegates to ToolManager to compute the resolved status for all tools.
     */
    public async getResolvedToolStatusInfo(): Promise<AllToolsStatusInfo> {
        return this._toolManager.getResolvedToolStatusInfo(); // Delegate to ToolManager
    }

    // --- Tool Authorization Helper Methods removed (now in ToolManager) ---

    // --- API Key Management (Delegated to ProviderManager) ---
    public async setApiKey(providerId: string, apiKey: string): Promise<void> {
        await this._providerManager.setApiKey(providerId, apiKey);
    }

    public async deleteApiKey(providerId: string): Promise<void> {
        await this._providerManager.deleteApiKey(providerId);
    }

   // --- Stream Control (Delegated to AiStreamer) ---
   public abortCurrentStream(): void {
       this._aiStreamer.abortCurrentStream();
   }

   // --- Public Methods Delegating to McpManager (Keep as is) ---
   public async retryMcpConnection(serverName: string): Promise<void> {
       await this._mcpManager.retryMcpConnection(serverName);
   }

   public dispose(): void {
       console.log("[AiService] Disposing AiService...");
       this._mcpManager.dispose();
       console.log("[AiService] AiService disposed.");
   }
    // --- Provider Enable/Disable (Delegated to ProviderManager) ---
    public async setProviderEnabled(providerId: string, enabled: boolean): Promise<void> {
        await this._providerManager.setProviderEnabled(providerId, enabled);
    }

    // --- Subscription Management Methods (Delegated to SubscriptionManager) ---
    /**
     * Adds a subscription for a given topic.
     */
    public async addSubscription(topic: string): Promise<void> {
        await this._subscriptionManager.addSubscription(topic); // Keep delegation
    }

    /**
     * Removes a subscription for a given topic.
     */
    public async removeSubscription(topic: string): Promise<void> {
        await this._subscriptionManager.removeSubscription(topic); // Keep delegation
    }

    // --- Notification Triggers ---
    // Provider status notifications are triggered by ProviderManager via callback to SubscriptionManager.
    // The triggerProviderStatusNotification method is removed.

    // Keep notification triggers - handlers might call these directly on AiService instance from context.
    public triggerToolStatusNotification() { // Renamed from _notifyToolStatusChange
        this._subscriptionManager.notifyToolStatusChange();
    }
    public triggerDefaultConfigNotification() { // Renamed from _notifyDefaultConfigChange
        this._subscriptionManager.notifyDefaultConfigChange();
    }
    public triggerCustomInstructionsNotification() { // Renamed from _notifyCustomInstructionsChange
        this._subscriptionManager.notifyCustomInstructionsChange();
    }
    // Keep chat update notifications - these are likely called by ChatSessionManager/HistoryManager event emitters or StreamProcessor
    public notifyChatSessionsUpdate(data: any) {
        this._subscriptionManager.notifyChatSessionsUpdate(data);
    }
    public notifyChatHistoryUpdate(chatId: string, data: any) {
        this._subscriptionManager.notifyChatHistoryUpdate(chatId, data);
    }

} // End of AiService class
