import * as vscode from 'vscode';
// Import necessary types and functions, removing deprecated/incorrect ones
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText, Tool, StepResult, ToolCallPart, ToolResultPart, StreamTextResult, ToolCall } from 'ai'; // Removed ToolError as it's not exported. Added StreamTextResult, ToolCall.
// Import the factory function as per documentation
import { createAnthropic } from '@ai-sdk/anthropic';
// Import the correct factory function for Google
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createDeepSeek } from '@ai-sdk/deepseek';
// Import the consolidated tools and types
import { allTools, ToolName } from '../tools';

// Define keys for SecretStorage
const SECRET_KEYS = {
    ANTHROPIC: 'zenCoder.anthropicApiKey',
    GOOGLE: 'zenCoder.googleApiKey',
    OPENROUTER: 'zenCoder.openRouterApiKey',
    DEEPSEEK: 'zenCoder.deepseekApiKey',
};

// Model list - used for validation and potentially UI
const availableModelIds = [
    'claude-3-5-sonnet',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'openrouter/claude-3.5-sonnet',
    'deepseek-coder',
] as const; // Use const assertion for stricter typing

type ModelId = typeof availableModelIds[number];

// Define the expected structure for the MCP tool executor function
type McpToolExecutor = (serverName: string, toolName: string, args: any) => Promise<any>;

// ToolName type is now imported from '../tools'

export class AiService {
    private currentModelId: ModelId = 'claude-3-5-sonnet'; // Default model
    private conversationHistory: CoreMessage[] = [];
    private anthropicApiKey: string | undefined;
    private googleApiKey: string | undefined;
    private openRouterApiKey: string | undefined;
    private deepseekApiKey: string | undefined;
    // private executeMcpTool: McpToolExecutor; // Removed - MCP execution will be handled differently if integrated

    constructor(
        private context: vscode.ExtensionContext
        // mcpToolExecutor: McpToolExecutor // Removed parameter
    ) {
        // this.executeMcpTool = mcpToolExecutor; // Removed assignment
        // TODO: Load conversation history if persisted
    }

    // Must be called after instantiation
    public async initialize(): Promise<void> {
        this.anthropicApiKey = await this.context.secrets.get(SECRET_KEYS.ANTHROPIC);
        this.googleApiKey = await this.context.secrets.get(SECRET_KEYS.GOOGLE);
        this.openRouterApiKey = await this.context.secrets.get(SECRET_KEYS.OPENROUTER);
        this.deepseekApiKey = await this.context.secrets.get(SECRET_KEYS.DEEPSEEK);
        console.log('AiService initialized, API keys loaded from SecretStorage.');
    }

    public setModel(modelId: ModelId) {
        // Check if the modelId is one of the known available IDs
        if (availableModelIds.includes(modelId as any)) { // Use 'as any' for type assertion if needed, or refine type checking
            this.currentModelId = modelId;
            console.log(`AI Model set to: ${modelId}`);
            // Potentially clear history or notify user when model changes
            this.conversationHistory = [];
        } else {
            vscode.window.showErrorMessage(`Invalid or unsupported model ID: ${modelId}`);
        }
    }

    // Let TypeScript infer the complex return type
    // Method to get the configured AI model instance based on currentModelId and API keys
    private _getProviderInstance() {
        const modelId = this.currentModelId;

        try {
            if (modelId === 'claude-3-5-sonnet' && this.anthropicApiKey) {
                // Use createAnthropic factory function with the stored API key
                const anthropicProvider = createAnthropic({ apiKey: this.anthropicApiKey });
                return anthropicProvider('claude-3-5-sonnet-latest'); // Get the specific model instance
            } else if ((modelId === 'gemini-1.5-pro' || modelId === 'gemini-1.5-flash') && this.googleApiKey) {
                 // Use createGoogleGenerativeAI factory function with the stored API key
                 const googleProvider = createGoogleGenerativeAI({ apiKey: this.googleApiKey });
                 const googleModelName = modelId === 'gemini-1.5-pro' ? 'models/gemini-1.5-pro-latest' : 'models/gemini-1.5-flash-latest';
                 return googleProvider(googleModelName); // Get the specific model instance
            } else if (modelId === 'openrouter/claude-3.5-sonnet' && this.openRouterApiKey) {
                const openrouter = createOpenRouter({ apiKey: this.openRouterApiKey });
                return openrouter('anthropic/claude-3.5-sonnet'); // Correct usage
            } else if (modelId === 'deepseek-coder' && this.deepseekApiKey) {
                const deepseek = createDeepSeek({ apiKey: this.deepseekApiKey });
                return deepseek('deepseek-coder'); // Correct usage
            } else {
                // API key is missing for the selected provider
                vscode.window.showErrorMessage(`API Key for ${modelId} is missing. Please configure it.`);
                // TODO: Add command to open settings
                return null;
            }
        } catch (error: any) {
             console.error(`Error creating model instance for ${modelId}:`, error);
             vscode.window.showErrorMessage(`Failed to create AI model instance: ${error.message}`);
             return null;
        }
    }

