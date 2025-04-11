import * as vscode from 'vscode';
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText } from 'ai';
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

    public async getAiResponseStream(prompt: string) {
        const modelInstance = this._getProviderInstance();

        if (!modelInstance) {
            // Error message already shown by _getProviderInstance or key check
            return null;
        }

        // Add user prompt to history
        this.conversationHistory.push({ role: 'user', content: prompt });

        // Use the imported allTools directly
        const activeToolNames = this._getActiveToolNames();

        // Only proceed if there are active tools or if tools are not required by the model implicitly
        // Note: Some models might error if tools are provided but none are active.
        // Consider adding logic here or using toolChoice: 'none' if activeToolNames is empty.

        try {
            const result = await streamText({
                model: modelInstance,
                messages: this.conversationHistory,
                tools: allTools, // Provide the imported tool definitions
                experimental_activeTools: activeToolNames.length > 0 ? activeToolNames : undefined, // Activate only enabled tools
                maxSteps: 5, // Allow multiple steps for tool results processing
                // onFinish: (result) => { ... } // Keep existing onFinish logic if needed

                // Experimental Tool Repair (Re-ask Strategy)
                experimental_repairToolCall: async ({ toolCall, error, messages, system }) => {
                    console.warn(`Attempting to repair tool call for ${toolCall.toolName} due to error: ${error.message}`);
                    try {
                        // Re-ask the model with the error message included in the history
                        const repairResult = await generateText({
                            model: modelInstance, // Use the same model instance
                            system: system, // Pass the original system prompt if available
                            messages: [
                                ...messages, // Original messages leading to the failed call
                                {
                                    role: 'assistant',
                                    content: [{ type: 'tool-call', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, args: toolCall.args }]
                                },
                                {
                                    role: 'tool',
                                    content: [{ type: 'tool-result', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, result: `Error executing tool: ${error.message}. Please try again with corrected arguments.` }]
                                }
                            ],
                            tools: allTools, // Provide the imported tool definitions again
                            experimental_activeTools: activeToolNames.length > 0 ? activeToolNames : undefined, // Use the active names
                        });

                        // Find the potentially repaired tool call in the new response
                        const newToolCall = repairResult.toolCalls.find(
                            newTc => newTc.toolName === toolCall.toolName
                        );

                        if (newToolCall) {
                            console.log(`Tool call ${toolCall.toolName} successfully repaired.`);
                            // Return the repaired tool call structure expected by the SDK
                            // Add toolCallType and ensure args are structured correctly (stringified if needed by SDK)
                            // The SDK likely expects args as an object, not stringified here unless generateText returns it that way.
                            return {
                                toolCallType: 'function', // Required property
                                toolCallId: toolCall.toolCallId, // Keep the original ID
                                toolName: newToolCall.toolName,
                                args: JSON.stringify(newToolCall.args), // Use the repaired arguments, stringified
                            };
                        } else {
                            console.error(`Tool call repair failed for ${toolCall.toolName}: Model did not generate a new call.`);
                            return null; // Indicate repair failed
                        }
                    } catch (repairError: any) {
                         console.error(`Error during tool call repair attempt for ${toolCall.toolName}:`, repairError);
                         return null; // Indicate repair failed
                    }
                }
            });
            return result;
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
            // Remove the last user message if the call failed
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
    public addAssistantResponseToHistory(content: string) {
        this.conversationHistory.push({ role: 'assistant', content });
        // TODO: Persist conversation history
    }

     // Method to add tool call and result to history
     public addToolCallToHistory(toolCall: any) { // Use more specific type if available from SDK
        // Assuming toolCall structure needs to be adapted for CoreMessage
        // This might need adjustment based on actual SDK types
        this.conversationHistory.push({
            role: 'assistant',
            content: [{ type: 'tool-call', toolCallId: toolCall.toolCallId, toolName: toolCall.toolName, args: toolCall.args }]
        });
     }

     public addToolResultToHistory(toolResult: any) { // Use more specific type if available from SDK
         this.conversationHistory.push({
             role: 'tool',
             content: [{ type: 'tool-result', toolCallId: toolResult.toolCallId, toolName: toolResult.toolName, result: toolResult.result }]
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