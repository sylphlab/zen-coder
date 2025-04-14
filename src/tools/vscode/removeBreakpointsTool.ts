import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';
import path from 'path'; // Import path for resolving relative paths

export const removeBreakpointsTool = tool({
    description: 'Removes one or more breakpoints based on their location (file path and line number).',
    parameters: z.object({
        breakpoints: z.array(z.object({
            filePath: z.string().describe('The workspace-relative path to the file containing the breakpoint (e.g., "src/main.ts").'),
            lineNumber: z.number().int().positive().describe('The 1-based line number of the breakpoint to remove.'),
        })).min(1).describe('An array of breakpoint locations to remove.')
    }),
    execute: async ({ breakpoints }) => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open. Cannot resolve file paths.');
            }
            const workspaceRoot = workspaceFolders[0].uri;

            const existingBreakpoints = vscode.debug.breakpoints;
            const breakpointsToRemove: vscode.Breakpoint[] = [];
            const results: { filePath: string; lineNumber: number; success: boolean; message: string }[] = [];

            for (const bpToRemove of breakpoints) {
                let found = false;
                try {
                    const absolutePath = vscode.Uri.joinPath(workspaceRoot, bpToRemove.filePath);
                    const targetLine = bpToRemove.lineNumber - 1; // Convert to 0-based

                    for (const existingBp of existingBreakpoints) {
                        if (existingBp instanceof vscode.SourceBreakpoint &&
                            existingBp.location.uri.toString() === absolutePath.toString() &&
                            existingBp.location.range.start.line === targetLine) {
                            breakpointsToRemove.push(existingBp);
                            results.push({ filePath: bpToRemove.filePath, lineNumber: bpToRemove.lineNumber, success: true, message: 'Found and marked for removal.' });
                            found = true;
                            break; // Move to the next breakpoint to remove
                        }
                        // Note: We are not handling FunctionBreakpoints or DataBreakpoints here.
                    }
                    if (!found) {
                         results.push({ filePath: bpToRemove.filePath, lineNumber: bpToRemove.lineNumber, success: false, message: 'Breakpoint not found at this location.' });
                    }
                } catch (error: any) {
                     results.push({ filePath: bpToRemove.filePath, lineNumber: bpToRemove.lineNumber, success: false, message: `Error processing breakpoint: ${error.message}` });
                }
            }

            if (breakpointsToRemove.length > 0) {
                vscode.debug.removeBreakpoints(breakpointsToRemove);
                const successfulRemovals = results.filter(r => r.success).length;
                const failedRemovals = results.length - successfulRemovals; // This counts not found as failed
                let summaryMessage = `Attempted to remove ${results.length} breakpoint(s). ${successfulRemovals} found and removed.`;
                 if (failedRemovals > 0) {
                     summaryMessage += ` ${failedRemovals} could not be found or processed.`;
                 }
                return { success: true, message: summaryMessage, results };
            } else {
                return { success: false, message: 'No matching breakpoints found to remove.', results };
            }

        } catch (error: any) {
            console.error('Error executing removeBreakpointsTool:', error);
            return { success: false, message: `Failed to remove breakpoints: ${error.message}` };
        }
    },
});