    // Helper method to get the names of enabled tools based on configuration
    private _getActiveToolNames(): ToolName[] {
        const config = vscode.workspace.getConfiguration('zencoder.tools');
        const activeToolNames: ToolName[] = [];

        // Iterate over the keys of the imported allTools object
        for (const toolName of Object.keys(allTools) as ToolName[]) {
            // Ensure the config key matches the tool name exactly
            if (config.get<boolean>(`${toolName}.enabled`, true)) { // Default to true if not set
                activeToolNames.push(toolName); // toolName is already of type ToolName
            }
        }
        console.log("Active tools based on configuration:", activeToolNames);
        return activeToolNames;
    }

    // Return type should be Promise<ReadableStream | null>
    public async getAiResponseStream(prompt: string): Promise<ReadableStream | null> {
        const modelInstance = this._getProviderInstance();

        if (!modelInstance) {
            // Error message already shown by _getProviderInstance or key check
            return null;
        }

        // Add user prompt to history
        this.conversationHistory.push({ role: 'user', content: prompt });

        // Use the imported allTools directly
        const activeToolNames = this._getActiveToolNames();

        // Filter the main allTools object based on activeToolNames
        const activeTools: Record<string, Tool<any, any>> = {};
        for (const toolName of activeToolNames) {
            if (allTools[toolName]) {
                activeTools[toolName] = allTools[toolName];
            }
        }

        try {
            // Use standard streamText with the filtered activeTools
            // Provide the correct generic type for StreamTextResult based on the tools being passed
            const result: StreamTextResult<typeof activeTools, any> = await streamText({ // Provide both generic types
                model: modelInstance,
                messages: this.conversationHistory,
                tools: activeTools, // Pass the filtered tools directly
                maxSteps: 5,
                // Let TypeScript infer the event type from the StreamTextResult context
                onFinish: async (event) => {
                    // History update logic
                    // Access properties based on inferred type (or add explicit type if inference fails)
                    if (event.finishReason === 'stop' || event.finishReason === 'tool-calls') {
                        // Assuming 'text', 'toolCalls', 'toolResults' are available on the inferred event type
                        this.addAssistantResponseToHistory(event.text ?? '');
                        event.toolCalls?.forEach((tc) => this.addToolCallToHistory(tc));
                        event.toolResults?.forEach((tr) => this.addToolResultToHistory(tr));
                    }
                    console.log("Stream finished.");
                },

                // Experimental Tool Repair (Re-ask Strategy) - Keep this logic
                // Add correct types to repairToolCall parameters
                experimental_repairToolCall: async ({
                    toolCall,
                    error,
                    messages,
                    system
                }: {
                    // Use the imported ToolCall and standard Error type
                    toolCall: ToolCall<string, any>;
                    error: Error; // Use standard Error type
                    messages: CoreMessage[];
                    system?: string;
                }) => {
                    console.warn(`Attempting to repair tool call for ${toolCall.toolName} due to error: ${error.message}`);
                    // ... (Keep existing repair logic, ensuring it uses 'allTools' for re-ask)
                    try {
                        const repairResult = await generateText({
                            model: modelInstance,
                            system: system,
                            messages: [
                                ...messages,
                                { role: 'assistant', content: [{ type: 'tool-call', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, args: toolCall.args }] },
                                { role: 'tool', content: [{ type: 'tool-result', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, result: `Error executing tool: ${error.message}. Please try again with corrected arguments.` }] }
                            ],
                            tools: allTools, // Use original allTools for repair attempt definition
                        });
                        const newToolCall = repairResult.toolCalls.find(newTc => newTc.toolName === toolCall.toolName);
                        if (newToolCall) {
                            console.log(`Tool call ${toolCall.toolName} successfully repaired.`);
                            // The SDK expects the arguments as a string for the 'function' type repair
                            return { toolCallType: 'function', toolCallId: toolCall.toolCallId, toolName: newToolCall.toolName, args: JSON.stringify(newToolCall.args) };
                        } else {
                            console.error(`Tool call repair failed for ${toolCall.toolName}: Model did not generate a new call.`); return null;
                        }
                    } catch (repairError: any) {
                        console.error(`Error during tool call repair attempt for ${toolCall.toolName}:`, repairError); return null;
                    }
                }
            });
            // Return the standard stream from the result
            return result.toDataStream(); // Use the suggested toDataStream() method
        } catch (error: any) {
            // Handle specific tool errors
            if (NoSuchToolError.isInstance(error)) {
                 console.error("Tool Error: Model tried to call a tool that doesn't exist:", error.toolName);
                 vscode.window.showErrorMessage(`Error: The AI tried to use an unknown tool: ${error.toolName}`);
            } else if (InvalidToolArgumentsError.isInstance(error)) {
                 console.error("Tool Error: Model provided invalid arguments for tool:", error.toolName, error.message); // Log message instead of non-existent args
                 vscode.window.showErrorMessage(`Error: The AI provided invalid arguments for the tool: ${error.toolName}`);
            } else if (ToolExecutionError.isInstance(error)) {
                 console.error("Tool Error: An error occurred during tool execution:", error.toolName, error.cause);
                 // Check if cause exists and has a message property before accessing it
                 const causeMessage = (error.cause && typeof error.cause === 'object' && 'message' in error.cause) ? (error.cause as Error).message : 'Unknown execution error';
                 vscode.window.showErrorMessage(`Error executing tool ${error.toolName}: ${causeMessage}`);
            // } else if (ToolCallRepairError.isInstance(error)) { // Assuming this error type exists or might be added
            //      console.error("Tool Error: Failed to repair tool call:", error);
            //      vscode.window.showErrorMessage(`Error: Failed to automatically repair the tool call for ${error.toolName}.`);
            } else {
                 // General error handling
                 console.error('Error calling AI SDK:', error);
                 vscode.window.showErrorMessage(`Error interacting with AI: ${error.message}`);
            }
            console.error('Error calling AI SDK:', error);
            vscode.window.showErrorMessage(`Error interacting with AI: ${error.message}`);
            // Remove the last user message if the initial streamText call failed entirely
            this.conversationHistory.pop();
            return null;
        }
    }

