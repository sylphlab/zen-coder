import * as vscode from 'vscode';
import { ToolSet, experimental_createMCPClient } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

import {
    McpServerConfig,
    McpConfigFile, // Keep if needed internally, maybe not
    loadAndMergeMcpConfigs,
    setupMcpConfigWatchers
} from './mcpConfigUtils'; // Import helpers and types

// Interface for status remains here as it's exported by McpManager
export interface McpServerStatus {
    config: McpServerConfig; // Use imported type
    enabled: boolean;
    isConnected: boolean;
    tools?: ToolSet;
    lastError?: string;
}

// --- McpManager Class ---

export class McpManager {
    private _configWatchers: vscode.Disposable[] = []; // Store watcher disposables
    private _mergedMcpConfigs: { [serverName: string]: McpServerConfig } = {};
    private _activeMcpClients: Map<string, any> = new Map(); // { serverName: clientInstance }
    private _mcpServerTools: Map<string, ToolSet> = new Map(); // { serverName: ToolSet }
    private _mcpConnectionErrors: Map<string, string> = new Map(); // { serverName: errorMsg }
    private _isWebviewSubscribed: boolean = false; // Track webview subscription status

    constructor(
        private context: vscode.ExtensionContext,
        private _postMessageCallback?: (message: any) => void // Renamed for clarity
    ) {
        // Initial load of MCP configs using imported function
        loadAndMergeMcpConfigs(context).then(configs => {
            this._mergedMcpConfigs = configs;
            const activeCount = Object.values(configs).filter(c => !c.disabled).length;
            console.log(`[McpManager] Initial MCP configs loaded: ${Object.keys(configs).length} total servers, ${activeCount} active.`);
            // Initialize MCP clients after loading configs
            this._initializeMcpClients(); // Don't await here, let it run in background
        });

        // Setup file watchers using imported function
        const reloadCallback = async (uri?: vscode.Uri) => {
            console.log(`[McpManager] MCP config file changed (${uri?.fsPath || 'unknown'}), reloading and re-initializing clients...`);
            await this._closeAllMcpClients();
            this._mergedMcpConfigs = await loadAndMergeMcpConfigs(this.context); // Use imported function
            await this._initializeMcpClients(); // Await here to ensure re-init completes
            // Notify UI about the reload so it can refresh the status display
            this._postMessageCallback?.({ type: 'mcpConfigReloaded' });
        };
        this._configWatchers = setupMcpConfigWatchers(context, reloadCallback);
        this.context.subscriptions.push(...this._configWatchers); // Add watchers to subscriptions
    }

    // --- Public Accessors ---

    public getMcpServerTools(): Map<string, ToolSet> {
        return this._mcpServerTools;
    }

