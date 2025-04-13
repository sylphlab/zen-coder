import * as vscode from 'vscode';
import { ToolSet, experimental_createMCPClient } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

// --- Interfaces (Copied from AiService) ---

interface McpServerConfig {
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    alwaysAllow?: string[];
    disabled?: boolean;
}

interface McpConfigFile {
    mcpServers: {
        [serverName: string]: McpServerConfig;
    };
}

export interface McpServerStatus {
    config: McpServerConfig;
    enabled: boolean;
    isConnected: boolean;
    tools?: ToolSet;
    lastError?: string;
}

// --- McpManager Class ---

export class McpManager {
    private _mcpConfigWatcher: vscode.FileSystemWatcher | undefined;
    private _globalMcpConfigWatcher: vscode.FileSystemWatcher | undefined;
    private _mergedMcpConfigs: { [serverName: string]: McpServerConfig } = {};
    private _activeMcpClients: Map<string, any> = new Map(); // { serverName: clientInstance }
    private _mcpServerTools: Map<string, ToolSet> = new Map(); // { serverName: ToolSet }
    private _mcpConnectionErrors: Map<string, string> = new Map(); // { serverName: errorMsg }

    constructor(
        private context: vscode.ExtensionContext,
        private postMessageCallback?: (message: any) => void // Optional callback for UI updates
    ) {
        // Initial load of MCP configs
        this._loadAndMergeMcpConfigs().then(configs => {
            this._mergedMcpConfigs = configs;
            const activeCount = Object.values(configs).filter(c => !c.disabled).length;
            console.log(`[McpManager] Initial MCP configs loaded: ${Object.keys(configs).length} total servers, ${activeCount} active.`);
            // Initialize MCP clients after loading configs
            this._initializeMcpClients(); // Don't await here, let it run in background
        });

        // Setup file watchers
        this._setupMcpConfigWatchers();
    }

    // --- Public Accessors ---

    public getMcpServerTools(): Map<string, ToolSet> {
        return this._mcpServerTools;
    }

    // --- Config Loading and Watching ---

    private async _readMcpConfigFile(uri: vscode.Uri): Promise<{ [serverName: string]: McpServerConfig }> {
        try {
            const fileContent = await vscode.workspace.fs.readFile(uri);
            const jsonData = JSON.parse(Buffer.from(fileContent).toString('utf8')) as McpConfigFile;
            if (jsonData && typeof jsonData.mcpServers === 'object' && jsonData.mcpServers !== null) {
                return jsonData.mcpServers;
            }
            console.warn(`[McpManager] Invalid format (expected mcpServers object) in MCP config file: ${uri.fsPath}`);
            return {};
        } catch (error: any) {
            if (error.code !== 'FileNotFound') {
                console.error(`[McpManager] Error reading or parsing MCP config file ${uri.fsPath}:`, error);
                vscode.window.showWarningMessage(`Error reading MCP config ${uri.fsPath}. Check format.`);
            }
            return {};
        }
    }

    private async _loadAndMergeMcpConfigs(): Promise<{ [serverName: string]: McpServerConfig }> {
        console.log("[McpManager] Loading and merging MCP server configurations...");
        const globalConfigUri = vscode.Uri.joinPath(this.context.globalStorageUri, 'settings', 'mcp_settings.json');
        const globalConfigs = await this._readMcpConfigFile(globalConfigUri);
        console.log(`[McpManager] Read ${Object.keys(globalConfigs).length} servers from global config: ${globalConfigUri.fsPath}`);

        let projectConfigs: { [serverName: string]: McpServerConfig } = {};
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const projectConfigUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode', 'mcp_servers.json');
            projectConfigs = await this._readMcpConfigFile(projectConfigUri);
            console.log(`[McpManager] Read ${Object.keys(projectConfigs).length} servers from project config: ${projectConfigUri.fsPath}`);
        }

