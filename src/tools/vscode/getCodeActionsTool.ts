import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import path from 'path';

// Define the structure for the input range
const rangeSchema = z.object({
    startLine: z.number().int().describe('Start line number (0-based).'),
    startChar: z.number().int().describe('Start character position (0-based).'),
    endLine: z.number().int().describe('End line number (0-based).'),
    endChar: z.number().int().describe('End character position (0-based).'),
}).describe('The range in the document to get code actions for.');

// Define the structure for a single code action in the output
const codeActionItemSchema = z.object({
    title: z.string().describe('The user-facing title of the code action.'),
    kind: z.string().optional().describe('The kind of code action (e.g., "quickfix", "refactor.extract").'),
    isPreferred: z.boolean().optional().describe('Whether this action is preferred by the provider.'),
    // We might need a way to reference this action later for an 'apply' tool.
    // For now, just return descriptive info. Storing the full edit/command is complex.
    // actionId: z.string().describe('A temporary ID to reference this action for applying.') // Placeholder idea
});

export const getCodeActionsTool = tool({
    description: 'Gets available code actions (like quick fixes, refactorings) for a specific range within a file.',
    parameters: z.object({
        filePath: z.string().describe('Workspace-relative path to the file.'),
        range: rangeSchema,
        // Optional filter for action kinds (e.g., only quick fixes)
        kindFilter: z.string().optional().describe('Filter actions by kind (e.g., "quickfix", "refactor"). Prefix with "." to include subgroups (e.g., ".refactor").'),
    }),
    execute: async ({ filePath, range, kindFilter }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getCodeActionsTool', status: 'processing', message: `Getting code actions for ${filePath} at [${range.startLine}:${range.startChar}-${range.endLine}:${range.endChar}]...` });
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

            // Define context for getCodeActions
            const context: vscode.CodeActionContext = {
                diagnostics: vscode.languages.getDiagnostics(targetUri).filter(d =>
                    vscodeRange.intersection(d.range) // Get diagnostics overlapping the range
                ),
                triggerKind: vscode.CodeActionTriggerKind.Invoke, // Simulate manual trigger
                // Initialize 'only' based on kindFilter
                only: kindFilter ? vscode.CodeActionKind.Empty.append(kindFilter) : undefined,
            };

            // Get code actions using executeCommand
            // The result can be a mix of Command and CodeAction objects
            const actionsOrCommands = await vscode.commands.executeCommand<(vscode.Command | vscode.CodeAction)[]>(
                'vscode.executeCodeActionProvider',
                targetUri,
                vscodeRange,
                context.only?.value // Pass the kind string if available
            );


            if (!actionsOrCommands || actionsOrCommands.length === 0) {
                 const message = 'No code actions found for the specified range.';
                 if (data && toolCallId) {
                    data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getCodeActionsTool', status: 'complete', message: message });
                 }
                return { success: true, actions: [], message: message };
            }

            // Filter out Commands and map CodeActions to the simplified output schema
            const resultActions = actionsOrCommands
                .filter((actionOrCommand): actionOrCommand is vscode.CodeAction => 'title' in actionOrCommand) // Filter for CodeAction (has title)
                .map((action: vscode.CodeAction) => ({ // Explicitly type action
                    title: action.title,
                    kind: action.kind?.value,
                    isPreferred: action.isPreferred,
                    // Storing action.edit or action.command is complex for serialization/later use by AI
                }));

            // Validate the output
            const validationResult = z.array(codeActionItemSchema).safeParse(resultActions);
             if (!validationResult.success) {
                console.error("getCodeActionsTool validation error:", validationResult.error);
                throw new Error("Internal error: Failed to format code action results.");
            }

            const message = `Found ${validationResult.data.length} code action(s).`;
            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getCodeActionsTool', status: 'complete', message: message });
            }
            return { success: true, actions: validationResult.data };

        } catch (error: any) {
            let errorMessage = `Failed to get code actions.`;
            if (error instanceof Error) {
                errorMessage += ` Reason: ${error.message}`;
            } else {
                errorMessage += ` Unknown error: ${String(error)}`;
            }
            console.error(`getCodeActionsTool Error: ${error}`);
             if (data && toolCallId) {
                 data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getCodeActionsTool', status: 'error', message: errorMessage });
             }
            return { success: false, error: errorMessage };
        }
    },
});