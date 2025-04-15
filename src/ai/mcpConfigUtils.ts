import * as vscode from 'vscode';
import * as path from 'path'; // Import path module

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
 * Gets the expected URI for the global MCP configuration file.
 */
export function getGlobalMcpConfigUri(context: vscode.ExtensionContext): vscode.Uri {
    return vscode.Uri.joinPath(context.globalStorageUri, 'settings', 'mcp_settings.json');
}

/**
 * Gets the expected URI for the project-specific MCP configuration file (in the first workspace folder).
 * Returns undefined if no workspace is open.
 */
export function getProjectMcpConfigUri(): vscode.Uri | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return vscode.Uri.joinPath(workspaceFolders[0].uri, '.zen', 'mcp_servers.json');
    }
    return undefined;
}


/**
 * Loads global and project-specific MCP configurations and merges them.
 * Project configurations override global configurations.
 */
export async function loadAndMergeMcpConfigs(context: vscode.ExtensionContext): Promise<{ [serverName: string]: McpServerConfig }> {
    console.log("[McpConfigUtils] Loading and merging MCP server configurations...");
    const globalConfigUri = getGlobalMcpConfigUri(context);
    const globalConfigs = await readMcpConfigFile(globalConfigUri);
    console.log(`[McpConfigUtils] Read ${Object.keys(globalConfigs).length} servers from global config: ${globalConfigUri.fsPath}`);

    let projectConfigs: { [serverName: string]: McpServerConfig } = {};
    const projectConfigUri = getProjectMcpConfigUri();
    if (projectConfigUri) {
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
    const globalConfigUri = getGlobalMcpConfigUri(context);
    const globalSettingsDirUri = vscode.Uri.joinPath(globalConfigUri, '..'); // Get parent directory
    const globalWatcherPattern = new vscode.RelativePattern(globalSettingsDirUri, path.basename(globalConfigUri.fsPath));
    const globalMcpConfigWatcher = vscode.workspace.createFileSystemWatcher(globalWatcherPattern);
    globalMcpConfigWatcher.onDidChange(reloadCallback);
    globalMcpConfigWatcher.onDidCreate(reloadCallback);
    globalMcpConfigWatcher.onDidDelete(reloadCallback);
    watchers.push(globalMcpConfigWatcher);
    console.log(`[McpConfigUtils] Watching global MCP config: ${globalConfigUri.fsPath}`); // Use globalConfigUri.fsPath

    // Watch project config file
    const projectConfigUri = getProjectMcpConfigUri();
    if (projectConfigUri) {
        const projectConfigPattern = new vscode.RelativePattern(vscode.Uri.joinPath(projectConfigUri, '../..'), '.zen/mcp_servers.json'); // Adjust relative pattern base
        const mcpConfigWatcher = vscode.workspace.createFileSystemWatcher(projectConfigPattern);
        mcpConfigWatcher.onDidChange(reloadCallback);
        mcpConfigWatcher.onDidCreate(reloadCallback);
        mcpConfigWatcher.onDidDelete(reloadCallback);
        watchers.push(mcpConfigWatcher);
        console.log(`[McpConfigUtils] Watching project MCP config: ${projectConfigPattern.baseUri.fsPath}/${projectConfigPattern.pattern}`);
    }

    return watchers;
}