    // --- Tool Definitions and Execution Implementations Removed ---
    // Tool definitions and execution logic are now handled by the imported 'allTools'
    // from '../tools'. The Vercel AI SDK's `streamText` function will automatically
    // call the `execute` method within each tool definition in `allTools`.

    // Method to add assistant response to history (called after streaming)
    // Simplify content type to string for basic text responses
    // Add assistant text response (can be empty if only tools were called)
    public addAssistantResponseToHistory(content: string | undefined) {
        if (content) { // Only add if there's text content
            this.conversationHistory.push({ role: 'assistant', content });
        }
        // TODO: Persist conversation history
    }

     // Method to add tool call and result to history
     // Use ToolCallPart and ToolResultPart for better typing
     public addToolCallToHistory(toolCall: ToolCallPart) {
        this.conversationHistory.push({
            role: 'assistant',
            content: [toolCall] // Directly use the ToolCallPart
        });
     }

     public addToolResultToHistory(toolResult: ToolResultPart) {
         this.conversationHistory.push({
             role: 'tool',
             content: [toolResult] // Directly use the ToolResultPart
         });
     }

    // --- API Key Management ---

    public async setApiKey(providerKeyConstant: keyof typeof SECRET_KEYS, apiKey: string): Promise<void> {
        const secretKey = SECRET_KEYS[providerKeyConstant];
        if (!secretKey) {
            throw new Error(`Invalid provider key constant: ${providerKeyConstant}`);
        }
        await this.context.secrets.store(secretKey, apiKey);
        // Update the in-memory key as well
        switch (providerKeyConstant) {
            case 'ANTHROPIC': this.anthropicApiKey = apiKey; break;
            case 'GOOGLE': this.googleApiKey = apiKey; break;
            case 'OPENROUTER': this.openRouterApiKey = apiKey; break;
            case 'DEEPSEEK': this.deepseekApiKey = apiKey; break;
        }
        console.log(`API Key for ${providerKeyConstant} stored successfully.`);
        vscode.window.showInformationMessage(`API Key for ${providerKeyConstant} updated.`);
    }

    public async getApiKey(providerKeyConstant: keyof typeof SECRET_KEYS): Promise<string | undefined> {
         const secretKey = SECRET_KEYS[providerKeyConstant];
         if (!secretKey) {
             throw new Error(`Invalid provider key constant: ${providerKeyConstant}`);
         }
        return await this.context.secrets.get(secretKey);
    }

     public async deleteApiKey(providerKeyConstant: keyof typeof SECRET_KEYS): Promise<void> {
         const secretKey = SECRET_KEYS[providerKeyConstant];
         if (!secretKey) {
             throw new Error(`Invalid provider key constant: ${providerKeyConstant}`);
         }
         await this.context.secrets.delete(secretKey);
         // Clear the in-memory key
         switch (providerKeyConstant) {
             case 'ANTHROPIC': this.anthropicApiKey = undefined; break;
             case 'GOOGLE': this.googleApiKey = undefined; break;
             case 'OPENROUTER': this.openRouterApiKey = undefined; break;
             case 'DEEPSEEK': this.deepseekApiKey = undefined; break;
         }
         console.log(`API Key for ${providerKeyConstant} deleted.`);
         vscode.window.showInformationMessage(`API Key for ${providerKeyConstant} deleted.`);
     }
}