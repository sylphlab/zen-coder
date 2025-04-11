import * as vscode from 'vscode';
import { CoreMessage, streamText, tool } from 'ai';
// Import the factory function as per documentation
import { createAnthropic } from '@ai-sdk/anthropic';
// Import the correct factory function for Google
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';

// Define keys for SecretStorage
const SECRET_KEYS = {
    ANTHROPIC: 'aiCoder.anthropicApiKey',
    GOOGLE: 'aiCoder.googleApiKey',
    OPENROUTER: 'aiCoder.openRouterApiKey',
    DEEPSEEK: 'aiCoder.deepseekApiKey',
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

// Removed ModelId type definition from here, moved above

// Define the structure for the AI interaction service
// Define the expected structure for the MCP tool executor function
type McpToolExecutor = (serverName: string, toolName: string, args: any) => Promise<any>;

export class AiService {
    private currentModelId: ModelId = 'claude-3-5-sonnet'; // Default model
    private conversationHistory: CoreMessage[] = [];
    private anthropicApiKey: string | undefined;
    private googleApiKey: string | undefined;
    private openRouterApiKey: string | undefined;
    private deepseekApiKey: string | undefined;
    private executeMcpTool: McpToolExecutor; // Store the executor function

    constructor(
        private context: vscode.ExtensionContext,
        mcpToolExecutor: McpToolExecutor // Accept the executor function
    ) {
        this.executeMcpTool = mcpToolExecutor;
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


    public async getAiResponseStream(prompt: string) {
        const modelInstance = this._getProviderInstance();

        if (!modelInstance) {
            // Error message already shown by _getProviderInstance or key check
            return null;
        }

        // Add user prompt to history
        this.conversationHistory.push({ role: 'user', content: prompt });

        try {
            const result = await streamText({
                model: modelInstance,
                messages: this.conversationHistory,
                tools: this.getTools(),
                // onFinish: (result) => {
                //     // Add assistant response to history after streaming finishes
                //     if (result.finishReason === 'stop' || result.finishReason === 'tool-calls') {
                //         this.conversationHistory.push({ role: 'assistant', content: result.text });
                //         // TODO: Persist conversation history
                //     }
                //     console.log("Streaming finished:", result);
                // }
            });
            return result;
        } catch (error: any) {
            console.error('Error calling AI SDK:', error);
            vscode.window.showErrorMessage(`Error interacting with AI: ${error.message}`);
            // Remove the last user message if the call failed
            this.conversationHistory.pop();
            return null;
        }
    }

    // --- Tool Definitions ---
    private getTools() {
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
        try {
            // Use the provided MCP executor function to call the brave-search tool
            const searchResult = await this.executeMcpTool('brave-search', 'brave_web_search', { query: query, count: 5 }); // Request 5 results

            // Check if the result has the expected structure (adjust based on actual brave-search output)
            if (searchResult && Array.isArray(searchResult)) {
                 if (searchResult.length === 0) {
                     return `No web search results found for "${query}".`;
                 }
                 // Format the results into a string
                 const formattedResults = searchResult.map((item: any, index: number) =>
                     `${index + 1}. ${item.title || 'No Title'}\n   ${item.url || 'No URL'}\n   ${item.description || 'No Description'}`
                 ).join('\n\n');
                 return `Web search results for "${query}":\n\n${formattedResults}`;
            } else {
                 console.error('Unexpected search result format:', searchResult);
                 return `Received unexpected format from web search for "${query}".`;
            }
        } catch (error: any) {
            console.error(`Error executing web search for "${query}":`, error);
            return `Error performing web search: ${error.message}`;
        }
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