import * as vscode from 'vscode';
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText, Tool, StepResult, ToolCallPart, ToolResultPart, StreamTextResult, ToolCall, ToolExecutionOptions } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { allTools, ToolName } from '../tools';
// Import the specific execution logic, callback type, AND the standard tool definition
import { executeUuidGenerateWithProgress, UuidUpdateCallback, uuidGenerateTool as uuidGenerateToolDefinition } from '../tools/utils/uuidGenerate';

// Define keys for SecretStorage
const SECRET_KEYS = {
    ANTHROPIC: 'zenCoder.anthropicApiKey',
    GOOGLE: 'zenCoder.googleApiKey',
    OPENROUTER: 'zenCoder.openRouterApiKey',
    DEEPSEEK: 'zenCoder.deepseekApiKey',
};
 // Type for provider status (enabled + API key status)
 export type ProviderStatus = {
     enabled: boolean;
     apiKeySet: boolean;
 };

// Type definition for the keys used in AiService SECRET_KEYS
export type ApiProviderKey = keyof typeof SECRET_KEYS; // Export the type

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
    private anthropicApiKey: string | undefined;
    private googleApiKey: string | undefined;
    private openRouterApiKey: string | undefined;
    private deepseekApiKey: string | undefined;
    private postMessageCallback?: (message: any) => void;

    constructor(private context: vscode.ExtensionContext) {}

    public async initialize(): Promise<void> {
        console.log('[AiService] Initializing...'); // Added prefix for clarity
        try {
            // Use Promise.all for concurrent reads
            const [anthropicKey, googleKey, openRouterKey, deepseekKey] = await Promise.all([
                this.context.secrets.get(SECRET_KEYS.ANTHROPIC),
                this.context.secrets.get(SECRET_KEYS.GOOGLE),
                this.context.secrets.get(SECRET_KEYS.OPENROUTER),
                this.context.secrets.get(SECRET_KEYS.DEEPSEEK)
            ]);
            this.anthropicApiKey = anthropicKey;
            this.googleApiKey = googleKey;
            this.openRouterApiKey = openRouterKey;
            this.deepseekApiKey = deepseekKey;
            console.log(`[AiService] API Keys loaded from SecretStorage: Anthropic=${!!this.anthropicApiKey}, Google=${!!this.googleApiKey}, OpenRouter=${!!this.openRouterApiKey}, DeepSeek=${!!this.deepseekApiKey}`);
        } catch (error) {
            console.error('[AiService] Error loading API keys from SecretStorage:', error);
            vscode.window.showErrorMessage('Failed to load API keys securely.');
        }
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
    private _isProviderEnabled(providerKey: ApiProviderKey): boolean {
        const config = vscode.workspace.getConfiguration('zencoder.provider');
        const keyMap: Record<ApiProviderKey, string> = {
            ANTHROPIC: 'anthropic.enabled',
            GOOGLE: 'google.enabled',
            OPENROUTER: 'openrouter.enabled',
            DEEPSEEK: 'deepseek.enabled',
        };
        return config.get<boolean>(keyMap[providerKey], true); // Default to true if setting not found
    }
 
    private _getProviderInstance() {
        console.log(`[AiService] _getProviderInstance called for model: ${this.currentModelId}`); // Log entry
        const modelId = this.currentModelId;
        let providerKey: ApiProviderKey | null = null;
        let actualModelId = modelId; // ID to pass to the provider SDK

        // 1. Determine Provider based on modelId pattern
        if (modelId.startsWith('claude-')) {
            providerKey = 'ANTHROPIC';
            // Use the specific ID provided by the user for Anthropic
        } else if (modelId.startsWith('models/')) {
            providerKey = 'GOOGLE';
            // Use the specific ID provided by the user for Google
        } else if (modelId.startsWith('deepseek-')) {
            providerKey = 'DEEPSEEK';
            // Use the specific ID provided by the user for DeepSeek
        } else if (modelId.includes('/')) { // Assume OpenRouter if it contains a slash
            providerKey = 'OPENROUTER';
            // Use the specific ID provided by the user for OpenRouter
        } else {
            // Cannot determine provider from ID pattern
             console.warn(`[AiService] Could not determine provider for model ID: ${modelId}. Attempting fallback checks.`);
             // Fallback: Check if it matches known hardcoded IDs (less reliable)
             if (this.hardcodedModels.some(m => m.id === modelId && m.provider === 'ANTHROPIC')) providerKey = 'ANTHROPIC';
             else if (this.hardcodedModels.some(m => m.id === modelId && m.provider === 'GOOGLE')) providerKey = 'GOOGLE';
             else if (this.hardcodedModels.some(m => m.id === modelId && m.provider === 'OPENROUTER')) providerKey = 'OPENROUTER';
             else if (this.hardcodedModels.some(m => m.id === modelId && m.provider === 'DEEPSEEK')) providerKey = 'DEEPSEEK';
        }
        console.log(`[AiService] Determined provider key: ${providerKey}`); // Log determined provider
        if (!providerKey) {
            vscode.window.showErrorMessage(`無法從模型 ID "${modelId}" 判斷 Provider.`);
            return null;
        }

        // 2. Check if the determined provider is enabled
        const isEnabled = this._isProviderEnabled(providerKey);
        console.log(`[AiService] Provider ${providerKey} enabled status from config: ${isEnabled}`); // Log enabled status
        if (!isEnabled) {
            vscode.window.showErrorMessage(`Provider ${providerKey} 已在 Settings 頁面停用.`);
            return null;
        }

        // 3. Check API Key for the determined provider
        console.log(`[AiService] Checking API key for ${providerKey}. In-memory keys: Anthropic=${!!this.anthropicApiKey}, Google=${!!this.googleApiKey}, OpenRouter=${!!this.openRouterApiKey}, DeepSeek=${!!this.deepseekApiKey}`); // Log keys before check
        let apiKey: string | undefined;
        switch (providerKey) {
            case 'ANTHROPIC': apiKey = this.anthropicApiKey; break;
            case 'GOOGLE': apiKey = this.googleApiKey; break;
            case 'OPENROUTER': apiKey = this.openRouterApiKey; break;
            case 'DEEPSEEK': apiKey = this.deepseekApiKey; break;
        }

        console.log(`[AiService] API key found for ${providerKey}: ${!!apiKey}. Actual value (DeepSeek check): ${providerKey === 'DEEPSEEK' ? this.deepseekApiKey : 'N/A'}`); // Log key found status + actual value for DeepSeek
        if (!apiKey) {
            vscode.window.showErrorMessage(`Provider ${providerKey} 缺少 API Key.`);
            return null;
        }

        // 4. Create Provider Instance
        try {
            console.log(`[AiService] Creating instance for Provider: ${providerKey}, Model: ${actualModelId}`);
            switch (providerKey) {
                case 'ANTHROPIC':
                    const anthropic = createAnthropic({ apiKey });
                    return anthropic(actualModelId as any); // Pass the user-provided ID
                case 'GOOGLE':
                    const google = createGoogleGenerativeAI({ apiKey });
                    return google(actualModelId as any); // Pass the user-provided ID
                case 'OPENROUTER':
                    const openrouter = createOpenRouter({ apiKey });
                    return openrouter(actualModelId as any); // Pass the user-provided ID
                case 'DEEPSEEK':
                    const deepseek = createDeepSeek({ apiKey });
                    return deepseek(actualModelId as any); // Pass the user-provided ID
                default:
                    // Should not happen due to earlier checks
                    throw new Error(`Unhandled provider key: ${providerKey}`);
            }
        } catch (error: any) {
            console.error(`[AiService] Error creating model instance for ${providerKey} / ${actualModelId}:`, error);
            vscode.window.showErrorMessage(`創建模型實例時出錯 (${providerKey}): ${error.message}`);
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
    public async getAiResponseStream(prompt: string): Promise<ReadableStream | null> {
        const modelInstance = this._getProviderInstance();
        if (!modelInstance) {
            // Explicitly send error back to UI if model instance fails
            const errorMessage = `無法為模型 '${this.currentModelId}' 初始化 Provider. 請檢查 Settings 頁面嘅 Provider 啟用狀態同 API Key.`;
            this.postMessageCallback?.({ type: 'addMessage', sender: 'assistant', text: errorMessage });
            // Also ensure history is cleaned up if needed and streaming state is reset in UI
            this.conversationHistory.pop(); // Remove last user message
            return null;
        }

        this.conversationHistory.push({ role: 'user', content: prompt });

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
            const result = await streamText({
                model: modelInstance,
                messages: this.conversationHistory,
                tools: activeTools, // Pass the map containing original and wrapped tools
                maxSteps: 5, // Adjust as needed
                onFinish: async (event) => {
                    if (event.finishReason === 'stop' || event.finishReason === 'tool-calls') {
                        this.addAssistantResponseToHistory(event.text ?? '');
                        event.toolCalls?.forEach((tc) => this.addToolCallToHistory(tc));
                        // Handle toolResults if they exist (might not for callback tools)
                        event.toolResults?.forEach((tr) => this.addToolResultToHistory(tr));
                    }
                    console.log("Stream finished.");
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
                            // IMPORTANT: Use the original allTools for repair, not activeTools which has the wrapper
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
            return result.toDataStream();
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

    // --- History Management ---
    public addAssistantResponseToHistory(content: string | undefined) {
        if (content) {
            this.conversationHistory.push({ role: 'assistant', content });
        }
    }

    public addToolCallToHistory(toolCall: ToolCallPart) {
        this.conversationHistory.push({ role: 'assistant', content: [toolCall] });
    }

    public addToolResultToHistory(toolResult: ToolResultPart) {
         this.conversationHistory.push({ role: 'tool', content: [toolResult] });
    }

    // --- API Key Management ---
    public async setApiKey(providerKeyConstant: ApiProviderKey, apiKey: string): Promise<void> { // Use ApiProviderKey type
        const secretKey = SECRET_KEYS[providerKeyConstant];
        if (!secretKey) {
             console.error(`[AiService] Invalid provider key constant used in setApiKey: ${providerKeyConstant}`);
             throw new Error(`Invalid provider key: ${providerKeyConstant}`);
        }
        console.log(`[AiService] Attempting to store API Key for ${providerKeyConstant} in SecretStorage (key: ${secretKey}).`);
        try {
            await this.context.secrets.store(secretKey, apiKey);
            console.log(`[AiService] Successfully stored API Key for ${providerKeyConstant}. Updating in-memory cache.`);
            // Update in-memory cache after successful storage
            switch (providerKeyConstant) {
                case 'ANTHROPIC': this.anthropicApiKey = apiKey; break;
                case 'GOOGLE': this.googleApiKey = apiKey; break;
                case 'OPENROUTER': this.openRouterApiKey = apiKey; break;
                case 'DEEPSEEK': this.deepseekApiKey = apiKey; break;
            }
            vscode.window.showInformationMessage(`API Key for ${providerKeyConstant} updated.`);
        } catch (error) {
            console.error(`[AiService] Error storing API Key for ${providerKeyConstant}:`, error);
            vscode.window.showErrorMessage(`Failed to store API key for ${providerKeyConstant} securely.`); // More specific error
            // Do NOT update in-memory cache if storage failed
        }
    }

    public async getApiKey(providerKeyConstant: keyof typeof SECRET_KEYS): Promise<string | undefined> {
         const secretKey = SECRET_KEYS[providerKeyConstant];
         if (!secretKey) throw new Error(`Invalid provider key: ${providerKeyConstant}`);
        return await this.context.secrets.get(secretKey);
    }

     public async deleteApiKey(providerKeyConstant: keyof typeof SECRET_KEYS): Promise<void> {
         const secretKey = SECRET_KEYS[providerKeyConstant];
         if (!secretKey) throw new Error(`Invalid provider key: ${providerKeyConstant}`);
         await this.context.secrets.delete(secretKey);
         switch (providerKeyConstant) {
             case 'ANTHROPIC': this.anthropicApiKey = undefined; break;
             case 'GOOGLE': this.googleApiKey = undefined; break;
             case 'OPENROUTER': this.openRouterApiKey = undefined; break;
             case 'DEEPSEEK': this.deepseekApiKey = undefined; break;
         }
         console.log(`API Key for ${providerKeyConstant} deleted.`);
         vscode.window.showInformationMessage(`API Key for ${providerKeyConstant} deleted.`);
     }

    // --- API Key Status ---
    public async getApiKeyStatus(): Promise<Record<ApiProviderKey, boolean>> {
        // Ensure keys are loaded (initialize should have been called)
        if (this.anthropicApiKey === undefined && this.googleApiKey === undefined && this.openRouterApiKey === undefined && this.deepseekApiKey === undefined) {
            // Attempt to load keys if they seem missing, although initialize should handle this.
            // This is a safeguard, might indicate an issue if hit frequently.
            console.warn("API keys accessed before initialization or were cleared. Re-initializing.");
            await this.initialize();
        }
        return {
            ANTHROPIC: !!this.anthropicApiKey,
            GOOGLE: !!this.googleApiKey,
            OPENROUTER: !!this.openRouterApiKey,
            DEEPSEEK: !!this.deepseekApiKey,
        };
    }

    // --- Provider Status ---
    public async getProviderStatus(): Promise<Record<ApiProviderKey, ProviderStatus>> {
        const apiKeyStatus = await this.getApiKeyStatus();
        const providerStatus: Record<ApiProviderKey, ProviderStatus> = {
            ANTHROPIC: { enabled: this._isProviderEnabled('ANTHROPIC'), apiKeySet: apiKeyStatus.ANTHROPIC },
            GOOGLE: { enabled: this._isProviderEnabled('GOOGLE'), apiKeySet: apiKeyStatus.GOOGLE },
            OPENROUTER: { enabled: this._isProviderEnabled('OPENROUTER'), apiKeySet: apiKeyStatus.OPENROUTER },
            DEEPSEEK: { enabled: this._isProviderEnabled('DEEPSEEK'), apiKeySet: apiKeyStatus.DEEPSEEK },
        };
        return providerStatus;
    }

    // --- Model Resolver ---
    // Hardcoded fallback list (expand as needed)
    private hardcodedModels: ResolvedModel[] = [
        // Anthropic
        { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet (Hardcoded)', provider: 'ANTHROPIC', source: 'hardcoded' },
        { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Hardcoded)', provider: 'ANTHROPIC', source: 'hardcoded' },
        { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Hardcoded)', provider: 'ANTHROPIC', source: 'hardcoded' },
        // Google
        { id: 'models/gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro (Hardcoded)', provider: 'GOOGLE', source: 'hardcoded' },
        { id: 'models/gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash (Hardcoded)', provider: 'GOOGLE', source: 'hardcoded' },
        { id: 'models/gemini-pro', label: 'Gemini 1.0 Pro (Hardcoded)', provider: 'GOOGLE', source: 'hardcoded' },
        // OpenRouter (Examples - Needs verification)
        { id: 'anthropic/claude-3.5-sonnet', label: 'OpenRouter: Claude 3.5 Sonnet (Hardcoded)', provider: 'OPENROUTER', source: 'hardcoded' },
        { id: 'google/gemini-pro-1.5', label: 'OpenRouter: Gemini 1.5 Pro (Hardcoded)', provider: 'OPENROUTER', source: 'hardcoded' },
        { id: 'mistralai/mistral-large', label: 'OpenRouter: Mistral Large (Hardcoded)', provider: 'OPENROUTER', source: 'hardcoded' },
        // DeepSeek
        { id: 'deepseek-coder', label: 'DeepSeek Coder (Hardcoded)', provider: 'DEEPSEEK', source: 'hardcoded' },
        { id: 'deepseek-chat', label: 'DeepSeek Chat (Hardcoded)', provider: 'DEEPSEEK', source: 'hardcoded' },
    ];

    public async resolveAvailableModels(): Promise<ResolvedModel[]> {
        const resolvedModels: ResolvedModel[] = [];
        const providerStatus = await this.getProviderStatus();

        // --- TODO: Implement API/Web Scraping Logic ---
        // Example structure:
        // if (providerStatus.ANTHROPIC.enabled && providerStatus.ANTHROPIC.apiKeySet) {
        //     try {
        //         const apiModels = await this.fetchAnthropicModels(); // Placeholder
        //         resolvedModels.push(...apiModels);
        //     } catch (e) { console.error("Failed to fetch Anthropic models:", e); }
        // }
        // ... similar logic for other providers ...

        // --- Add Hardcoded Fallbacks ---
        // Only add hardcoded models for providers that are enabled and have keys set,
        // and only if no models were resolved via API/Scraping for that provider.
        const providersWithApiModels = new Set(resolvedModels.map(m => m.provider));

        for (const hcModel of this.hardcodedModels) {
            if (providerStatus[hcModel.provider]?.enabled &&
                providerStatus[hcModel.provider]?.apiKeySet &&
                !providersWithApiModels.has(hcModel.provider))
            {
                // Avoid duplicates if hardcoded ID somehow matches a resolved ID
                if (!resolvedModels.some(rm => rm.id === hcModel.id)) {
                    resolvedModels.push(hcModel);
                }
            }
        }

        // Sort or further process the list if needed
        resolvedModels.sort((a, b) => a.label.localeCompare(b.label));

        console.log("Resolved available models:", resolvedModels);
        return resolvedModels;
    }
}