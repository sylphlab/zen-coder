import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import path from 'path';

// Define the structure for the input range (same as getCodeActionsTool)
const rangeSchema = z.object({
    startLine: z.number().int().describe('Start line number (0-based).'),
    startChar: z.number().int().describe('Start character position (0-based).'),
    endLine: z.number().int().describe('End line number (0-based).'),
    endChar: z.number().int().describe('End character position (0-based).'),
}).describe('The range in the document where the code action was originally requested.');

export const applyCodeActionTool = tool({
    description: 'Applies a specific code action (quick fix, refactoring) identified by its index from a previous call to getCodeActionsTool for the same file and range.',
    parameters: z.object({
        filePath: z.string().describe('Workspace-relative path to the file.'),
        range: rangeSchema,
        actionIndex: z.number().int().min(0).describe('The 0-based index of the code action to apply (from the list returned by getCodeActionsTool).'),
        // Optional kindFilter, mirroring getCodeActionsTool, to potentially improve matching reliability
        kindFilter: z.string().optional().describe('Filter actions by kind (e.g., "quickfix", "refactor"). Used to re-fetch actions reliably.'),
    }),
    execute: async ({ filePath, range, actionIndex, kindFilter }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'applyCodeActionTool', status: 'processing', message: `Attempting to apply code action #${actionIndex} for ${filePath}...` });
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder is open.');
            }
            const workspaceRoot = workspaceFolders[0].uri;

            const absolutePath = path.resolve(workspaceRoot.fsPath, filePath);
            if (!absolutePath.startsWith(workspaceRoot.fsPath)) {
                throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
            }
            const targetUri = vscode.Uri.joinPath(workspaceRoot, filePath);

            // Convert input range to vscode.Range
            const vscodeRange = new vscode.Range(
                new vscode.Position(range.startLine, range.startChar),
                new vscode.Position(range.endLine, range.endChar)
            );

            // Re-fetch code actions for the same context to get the actual CodeAction object
            const context: vscode.CodeActionContext = {
                diagnostics: vscode.languages.getDiagnostics(targetUri).filter(d =>
                    vscodeRange.intersection(d.range)
                ),
                triggerKind: vscode.CodeActionTriggerKind.Invoke,
                only: kindFilter ? vscode.CodeActionKind.Empty.append(kindFilter) : undefined,
            };

            const actionsOrCommands = await vscode.commands.executeCommand<(vscode.Command | vscode.CodeAction)[]>(
                'vscode.executeCodeActionProvider',
                targetUri,
                vscodeRange,
                context.only?.value
            );

            if (!actionsOrCommands || actionsOrCommands.length === 0) {
                throw new Error('No code actions found for the specified range when trying to apply.');
            }

            // Filter only CodeActions (ignore Commands returned directly at this stage)
            const codeActions = actionsOrCommands.filter(
                (a): a is vscode.CodeAction => 'title' in a
            );

            // Find the specific action by index
            if (actionIndex < 0 || actionIndex >= codeActions.length) {
                throw new Error(`Invalid actionIndex ${actionIndex}. Only ${codeActions.length} actions available.`);
            }
            const targetAction = codeActions[actionIndex];

            let applySuccess = false;
            let message = '';

            // Apply the action
            if (targetAction.edit) {
                applySuccess = await vscode.workspace.applyEdit(targetAction.edit);
                if (applySuccess) {
                    message = `Successfully applied code action (edit): "${targetAction.title}".`;
                } else {
                    throw new Error(`Failed to apply workspace edit for action: "${targetAction.title}".`);
                }
            } else if (targetAction.command) {
                try {
                    // Execute the command associated with the code action
                    await vscode.commands.executeCommand(targetAction.command.command, ...(targetAction.command.arguments || []));
                    applySuccess = true; // Assume command execution implies success for this tool's purpose
                    message = `Successfully executed command for code action: "${targetAction.title}".`;
                } catch (commandError: any) {
                     throw new Error(`Failed to execute command for action "${targetAction.title}": ${commandError.message}`);
                }
            } else {
                // This shouldn't happen for a valid CodeAction, but handle it just in case.
                throw new Error(`Code action "${targetAction.title}" has neither an edit nor a command to apply.`);
            }

            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'applyCodeActionTool', status: 'complete', message: message });
            }
            return { success: applySuccess, message: message };

        } catch (error: any) {
            let errorMessage = `Failed to apply code action.`;
            if (error instanceof Error) {
                errorMessage += ` Reason: ${error.message}`;
            } else {
                errorMessage += ` Unknown error: ${String(error)}`;
            }
            console.error(`applyCodeActionTool Error: ${error}`);
             if (data && toolCallId) {
                 data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'applyCodeActionTool', status: 'error', message: errorMessage });
             }
            return { success: false, error: errorMessage };
        }
    },
});