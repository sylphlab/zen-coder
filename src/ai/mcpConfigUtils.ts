import * as vscode from 'vscode';

// --- Interfaces ---

export interface McpServerConfig {
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    url?: string;
    headers?: Record<string, string>;
    alwaysAllow?: string[];
    disabled?: boolean;
}

export interface McpConfigFile {
    mcpServers: {
        [serverName: string]: McpServerConfig;
    };
}

// --- Helper Functions ---

/**
 * Reads an MCP configuration file from a given URI.
 * Returns an empty object if the file is not found or has invalid format.
 */
export async function readMcpConfigFile(uri: vscode.Uri): Promise<{ [serverName: string]: McpServerConfig }> {
    try {
        const fileContent = await vscode.workspace.fs.readFile(uri);
        const jsonData = JSON.parse(Buffer.from(fileContent).toString('utf8')) as McpConfigFile;
        if (jsonData && typeof jsonData.mcpServers === 'object' && jsonData.mcpServers !== null) {
            return jsonData.mcpServers;
        }
        console.warn(`[McpConfigUtils] Invalid format (expected mcpServers object) in MCP config file: ${uri.fsPath}`);
        return {};
    } catch (error: any) {
        if (error.code !== 'FileNotFound') {
            console.error(`[McpConfigUtils] Error reading or parsing MCP config file ${uri.fsPath}:`, error);
            vscode.window.showWarningMessage(`Error reading MCP config ${uri.fsPath}. Check format.`);
        }
        return {};
    }
}

/**
 * Loads global and project-specific MCP configurations and merges them.
 * Project configurations override global configurations.
 */
export async function loadAndMergeMcpConfigs(context: vscode.ExtensionContext): Promise<{ [serverName: string]: McpServerConfig }> {
    console.log("[McpConfigUtils] Loading and merging MCP server configurations...");
    const globalConfigUri = vscode.Uri.joinPath(context.globalStorageUri, 'settings', 'mcp_settings.json');
    const globalConfigs = await readMcpConfigFile(globalConfigUri);
    console.log(`[McpConfigUtils] Read ${Object.keys(globalConfigs).length} servers from global config: ${globalConfigUri.fsPath}`);

    let projectConfigs: { [serverName: string]: McpServerConfig } = {};
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const projectConfigUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode', 'mcp_servers.json');
        projectConfigs = await readMcpConfigFile(projectConfigUri);
        console.log(`[McpConfigUtils] Read ${Object.keys(projectConfigs).length} servers from project config: ${projectConfigUri.fsPath}`);
    }

    const mergedConfigs = { ...globalConfigs, ...projectConfigs }; // Project overrides global
    const finalConfigCount = Object.keys(mergedConfigs).length;
    const activeCount = Object.values(mergedConfigs).filter(c => !c.disabled).length;
    console.log(`[McpConfigUtils] Merged MCP configs. Total servers: ${finalConfigCount}, Active servers: ${activeCount}`);
    return mergedConfigs;
}

/**
 * Sets up file system watchers for global and project MCP configuration files.
 * Calls the provided reloadCallback when changes are detected.
 * Returns an array of disposables (the watchers).
 */
export function setupMcpConfigWatchers(
    context: vscode.ExtensionContext,
    reloadCallback: (uri?: vscode.Uri) => void
): vscode.Disposable[] {
    const watchers: vscode.Disposable[] = [];

    // Watch global config file
    const globalSettingsDirUri = vscode.Uri.joinPath(context.globalStorageUri, 'settings');
    const globalConfigPath = vscode.Uri.joinPath(globalSettingsDirUri, 'mcp_settings.json').fsPath;
    const globalWatcherPattern = new vscode.RelativePattern(globalSettingsDirUri, 'mcp_settings.json');
    const globalMcpConfigWatcher = vscode.workspace.createFileSystemWatcher(globalWatcherPattern);
    globalMcpConfigWatcher.onDidChange(reloadCallback);
    globalMcpConfigWatcher.onDidCreate(reloadCallback);
    globalMcpConfigWatcher.onDidDelete(reloadCallback);
    watchers.push(globalMcpConfigWatcher);
    console.log(`[McpConfigUtils] Watching global MCP config: ${globalConfigPath}`);

    // Watch project config file
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        const projectConfigPattern = new vscode.RelativePattern(workspaceFolders[0], '.vscode/mcp_servers.json');
        const mcpConfigWatcher = vscode.workspace.createFileSystemWatcher(projectConfigPattern);
        mcpConfigWatcher.onDidChange(reloadCallback);
        mcpConfigWatcher.onDidCreate(reloadCallback);
        mcpConfigWatcher.onDidDelete(reloadCallback);
        watchers.push(mcpConfigWatcher);
        console.log(`[McpConfigUtils] Watching project MCP config: ${projectConfigPattern.baseUri.fsPath}/${projectConfigPattern.pattern}`);
    }

    return watchers;
}