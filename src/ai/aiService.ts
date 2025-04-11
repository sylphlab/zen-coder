import * as vscode from 'vscode';
import { CoreMessage, streamText, tool, NoSuchToolError, InvalidToolArgumentsError, ToolExecutionError, generateText } from 'ai';
// Import the factory function as per documentation
import { createAnthropic } from '@ai-sdk/anthropic';
// Import the correct factory function for Google
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';

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

// Define the known tool names manually for robust typing outside the class
const ALL_TOOL_NAMES = [
    'readFile', 'writeFile', 'listFiles', 'runCommand', 'search',
    'fetch', 'getOpenTabs', 'getActiveTerminals', 'getCurrentTime'
] as const; // Use const assertion

// Derive the union type from the constant array
type ToolName = typeof ALL_TOOL_NAMES[number];


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

        // Iterate over the predefined tool names
        for (const toolName of ALL_TOOL_NAMES) {
            if (config.get<boolean>(`${toolName}.enabled`, true)) { // Default to true if not set
                activeToolNames.push(toolName);
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

        const allTools = this._getAllToolDefinitions();
        const activeToolNames = this._getActiveToolNames();

        // Only proceed if there are active tools or if tools are not required by the model implicitly
        // Note: Some models might error if tools are provided but none are active.
        // Consider adding logic here or using toolChoice: 'none' if activeToolNames is empty.

        try {
            const result = await streamText({
                model: modelInstance,
                messages: this.conversationHistory,
                tools: allTools, // Provide all tool definitions
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
                            tools: allTools, // Provide tools again
                            experimental_activeTools: activeToolNames.length > 0 ? activeToolNames : undefined,
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

    // --- Tool Definitions ---
    // Returns all tool definitions, used internally and for getting active tools
    private _getAllToolDefinitions() {
        return {
            readFile: tool({
                description: 'Reads the content of a file specified by its workspace path.',
                parameters: z.object({ path: z.string().describe('Workspace relative path to the file') }),
                execute: async ({ path }) => this.executeReadFile(path),
            }),
            writeFile: tool({
                description: 'Writes content to a file specified by its workspace path. Confirms overwrite.',
                parameters: z.object({
                    path: z.string().describe('Workspace relative path to the file'),
                    content: z.string().describe('Content to write to the file'),
                }),
                execute: async ({ path, content }) => this.executeWriteFile(path, content),
            }),
            listFiles: tool({
                description: 'Lists files and directories at a given path within the workspace.',
                parameters: z.object({ path: z.string().describe('Workspace relative path to list') }),
                execute: async ({ path }) => this.executeListFiles(path),
            }),
            runCommand: tool({
                description: 'Executes a shell command in the integrated terminal after user confirmation.',
                parameters: z.object({ command: z.string().describe('The shell command to execute') }),
                execute: async ({ command }) => this.executeRunCommand(command),
            }),
            search: tool({
                description: 'Performs a web search and returns results.',
                parameters: z.object({ query: z.string().describe('The search query') }),
                execute: async ({ query }) => this.executeSearch(query),
            }),
            fetch: tool({
                description: 'Fetches content from a URL.',
                parameters: z.object({ url: z.string().url().describe('The URL to fetch') }),
                execute: async ({ url }) => this.executeFetch(url),
            }),
            getOpenTabs: tool({
                description: 'Returns a list of currently open file paths in the VS Code editor.',
                parameters: z.object({}),
                execute: async () => this.executeGetOpenTabs(),
            }),
            getActiveTerminals: tool({
                description: 'Returns a list of active VS Code terminal instances (ID, name).',
                parameters: z.object({}),
                execute: async () => this.executeGetActiveTerminals(),
            }),
            getCurrentTime: tool({
                description: 'Returns the current date and time.',
                parameters: z.object({}),
                execute: async () => new Date().toISOString(),
            }),
        };
    }

    // --- Tool Execution Implementations (Placeholders) ---

    private async executeReadFile(filePath: string): Promise<string> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) throw new Error('No workspace open.');
            const rootUri = workspaceFolders[0].uri;
            const fileUri = vscode.Uri.joinPath(rootUri, filePath);

            // Basic path safety check (prevent traversing up)
            if (!fileUri.fsPath.startsWith(rootUri.fsPath)) {
                throw new Error('Access denied: Path is outside the workspace.');
            }

            const contentBytes = await vscode.workspace.fs.readFile(fileUri);
            return new TextDecoder().decode(contentBytes);
        } catch (error: any) {
            console.error(`Error reading file ${filePath}:`, error);
            return `Error reading file: ${error.message}`;
        }
    }

    private async executeWriteFile(filePath: string, content: string): Promise<string> {
         try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) throw new Error('No workspace open.');
            const rootUri = workspaceFolders[0].uri;
            const fileUri = vscode.Uri.joinPath(rootUri, filePath);

            // Basic path safety check
            if (!fileUri.fsPath.startsWith(rootUri.fsPath)) {
                throw new Error('Access denied: Path is outside the workspace.');
            }

            // Check if file exists and confirm overwrite
            let fileExists = false;
            try {
                await vscode.workspace.fs.stat(fileUri);
                fileExists = true;
            } catch (e) {
                // File doesn't exist, proceed to write
            }

            if (fileExists) {
                const confirmation = await vscode.window.showWarningMessage(
                    `File "${filePath}" already exists. Overwrite?`,
                    { modal: true },
                    'Overwrite'
                );
                if (confirmation !== 'Overwrite') {
                    return 'File write cancelled by user.';
                }
            }

            await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
            return `File ${filePath} written successfully.`;
        } catch (error: any) {
            console.error(`Error writing file ${filePath}:`, error);
            return `Error writing file: ${error.message}`;
        }
    }

     private async executeListFiles(dirPath: string): Promise<string> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) throw new Error('No workspace open.');
            const rootUri = workspaceFolders[0].uri;
            const targetUri = vscode.Uri.joinPath(rootUri, dirPath);

            // Basic path safety check
            if (!targetUri.fsPath.startsWith(rootUri.fsPath)) {
                throw new Error('Access denied: Path is outside the workspace.');
            }

            const entries = await vscode.workspace.fs.readDirectory(targetUri);
            // entries is [name, type] tuple array
            const formattedEntries = entries.map(([name, type]) => {
                return `${name}${type === vscode.FileType.Directory ? '/' : ''}`;
            });
            return `Files in ${dirPath}:\n${formattedEntries.join('\n')}`;
        } catch (error: any) {
            console.error(`Error listing files in ${dirPath}:`, error);
            return `Error listing files: ${error.message}`;
        }
    }

    private async executeRunCommand(command: string): Promise<string> {
        // CRUCIAL: User Confirmation
        const confirmation = await vscode.window.showWarningMessage(
            `Allow AI to run the following command?\n\n${command}`,
            { modal: true },
            'Allow'
        );
        if (confirmation !== 'Allow') {
            return 'Command execution cancelled by user.';
        }

        try {
            // Create a new terminal or use an existing one if specified (optional enhancement)
            const terminal = vscode.window.createTerminal(`AI Task: ${command.substring(0, 20)}...`);
            terminal.show();
            terminal.sendText(command); // Executes the command
            // Note: We don't easily get the output here. We just confirm execution.
            return `Command "${command}" sent to terminal for execution.`;
        } catch (error: any) {
            console.error(`Error running command "${command}":`, error);
            return `Error running command: ${error.message}`;
        }
    }

    private async executeSearch(query: string): Promise<string> {
        console.log(`Executing search tool with query: ${query}`);
        // Placeholder implementation - Requires actual MCP client integration
        console.warn(`Search tool called with query: ${query}. MCP integration is required for actual search.`);
        return Promise.resolve(`Search tool execution requires MCP integration. Query was: "${query}"`);
        // Or throw an error:
        // return Promise.reject(new Error('Search tool requires MCP integration.'));
    }

    private async executeFetch(url: string): Promise<string> {
        try {
            // Use Node's fetch API (available in modern Node versions used by VS Code extensions)
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            // Truncate long responses for safety/performance
            const maxLength = 2000;
            return text.length > maxLength ? text.substring(0, maxLength) + '... [truncated]' : text;
        } catch (error: any) {
            console.error(`Error fetching URL ${url}:`, error);
            return `Error fetching URL: ${error.message}`;
        }
    }

     private executeGetOpenTabs(): string {
        const openEditorPaths = vscode.window.tabGroups.all
            .flatMap(tabGroup => tabGroup.tabs)
            .map(tab => tab.input)
            .filter((input): input is vscode.TabInputText => input instanceof vscode.TabInputText) // Only text editors
            .map(input => vscode.workspace.asRelativePath(input.uri, false)); // Get relative path

        if (openEditorPaths.length === 0) {
            return "No files are currently open in the editor.";
        }
        return `Currently open files:\n${openEditorPaths.join('\n')}`;
    }

    private executeGetActiveTerminals(): string {
        const activeTerminals = vscode.window.terminals.map((t, index) => ({
            id: index + 1, // Simple 1-based ID for reference
            name: t.name
        }));

        if (activeTerminals.length === 0) {
            return "No active terminals found.";
        }
        return `Active terminals:\n${activeTerminals.map(t => `${t.id}: ${t.name}`).join('\n')}`;
    }

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