import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import path from 'path';

// Helper function to map vscode.SymbolKind enum to string
function mapSymbolKind(kind: vscode.SymbolKind): string {
    // This mapping can be extended based on needs
    switch (kind) {
        case vscode.SymbolKind.File: return 'File';
        case vscode.SymbolKind.Module: return 'Module';
        case vscode.SymbolKind.Namespace: return 'Namespace';
        case vscode.SymbolKind.Package: return 'Package';
        case vscode.SymbolKind.Class: return 'Class';
        case vscode.SymbolKind.Method: return 'Method';
        case vscode.SymbolKind.Property: return 'Property';
        case vscode.SymbolKind.Field: return 'Field';
        case vscode.SymbolKind.Constructor: return 'Constructor';
        case vscode.SymbolKind.Enum: return 'Enum';
        case vscode.SymbolKind.Interface: return 'Interface';
        case vscode.SymbolKind.Function: return 'Function';
        case vscode.SymbolKind.Variable: return 'Variable';
        case vscode.SymbolKind.Constant: return 'Constant';
        case vscode.SymbolKind.String: return 'String';
        case vscode.SymbolKind.Number: return 'Number';
        case vscode.SymbolKind.Boolean: return 'Boolean';
        case vscode.SymbolKind.Array: return 'Array';
        case vscode.SymbolKind.Object: return 'Object';
        case vscode.SymbolKind.Key: return 'Key';
        case vscode.SymbolKind.Null: return 'Null';
        case vscode.SymbolKind.EnumMember: return 'EnumMember';
        case vscode.SymbolKind.Struct: return 'Struct';
        case vscode.SymbolKind.Event: return 'Event';
        case vscode.SymbolKind.Operator: return 'Operator';
        case vscode.SymbolKind.TypeParameter: return 'TypeParameter';
        default: return 'Unknown';
    }
}

// Define the structure for a symbol location range
const symbolRangeSchema = z.object({
    startLine: z.number().int().describe('Start line number (0-based).'),
    startChar: z.number().int().describe('Start character position (0-based).'),
    endLine: z.number().int().describe('End line number (0-based).'),
    endChar: z.number().int().describe('End character position (0-based).'),
});

// Define the structure for a single symbol item in the output
const workspaceSymbolItemSchema = z.object({
    name: z.string().describe('The name of the symbol.'),
    kind: z.string().describe('The kind of symbol (e.g., "Class", "Function", "Variable").'),
    filePath: z.string().describe('Relative path to the file containing the symbol.'),
    range: symbolRangeSchema.describe('The range within the file where the symbol is defined.'),
    containerName: z.string().optional().describe('The name of the container symbol, if any (e.g., the class name for a method).'),
});

export const findWorkspaceSymbolsTool = tool({
    description: 'Searches the entire workspace for symbols (classes, functions, variables, etc.) matching a query string.',
    parameters: z.object({
        query: z.string().min(1).describe('The search string for symbols.'),
        // Optional: maxResults?
    }),
    execute: async ({ query }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'findWorkspaceSymbolsTool', status: 'processing', message: `Searching workspace symbols for "${query}"...` });
        }

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                // While the command might work without a folder, results would be limited/unpredictable.
                throw new Error('No workspace folder is open. Cannot reliably search workspace symbols.');
            }

            // Execute the command
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                query
            );

            if (!symbols || symbols.length === 0) {
                const message = `No workspace symbols found matching "${query}".`;
                if (data && toolCallId) {
                    data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'findWorkspaceSymbolsTool', status: 'complete', message: message });
                }
                return { success: true, symbols: [], message: message };
            }

            // Map SymbolInformation to the desired output format
            const resultSymbols = symbols.map(symbol => ({
                name: symbol.name,
                kind: mapSymbolKind(symbol.kind),
                filePath: vscode.workspace.asRelativePath(symbol.location.uri, false),
                range: {
                    startLine: symbol.location.range.start.line,
                    startChar: symbol.location.range.start.character,
                    endLine: symbol.location.range.end.line,
                    endChar: symbol.location.range.end.character,
                },
                containerName: symbol.containerName || undefined,
            }));

            // Validate the output
            const validationResult = z.array(workspaceSymbolItemSchema).safeParse(resultSymbols);
             if (!validationResult.success) {
                console.error("findWorkspaceSymbolsTool validation error:", validationResult.error);
                throw new Error("Internal error: Failed to format workspace symbol results.");
            }

            const message = `Found ${validationResult.data.length} workspace symbol(s) matching "${query}".`;
            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'findWorkspaceSymbolsTool', status: 'complete', message: message });
            }
            return { success: true, symbols: validationResult.data };

        } catch (error: any) {
            let errorMessage = `Failed to find workspace symbols.`;
            if (error instanceof Error) {
                errorMessage += ` Reason: ${error.message}`;
            } else {
                errorMessage += ` Unknown error: ${String(error)}`;
            }
            console.error(`findWorkspaceSymbolsTool Error: ${error}`);
             if (data && toolCallId) {
                 data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'findWorkspaceSymbolsTool', status: 'error', message: errorMessage });
             }
            return { success: false, error: errorMessage };
        }
    },
});