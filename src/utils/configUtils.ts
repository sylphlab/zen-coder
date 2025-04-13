import * as vscode from 'vscode';
import * as fs from 'fs'; // Keep fs import if needed, maybe not directly used after refactor
import * as path from 'path'; // Keep path import if needed

/**
 * Opens or creates the MCP configuration file (global or project-specific).
 * @param context The extension context.
 * @param isGlobal True for global config, false for project config.
 */
export async function openOrCreateMcpConfigFile(context: vscode.ExtensionContext, isGlobal: boolean): Promise<void> {
    let configPath: string | undefined;
    let configUri: vscode.Uri | undefined;
    const defaultContent = JSON.stringify({ mcpServers: {} }, null, 4); // Default content

    if (isGlobal) {
        // Use settings subdirectory within global storage
        const settingsDirUri = vscode.Uri.joinPath(context.globalStorageUri, 'settings');
        try {
            // Check if the settings directory exists, create if not
            await vscode.workspace.fs.stat(settingsDirUri);
        } catch (error) {
            // If stat fails (likely doesn't exist), create the directory
            console.log(`Global settings directory not found, creating: ${settingsDirUri.fsPath}`);
            await vscode.workspace.fs.createDirectory(settingsDirUri);
        }
        configUri = vscode.Uri.joinPath(settingsDirUri, 'mcp_settings.json');
        configPath = configUri.fsPath;
        console.log(`Global MCP config path: ${configPath}`);
    } else {
        // Project-specific config
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage("Please open a project folder to configure project-specific MCP servers.");
            return;
        }
        // Use the first workspace folder for simplicity
        const projectRootUri = workspaceFolders[0].uri;
        const vscodeFolderUri = vscode.Uri.joinPath(projectRootUri, '.vscode');
        configUri = vscode.Uri.joinPath(vscodeFolderUri, 'mcp_servers.json');
        configPath = configUri.fsPath;
        console.log(`Project MCP config path: ${configPath}`);

        // Ensure .vscode directory exists
        try {
            await vscode.workspace.fs.stat(vscodeFolderUri);
        } catch (error) {
            console.log(`.vscode directory not found, creating: ${vscodeFolderUri.fsPath}`);
            await vscode.workspace.fs.createDirectory(vscodeFolderUri);
        }
    }

    if (!configUri || !configPath) {
        vscode.window.showErrorMessage("Could not determine the path for the MCP configuration file.");
        return;
    }

    try {
        // Check if file exists
        await vscode.workspace.fs.stat(configUri);
        console.log(`Config file found: ${configPath}`);
    } catch (error) {
        // File does not exist, create it
        console.log(`Config file not found, creating: ${configPath}`);
        try {
            const writeData = Buffer.from(defaultContent, 'utf8');
            await vscode.workspace.fs.writeFile(configUri, writeData);
            console.log(`Successfully created config file: ${configPath}`);
        } catch (writeError) {
            console.error(`Error creating config file ${configPath}:`, writeError);
            vscode.window.showErrorMessage(`Failed to create MCP configuration file at ${configPath}. Check permissions or logs.`);
            return;
        }
    }

    // Open the file in the editor
    try {
        const document = await vscode.workspace.openTextDocument(configUri);
        await vscode.window.showTextDocument(document);
        console.log(`Opened config file: ${configPath}`);
    } catch (openError) {
        console.error(`Error opening config file ${configPath}:`, openError);
        vscode.window.showErrorMessage(`Failed to open MCP configuration file at ${configPath}.`);
    }
}