    // Config loading and watching logic moved to mcpConfigUtils.ts

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
        this._notifyWebviewOfStatusUpdate(); // Use helper to notify if subscribed
    }

    /**
     * Creates the appropriate transport object based on server config.
     * Returns null and records error if config is invalid.
     */
    private _createMcpTransport(serverName: string, config: McpServerConfig): { transport: Experimental_StdioMCPTransport | { type: 'sse'; url: string; headers?: Record<string, string> }, type: 'stdio' | 'sse' } | null {
        let transport: Experimental_StdioMCPTransport | { type: 'sse'; url: string; headers?: Record<string, string> };
        let serverType: 'stdio' | 'sse';

        if (config.command) {
            serverType = 'stdio';
            transport = new Experimental_StdioMCPTransport({
                command: config.command!, args: config.args || [], cwd: config.cwd, env: config.env,
            });
        } else if (config.url) {
            serverType = 'sse';
            transport = { type: 'sse', url: config.url!, headers: config.headers };
        } else {
            const errorMsg = `MCP server '${serverName}' has neither 'command' nor 'url' defined.`;
            console.error(`[McpManager] ${errorMsg}`);
            this._mcpConnectionErrors.set(serverName, errorMsg);
            return null;
        }
        return { transport, type: serverType };
    }

    /**
     * Attempts to establish an MCP connection with a timeout.
     * Returns the client instance on success, null on failure (and records error).
     */
    private async _attemptMcpConnection(serverName: string, transportInfo: { transport: any, type: 'stdio' | 'sse' }): Promise<any | null> {
        try {
            console.log(`[McpManager] Attempting connection to MCP server: ${serverName} (${transportInfo.type})`);
            const connectPromise = experimental_createMCPClient({ transport: transportInfo.transport });
            // Increased timeout slightly to 20s
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out (20s)')), 20000));
            const client = await Promise.race([connectPromise, timeoutPromise]);
            console.log(`[McpManager] Successfully connected MCP client for: ${serverName}.`);
            return client;
        } catch (error: any) {
            const errorMsg = `Connection failed: ${error.message || error}`;
            console.error(`[McpManager] ${errorMsg} for MCP server '${serverName}'`);
            this._mcpConnectionErrors.set(serverName, errorMsg);
            return null;
        }
    }

    /**
     * Fetches tools from a connected client and stores them.
     * Returns true on success, false on failure (and records error).
     */
    private async _fetchAndStoreMcpTools(serverName: string, client: any): Promise<boolean> {
        try {
            console.log(`[McpManager] Fetching tools for ${serverName}...`);
            const tools = await (client as any).tools(); // Cast client to any to access tools()
            this._mcpServerTools.set(serverName, tools);
            console.log(`[McpManager] Fetched and stored ${Object.keys(tools).length} tools for ${serverName}.`);
            return true; // Tool fetch successful
        } catch (toolError: any) {
            const errorMsg = `Failed to fetch tools: ${toolError.message || toolError}`;
            console.error(`[McpManager] Connection succeeded for '${serverName}', but ${errorMsg}`);
            this._mcpConnectionErrors.set(serverName, errorMsg);
            return false; // Indicate tool fetch failed
        }
    }


    /**
     * Helper to connect and fetch tools for a single server, using sub-helpers.
     * Returns true if the connection attempt was made and client stored (even if tool fetch failed),
     * false if the connection itself failed or config was invalid.
     */
    private async _connectAndFetchTools(serverName: string, config: McpServerConfig): Promise<boolean> {
        this._mcpConnectionErrors.delete(serverName); // Clear previous error

        const transportInfo = this._createMcpTransport(serverName, config);
        if (!transportInfo) return false; // Error handled in _createMcpTransport

        const client = await this._attemptMcpConnection(serverName, transportInfo);
        if (!client) {
            // Error handled in _attemptMcpConnection
            // Ensure client isn't left in maps if connection failed
            if (this._activeMcpClients.has(serverName)) {
                 const clientToClose = this._activeMcpClients.get(serverName);
                 this._activeMcpClients.delete(serverName);
                 this._mcpServerTools.delete(serverName);
                 try { await clientToClose?.close(); } catch (e) { console.error("Error closing client after connection failure:", e); }
            }
            return false; // Connection failed
        }

        // Connection successful, store client
        this._activeMcpClients.set(serverName, client);

        // Fetch and store tools
        await this._fetchAndStoreMcpTools(serverName, client); // We store the client even if tool fetch fails

        // Return true because the connection itself was successful (or at least attempted and client stored)
        return true;
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
        this._notifyWebviewOfStatusUpdate(); // Use helper to notify if subscribed
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

    /**
     * Sets the subscription status of the webview.
     * @param isSubscribed Whether the webview is currently subscribed to updates.
     */
    public setWebviewSubscription(isSubscribed: boolean): void {
        console.log(`[McpManager] Webview subscription status set to: ${isSubscribed}`);
        this._isWebviewSubscribed = isSubscribed;
    }

    /**
     * Helper method to send status updates to the webview, only if subscribed.
     */
    private _notifyWebviewOfStatusUpdate(): void {
        if (this._isWebviewSubscribed && this._postMessageCallback) {
            const status = this.getMcpServerConfiguredStatus();
            console.log(`[McpManager] Notifying subscribed webview of MCP status update for ${Object.keys(status).length} servers.`);
            this._postMessageCallback({ type: 'updateMcpConfiguredStatus', payload: status });
        } else {
            // console.log("[McpManager] Webview not subscribed, skipping MCP status update notification.");
        }
    }

    // Dispose watchers on deactivation
    public dispose(): void {
        console.log("[McpManager] Disposing McpManager...");
        // Dispose watchers returned by setupMcpConfigWatchers
        this._configWatchers.forEach(watcher => watcher.dispose());
        this._configWatchers = [];
        console.log("[McpManager] MCP config watchers disposed.");
        // Close active MCP clients
        this._closeAllMcpClients(); // Call the closing method (no await needed in sync dispose)
        console.log("[McpManager] McpManager disposed.");
    }
}