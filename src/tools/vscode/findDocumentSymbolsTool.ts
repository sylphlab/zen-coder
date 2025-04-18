import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import path from 'path';

// Helper function to map vscode.SymbolKind enum to string (reuse or define locally)
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
// Using a structure similar to SymbolInformation for simplicity
const documentSymbolItemSchema = z.object({
    name: z.string().describe('The name of the symbol.'),
    kind: z.string().describe('The kind of symbol (e.g., "Class", "Function", "Variable").'),
    filePath: z.string().describe('Relative path to the file containing the symbol.'), // Keep filePath for consistency
    range: symbolRangeSchema.describe('The range within the file where the symbol is defined (usually just the name).'),
    selectionRange: symbolRangeSchema.describe('A more encompassing range for the symbol (e.g., the entire function block).'),
    containerName: z.string().optional().describe('The name of the container symbol, if any (derived from hierarchy).'),
});

// Recursive function to flatten DocumentSymbol hierarchy
function flattenDocumentSymbols(
    symbols: vscode.DocumentSymbol[],
    filePath: string,
    containerName?: string
): z.infer<typeof documentSymbolItemSchema>[] {
    let results: z.infer<typeof documentSymbolItemSchema>[] = [];
    for (const symbol of symbols) {
        results.push({
            name: symbol.name,
            kind: mapSymbolKind(symbol.kind),
            filePath: filePath,
            range: { // range usually covers the name identifier
                startLine: symbol.range.start.line,
                startChar: symbol.range.start.character,
                endLine: symbol.range.end.line,
                endChar: symbol.range.end.character,
            },
            selectionRange: { // selectionRange covers the whole block
                startLine: symbol.selectionRange.start.line,
                startChar: symbol.selectionRange.start.character,
                endLine: symbol.selectionRange.end.line,
                endChar: symbol.selectionRange.end.character,
            },
            containerName: containerName,
        });
        if (symbol.children && symbol.children.length > 0) {
            results = results.concat(flattenDocumentSymbols(symbol.children, filePath, symbol.name));
        }
    }
    return results;
}


export const findDocumentSymbolsTool = tool({
    description: 'Gets a list of symbols (outline) defined within a specific file.',
    parameters: z.object({
        filePath: z.string().describe('Workspace-relative path to the file.'),
    }),
    execute: async ({ filePath }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'findDocumentSymbolsTool', status: 'processing', message: `Getting symbols for ${filePath}...` });
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

             // Check if file exists before trying to get symbols
            try {
                await vscode.workspace.fs.stat(targetUri);
            } catch (error: any) {
                 if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                    throw new Error(`File not found at path '${filePath}'. Cannot get symbols.`);
                }
                throw error; // Re-throw other stat errors
            }


            // Execute the command
            // Returns SymbolInformation[] | DocumentSymbol[] | undefined
            const symbolsResult = await vscode.commands.executeCommand<vscode.SymbolInformation[] | vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                targetUri
            );

            if (!symbolsResult || symbolsResult.length === 0) {
                const message = `No symbols found in ${filePath}.`;
                if (data && toolCallId) {
                    data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'findDocumentSymbolsTool', status: 'complete', message: message });
                }
                return { success: true, symbols: [], message: message };
            }

            let resultSymbols: z.infer<typeof documentSymbolItemSchema>[] = [];

            // Check the type of the first element to determine the result format
            if (symbolsResult[0] instanceof vscode.DocumentSymbol) {
                // It's DocumentSymbol[], flatten the hierarchy
                resultSymbols = flattenDocumentSymbols(symbolsResult as vscode.DocumentSymbol[], filePath);
            } else if (symbolsResult[0] instanceof vscode.SymbolInformation) {
                 // It's SymbolInformation[], map it directly
                 resultSymbols = (symbolsResult as vscode.SymbolInformation[]).map(symbol => ({
                    name: symbol.name,
                    kind: mapSymbolKind(symbol.kind),
                    filePath: filePath, // Add filePath
                    range: { // SymbolInformation only has Location.range
                        startLine: symbol.location.range.start.line,
                        startChar: symbol.location.range.start.character,
                        endLine: symbol.location.range.end.line,
                        endChar: symbol.location.range.end.character,
                    },
                    // Use range also for selectionRange as SymbolInformation doesn't have separate selectionRange
                    selectionRange: {
                        startLine: symbol.location.range.start.line,
                        startChar: symbol.location.range.start.character,
                        endLine: symbol.location.range.end.line,
                        endChar: symbol.location.range.end.character,
                    },
                    containerName: symbol.containerName || undefined,
                }));
            } else {
                 throw new Error("Unknown result format from executeDocumentSymbolProvider.");
            }


            // Validate the output
            const validationResult = z.array(documentSymbolItemSchema).safeParse(resultSymbols);
             if (!validationResult.success) {
                console.error("findDocumentSymbolsTool validation error:", validationResult.error);
                throw new Error("Internal error: Failed to format document symbol results.");
            }

            const message = `Found ${validationResult.data.length} symbol(s) in ${filePath}.`;
            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'findDocumentSymbolsTool', status: 'complete', message: message });
            }
            return { success: true, symbols: validationResult.data };

        } catch (error: any) {
            let errorMessage = `Failed to get document symbols for ${filePath}.`;
            if (error.message.includes('not found')) {
                 errorMessage = error.message; // Use specific error
            } else if (error instanceof Error) {
                errorMessage += ` Reason: ${error.message}`;
            } else {
                errorMessage += ` Unknown error: ${String(error)}`;
            }
            console.error(`findDocumentSymbolsTool Error: ${error}`);
             if (data && toolCallId) {
                 data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'findDocumentSymbolsTool', status: 'error', message: errorMessage });
             }
            return { success: false, error: errorMessage };
        }
    },
});