        const mergedConfigs = { ...globalConfigs, ...projectConfigs }; // Project overrides global
        const finalConfigCount = Object.keys(mergedConfigs).length;
        const activeCount = Object.values(mergedConfigs).filter(c => !c.disabled).length;
        console.log(`[McpManager] Merged MCP configs. Total servers: ${finalConfigCount}, Active servers: ${activeCount}`);
        return mergedConfigs;
    }

    private _setupMcpConfigWatchers(): void {
        const reloadConfigs = async (uri?: vscode.Uri) => {
            console.log(`[McpManager] MCP config file changed (${uri?.fsPath || 'unknown'}), reloading and re-initializing clients...`);
            await this._closeAllMcpClients();
            this._mergedMcpConfigs = await this._loadAndMergeMcpConfigs();
            await this._initializeMcpClients(); // Await here to ensure re-init completes
            // Notify UI about the reload so it can refresh the status display
            this.postMessageCallback?.({ type: 'mcpConfigReloaded' });
        };

        // Watch global config file
        const globalSettingsDirUri = vscode.Uri.joinPath(this.context.globalStorageUri, 'settings');
        const globalConfigPath = vscode.Uri.joinPath(globalSettingsDirUri, 'mcp_settings.json').fsPath;
        const globalWatcherPattern = new vscode.RelativePattern(globalSettingsDirUri, 'mcp_settings.json');
        this._globalMcpConfigWatcher = vscode.workspace.createFileSystemWatcher(globalWatcherPattern);
        this._globalMcpConfigWatcher.onDidChange(reloadConfigs);
        this._globalMcpConfigWatcher.onDidCreate(reloadConfigs);
        this._globalMcpConfigWatcher.onDidDelete(reloadConfigs);
        this.context.subscriptions.push(this._globalMcpConfigWatcher);
        console.log(`[McpManager] Watching global MCP config: ${globalConfigPath}`);

        // Watch project config file
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const projectConfigPattern = new vscode.RelativePattern(workspaceFolders[0], '.vscode/mcp_servers.json');
            this._mcpConfigWatcher = vscode.workspace.createFileSystemWatcher(projectConfigPattern);
            this._mcpConfigWatcher.onDidChange(reloadConfigs);
            this._mcpConfigWatcher.onDidCreate(reloadConfigs);
            this._mcpConfigWatcher.onDidDelete(reloadConfigs);
            this.context.subscriptions.push(this._mcpConfigWatcher);
            console.log(`[McpManager] Watching project MCP config: ${projectConfigPattern.baseUri.fsPath}/${projectConfigPattern.pattern}`);
        }
    }

    // --- MCP Client Initialization and Management ---

    private async _initializeMcpClients(): Promise<void> {
        console.log('[McpManager] Initializing MCP clients...');
        this._activeMcpClients.clear();
        this._mcpServerTools.clear();
        this._mcpConnectionErrors.clear();
        const configs = this._mergedMcpConfigs;

        const clientPromises = Object.entries(configs).map(async ([serverName, config]) => {
            if (config.disabled) {
                console.log(`[McpManager] Skipping disabled MCP server during init: ${serverName}`);
                return;
            }
            await this._connectAndFetchTools(serverName, config); // Use helper
        });

        await Promise.all(clientPromises);
        console.log(`[McpManager] MCP client initialization complete. Active clients: ${this._activeMcpClients.size}`);
        // Notify UI after initial connections attempt
        this.postMessageCallback?.({ type: 'updateMcpConfiguredStatus', payload: this.getMcpServerConfiguredStatus() });
    }

    // Helper to connect and fetch tools for a single server
    private async _connectAndFetchTools(serverName: string, config: McpServerConfig): Promise<boolean> {
        this._mcpConnectionErrors.delete(serverName); // Clear previous error for this server
        let transport: Experimental_StdioMCPTransport | { type: 'sse'; url: string; headers?: Record<string, string> } | undefined;
        let serverType: 'stdio' | 'sse' | 'unknown' = 'unknown';

        if (config.command) serverType = 'stdio';
        else if (config.url) serverType = 'sse';
        else {
            const errorMsg = `MCP server '${serverName}' has neither 'command' nor 'url' defined.`;
            console.error(`[McpManager] ${errorMsg}`);
            this._mcpConnectionErrors.set(serverName, errorMsg);
            return false;
        }

        try {
            console.log(`[McpManager] Attempting connection to MCP server: ${serverName} (${serverType})`);
            if (serverType === 'stdio') {
                transport = new Experimental_StdioMCPTransport({
                    command: config.command!, args: config.args || [], cwd: config.cwd, env: config.env,
                });
            } else { // sse
                transport = { type: 'sse', url: config.url!, headers: config.headers };
            }

            const connectPromise = experimental_createMCPClient({ transport });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out (15s)')), 15000));

            const client = await Promise.race([connectPromise, timeoutPromise]);
            console.log(`[McpManager] Successfully connected MCP client for: ${serverName}. Fetching tools...`);
            this._activeMcpClients.set(serverName, client);

            // Fetch and store tools
            try {
                const tools = await (client as any).tools(); // Cast client to any to access tools()
                this._mcpServerTools.set(serverName, tools);
                console.log(`[McpManager] Fetched and stored ${Object.keys(tools).length} tools for ${serverName}.`);
                return true; // Connection and tool fetch successful
            } catch (toolError: any) {
                const errorMsg = `Failed to fetch tools: ${toolError.message || toolError}`;
                console.error(`[McpManager] Connection succeeded for '${serverName}', but ${errorMsg}`);
                this._mcpConnectionErrors.set(serverName, errorMsg);
                // Keep client active, but record the error
                return false; // Indicate partial failure (connected but no tools)
            }
        } catch (error: any) {
            const errorMsg = `Connection failed: ${error.message || error}`;
            console.error(`[McpManager] ${errorMsg} for MCP server '${serverName}'`);
            this._mcpConnectionErrors.set(serverName, errorMsg);
            // Ensure client isn't left in maps if connection failed
            if (this._activeMcpClients.has(serverName)) {
                 const clientToClose = this._activeMcpClients.get(serverName);
                 this._activeMcpClients.delete(serverName);
                 this._mcpServerTools.delete(serverName);
                 try { await clientToClose?.close(); } catch (e) { console.error("Error closing client after connection failure:", e); }
            }
            return false; // Connection failed
        }
    }


    private async _closeAllMcpClients(): Promise<void> {
        console.log(`[McpManager] Closing ${this._activeMcpClients.size} active MCP clients...`);
        const closePromises = Array.from(this._activeMcpClients.entries()).map(async ([serverName, client]) => {
            try {
                console.log(`[McpManager] Closing client: ${serverName}`);
                await client.close();
                console.log(`[McpManager] Closed client: ${serverName}`);
            } catch (closeError) {
                console.error(`[McpManager] Error closing MCP client '${serverName}':`, closeError);
            }
        });
        await Promise.all(closePromises);
        this._activeMcpClients.clear();
        this._mcpServerTools.clear();
        this._mcpConnectionErrors.clear(); // Clear errors as well
        console.log('[McpManager] Finished closing all MCP clients.');
    }

    // --- MCP Server Retry Logic ---

    /**
     * Attempts to connect to a single, previously failed MCP server.
     * Updates the active clients and tools maps if successful.
     * Notifies the UI about the result.
     * @param serverName The name of the server to retry.
     */
    public async retryMcpConnection(serverName: string): Promise<void> {
        console.log(`[McpManager] Retrying connection for MCP server: ${serverName}`);
        const config = this._mergedMcpConfigs[serverName];
        let success = false;

        if (!config) {
            console.error(`[McpManager] Retry failed: Config not found for ${serverName}.`);
            this._mcpConnectionErrors.set(serverName, "Configuration not found.");
        } else if (config.disabled) {
            console.log(`[McpManager] Retry skipped: Server ${serverName} is disabled.`);
            // Should not happen if UI disables button, but handle anyway
        } else if (this._activeMcpClients.has(serverName)) {
            console.log(`[McpManager] Retry skipped: Server ${serverName} is already connected.`);
            // If already connected, try fetching tools again in case it failed initially
            const client = this._activeMcpClients.get(serverName);
            if (client && !this._mcpServerTools.has(serverName)) {
                 try {
                     console.log(`[McpManager] Client ${serverName} already connected, attempting to fetch tools again...`);
                     const tools = await (client as any).tools(); // Cast client to any to access tools()
                     this._mcpServerTools.set(serverName, tools);
                     this._mcpConnectionErrors.delete(serverName); // Clear error on success
                     console.log(`[McpManager] Fetched and stored ${Object.keys(tools).length} tools for ${serverName} after retry.`);
                     success = true; // Tool fetch successful
                 } catch (toolError: any) {
                     const errorMsg = `Failed to fetch tools: ${toolError.message || toolError}`;
                     console.error(`[McpManager] Retry: Client ${serverName} connected, but failed again to fetch tools:`, toolError);
                     this._mcpConnectionErrors.set(serverName, errorMsg);
                     success = false; // Indicate tool fetch failed even though connected
                 }
            } else {
                success = true; // Already connected and tools likely already fetched (or failed previously)
            }
        } else {
            // Attempt connection using the helper
            success = await this._connectAndFetchTools(serverName, config);
        }

        // Notify UI immediately after retry attempt
        console.log(`[McpManager] Retry attempt for ${serverName} finished. Success: ${success}. Notifying UI.`);
        this.postMessageCallback?.({ type: 'updateMcpConfiguredStatus', payload: this.getMcpServerConfiguredStatus() });
    }


    // --- MCP Status Reporting ---

    /**
     * Returns the currently loaded and merged MCP server configurations,
     * indicating which are enabled based on the 'disabled' flag,
     * whether a client connection is currently active,
     * the list of tools if connected, and any connection/tool fetch error.
     */
     public getMcpServerConfiguredStatus(): { [serverName: string]: McpServerStatus } {
         const status: { [serverName: string]: McpServerStatus } = {};
         for (const serverName in this._mergedMcpConfigs) {
             if (Object.prototype.hasOwnProperty.call(this._mergedMcpConfigs, serverName)) {
                 const config = this._mergedMcpConfigs[serverName];
                 const isEnabled = !config.disabled;
                 const isConnected = isEnabled && this._activeMcpClients.has(serverName);
                 const tools = isConnected ? this._mcpServerTools.get(serverName) : undefined;
                 const lastError = this._mcpConnectionErrors.get(serverName); // Get specific error
                 status[serverName] = {
                     config: config,
                     enabled: isEnabled,
                     isConnected: isConnected,
                     tools: tools,
                     lastError: lastError
                 };
             }
         }
         // console.log(`[McpManager] getMcpServerConfiguredStatus returning status for ${Object.keys(status).length} servers.`);
         return status;
     }

    // Method to potentially get current configs (e.g., for settings page if needed later)
    public getMcpServerConfigs(): { [serverName: string]: McpServerConfig } {
        // Return a copy to prevent external modification of the cached object
        return { ...this._mergedMcpConfigs };
    }

    // Dispose watchers on deactivation
    public dispose(): void {
        console.log("[McpManager] Disposing McpManager...");
        // Dispose watchers
        this._mcpConfigWatcher?.dispose();
        this._globalMcpConfigWatcher?.dispose();
        console.log("[McpManager] MCP config watchers disposed.");
        // Close active MCP clients
        this._closeAllMcpClients(); // Call the closing method (no await needed in sync dispose)
        console.log("[McpManager] McpManager disposed.");
    }
}