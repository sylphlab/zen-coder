import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import path from 'path';

// Define severity levels based on vscode.DiagnosticSeverity
const severityEnum = z.enum(['Error', 'Warning', 'Information', 'Hint']);
type SeverityLevel = z.infer<typeof severityEnum>;

// Map Zod enum values to vscode.DiagnosticSeverity
const severityMap: Record<SeverityLevel, vscode.DiagnosticSeverity> = {
    'Error': vscode.DiagnosticSeverity.Error,
    'Warning': vscode.DiagnosticSeverity.Warning,
    'Information': vscode.DiagnosticSeverity.Information,
    'Hint': vscode.DiagnosticSeverity.Hint,
};

// Define the structure for a single diagnostic item in the output
const diagnosticItemSchema = z.object({
    filePath: z.string().describe('Relative path to the file containing the diagnostic.'),
    message: z.string().describe('The diagnostic message.'),
    severity: severityEnum.describe('Severity level (Error, Warning, Information, Hint).'),
    source: z.string().optional().describe('The source of the diagnostic (e.g., "eslint", "typescript").'),
    range: z.object({
        startLine: z.number().int().describe('Start line number (0-based).'),
        startChar: z.number().int().describe('Start character position (0-based).'),
        endLine: z.number().int().describe('End line number (0-based).'),
        endChar: z.number().int().describe('End character position (0-based).'),
    }).describe('The range in the document where the diagnostic applies.'),
    code: z.union([z.string(), z.number()]).optional().describe('The diagnostic code, if available.'),
});

export const getDiagnosticsTool = tool({
    description: 'Gets diagnostic problems (errors, warnings, etc.) reported by VS Code for the entire workspace or a specific file.',
    parameters: z.object({
        scope: z.enum(['workspace', 'file']).optional().default('workspace').describe('Scope of diagnostics ("workspace" or "file"). Defaults to "workspace".'),
        filePath: z.string().optional().describe('Workspace-relative path to the file if scope is "file".'),
        severity: severityEnum.optional().default('Warning').describe('Minimum severity level to include. Defaults to "Warning".'),
    }),
    execute: async ({ scope = 'workspace', filePath, severity = 'Warning' }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
        if (scope === 'file' && !filePath) {
            return { success: false, error: 'filePath is required when scope is "file".' };
        }

        if (data && toolCallId) {
            const target = scope === 'file' ? `file: ${filePath}` : 'workspace';
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getDiagnosticsTool', status: 'processing', message: `Getting diagnostics for ${target} (min severity: ${severity})...` });
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder is open.');
            }
            const workspaceRoot = workspaceFolders[0].uri;

            let diagnostics: [vscode.Uri, readonly vscode.Diagnostic[]][];
            let targetUri: vscode.Uri | undefined;

            if (scope === 'file' && filePath) {
                const absolutePath = path.resolve(workspaceRoot.fsPath, filePath);
                 if (!absolutePath.startsWith(workspaceRoot.fsPath)) {
                    throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
                }
                targetUri = vscode.Uri.joinPath(workspaceRoot, filePath);
                // Check if file exists? getDiagnostics might handle it gracefully.
                diagnostics = [[targetUri, vscode.languages.getDiagnostics(targetUri)]];
            } else {
                // Get diagnostics for the entire workspace
                diagnostics = vscode.languages.getDiagnostics();
            }

            const minSeverityLevel = severityMap[severity];
            const filteredDiagnostics: z.infer<typeof diagnosticItemSchema>[] = [];

            for (const [uri, diagnosticArray] of diagnostics) {
                const relativePath = vscode.workspace.asRelativePath(uri, false);
                for (const d of diagnosticArray) {
                    if (d.severity <= minSeverityLevel) { // Lower value means higher severity in vscode.DiagnosticSeverity enum
                        filteredDiagnostics.push({
                            filePath: relativePath,
                            message: d.message,
                            severity: severityEnum.options[d.severity], // Map back to string enum
                            source: typeof d.source === 'string' ? d.source : undefined,
                            range: {
                                startLine: d.range.start.line,
                                startChar: d.range.start.character,
                                endLine: d.range.end.line,
                                endChar: d.range.end.character,
                            },
                            code: typeof d.code === 'string' || typeof d.code === 'number' ? d.code : undefined,
                        });
                    }
                }
            }

            // Validate the output
            const validationResult = z.array(diagnosticItemSchema).safeParse(filteredDiagnostics);
             if (!validationResult.success) {
                console.error("getDiagnosticsTool validation error:", validationResult.error);
                throw new Error("Internal error: Failed to format diagnostics results.");
            }


            const message = `Found ${validationResult.data.length} diagnostic(s) matching criteria.`;
            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getDiagnosticsTool', status: 'complete', message: message });
            }
            return { success: true, diagnostics: validationResult.data };

        } catch (error: any) {
            let errorMessage = `Failed to get diagnostics.`;
            if (error instanceof Error) {
                errorMessage += ` Reason: ${error.message}`;
            } else {
                errorMessage += ` Unknown error: ${String(error)}`;
            }
            console.error(`getDiagnosticsTool Error: ${error}`);
             if (data && toolCallId) {
                 data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getDiagnosticsTool', status: 'error', message: errorMessage });
             }
            return { success: false, error: errorMessage };
        }
    },
});