import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';
import path from 'path'; // Import path for resolving relative paths

export const addBreakpointsTool = tool({
    description: 'Adds one or more breakpoints at specified locations (file path and line number).',
    parameters: z.object({
        breakpoints: z.array(z.object({
            filePath: z.string().describe('The workspace-relative path to the file (e.g., "src/main.ts").'),
            lineNumber: z.number().int().positive().describe('The 1-based line number to set the breakpoint on.'),
            // Optional: condition, hitCondition, logMessage for more advanced breakpoints
            condition: z.string().optional().describe('An optional expression to evaluate. The breakpoint will only stop if the expression evaluates to true.'),
            hitCondition: z.string().optional().describe('An optional expression that controls how many times the breakpoint is hit before stopping execution (e.g., "> 5").'),
            logMessage: z.string().optional().describe('An optional message to log to the console when the breakpoint is hit. If set, the debugger does not stop. Supports expressions in curly braces, e.g., "Value is {variable}".'),
        })).min(1).describe('An array of breakpoint locations to add.')
    }),
    execute: async ({ breakpoints }) => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open. Cannot resolve file paths.');
            }
            const workspaceRoot = workspaceFolders[0].uri;

            const vscodeBreakpoints: vscode.Breakpoint[] = [];
            const results: { filePath: string; lineNumber: number; success: boolean; message: string }[] = [];

            for (const bp of breakpoints) {
                try {
                    const absolutePath = vscode.Uri.joinPath(workspaceRoot, bp.filePath);
                    // Basic validation: Check if file exists (optional, addBreakpoints might handle it)
                    // try {
                    //     await vscode.workspace.fs.stat(absolutePath);
                    // } catch (statError) {
                    //     throw new Error(`File not found: ${bp.filePath}`);
                    // }

                    const location = new vscode.Location(absolutePath, new vscode.Position(bp.lineNumber - 1, 0)); // Line number is 0-based in Position
                    const sourceBreakpoint = new vscode.SourceBreakpoint(location, true, bp.condition, bp.hitCondition, bp.logMessage);
                    vscodeBreakpoints.push(sourceBreakpoint);
                    results.push({ filePath: bp.filePath, lineNumber: bp.lineNumber, success: true, message: 'Prepared' });
                } catch (error: any) {
                     results.push({ filePath: bp.filePath, lineNumber: bp.lineNumber, success: false, message: `Error preparing breakpoint: ${error.message}` });
                }
            }

            if (vscodeBreakpoints.length > 0) {
                vscode.debug.addBreakpoints(vscodeBreakpoints);
                const successfulAdds = results.filter(r => r.success).length;
                 const failedAdds = results.length - successfulAdds;
                 let summaryMessage = `Attempted to add ${results.length} breakpoint(s). ${successfulAdds} added successfully.`;
                 if (failedAdds > 0) {
                     summaryMessage += ` ${failedAdds} failed.`;
                 }
                 // Note: addBreakpoints doesn't return success/failure per breakpoint easily.
                 // We assume success if the call doesn't throw and report based on preparation results.
                 return { success: true, message: summaryMessage, results };
            } else {
                 return { success: false, message: 'No valid breakpoints could be prepared.', results };
            }

        } catch (error: any) {
            console.error('Error executing addBreakpointsTool:', error);
            return { success: false, message: `Failed to add breakpoints: ${error.message}` };
        }
    },
});