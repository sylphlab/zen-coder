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
export type ApiProviderKey = ProviderManager['allProviders'][number]['id'];

export class AiService {
    private postMessageCallback?: (message: any) => void;

    private readonly _providerManager: ProviderManager;
    private readonly _mcpManager: McpManager;
    private readonly historyManager: HistoryManager;
    private readonly context: vscode.ExtensionContext;
    private readonly _providerStatusManager: ProviderStatusManager;
    private readonly _toolManager: ToolManager;
    private readonly _subscriptionManager: SubscriptionManager;
    private readonly _configResolver: ConfigResolver;
    private readonly _aiStreamer: AiStreamer;
    public readonly eventEmitter: EventEmitter;
    public readonly chatSessionManager: ChatSessionManager;

    public get providerStatusManager(): ProviderStatusManager {
        return this._providerStatusManager;
    }
    public get providerManager(): ProviderManager {
        return this._providerManager;
    }
    public get configResolver(): ConfigResolver {
        return this._configResolver;
    }
    public get toolManager(): ToolManager {
        return this._toolManager;
    }

    constructor(
        context: vscode.ExtensionContext,
        historyManager: HistoryManager,
        providerStatusManager: ProviderStatusManager,
        chatSessionManager: ChatSessionManager,
        subscriptionManager: SubscriptionManager
    ) {
        this.context = context;
        this.historyManager = historyManager;
        this._providerStatusManager = providerStatusManager;
        this.chatSessionManager = chatSessionManager;
        this.eventEmitter = new EventEmitter();

        this._providerManager = new ProviderManager(context, providerStatusManager, subscriptionManager.notifyProviderStatusChange.bind(subscriptionManager));
        this._subscriptionManager = subscriptionManager;
        this._mcpManager = new McpManager(context, (msg) => this.postMessageCallback?.(msg));
        this._toolManager = new ToolManager(context, this._mcpManager);
        this._configResolver = new ConfigResolver(this.chatSessionManager);
        this._aiStreamer = new AiStreamer(context, historyManager, this._toolManager, this._providerManager.providerMap, this._configResolver);

        this._mcpManager.eventEmitter.on('mcpStatusChanged', async () => {
            console.log('[AiService] Received mcpStatusChanged event from McpManager.');
            await this._subscriptionManager.notifyToolStatusChange();
        });
    }

    public async initialize(): Promise<void> {
        console.log('[AiService] Initializing...');
        console.log('[AiService] Initialization complete.');
    }

    public setPostMessageCallback(callback: (message: any) => void): void {
        this.postMessageCallback = callback;
        this.historyManager.setPostMessageCallback(callback); // Propagate to HistoryManager
        console.log('AiService: postMessage callback registered for AiService and HistoryManager.');
    }

    // --- Delegated Methods ---
    public async getAiResponseStream(chatId: string): Promise<StreamTextResult<ToolSet, undefined>> {
        return this._aiStreamer.getAiResponseStream(chatId);
    }
    public async getProviderStatus(): Promise<ProviderInfoAndStatus[]> {
         return this._providerManager.getProviderStatus();
    }
    public getMcpStatuses(): { [serverName: string]: McpServerStatus } {
        return this._mcpManager.getMcpServerConfiguredStatus();
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
        return {
            global: globalInstructions ?? '',
            project: projectInstructions ?? undefined,
            projectPath: projectPath
        };
    }
    public async getDefaultConfig(): Promise<DefaultChatConfig> {
        return this._configResolver.getDefaultConfig();
    }
    public async getResolvedToolStatusInfo(): Promise<AllToolsStatusInfo> {
        return this._toolManager.getResolvedToolStatusInfo();
    }
    public async setApiKey(providerId: string, apiKey: string): Promise<void> {
        await this._providerManager.setApiKey(providerId, apiKey);
    }
    public async deleteApiKey(providerId: string): Promise<void> {
        await this._providerManager.deleteApiKey(providerId);
    }
   public abortCurrentStream(): void {
       this._aiStreamer.abortCurrentStream();
   }
   public async retryMcpConnection(serverName: string): Promise<void> {
       await this._mcpManager.retryMcpConnection(serverName);
   }
   public dispose(): void {
       console.log("[AiService] Disposing AiService...");
       this._mcpManager.dispose();
       console.log("[AiService] AiService disposed.");
   }
    public async setProviderEnabled(providerId: string, enabled: boolean): Promise<void> {
        await this._providerManager.setProviderEnabled(providerId, enabled);
    }
    public async addSubscription(topic: string): Promise<void> {
        await this._subscriptionManager.addSubscription(topic);
    }
    public async removeSubscription(topic: string): Promise<void> {
        await this._subscriptionManager.removeSubscription(topic);
    }

    // --- Notification Triggers ---
    public triggerToolStatusNotification() {
        this._subscriptionManager.notifyToolStatusChange();
    }
    public triggerDefaultConfigNotification() {
        this._subscriptionManager.notifyDefaultConfigChange();
    }
    public triggerCustomInstructionsNotification() {
        this._subscriptionManager.notifyCustomInstructionsChange();
    }
    public notifyChatSessionsUpdate(data: any) {
        this._subscriptionManager.notifyChatSessionsUpdate(data);
    }
    public notifyChatHistoryUpdate(chatId: string, data: any) {
        this._subscriptionManager.notifyChatHistoryUpdate(chatId, data);
    }

} // End of AiService class
