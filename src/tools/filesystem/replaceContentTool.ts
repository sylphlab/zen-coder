import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';
import { TextEncoder, TextDecoder } from 'util';
// Assume vscode.workspace.findFiles handles basic globs

// Define reusable schema for line range selection using start/end with negative indexing support
const lineRangeSchema = z.object({
  start_line: z.number().int().optional()
    .describe('Line number to start from (1-based). Negative values count from the end (e.g., -1 is the last line). Default is 1.'),
  end_line: z.number().int().optional()
    .describe('Line number to end at (inclusive, 1-based). Negative values count from the end (e.g., -1 is the last line). Default is the last line.'),
}).refine(data => {
    // Basic structural validation
    if (data.start_line && data.start_line > 0 && data.end_line && data.end_line < 0) return false;
    if (data.start_line && data.start_line < 0 && data.end_line && data.end_line > 0) return false;
    if (data.start_line && data.start_line < 0 && data.end_line && data.end_line < 0 && data.start_line > data.end_line) return false;
    return true;
}, {
    message: "Invalid combination of start_line and end_line values (e.g., positive start with negative end, or negative start > negative end)."
}).optional().describe('Specify a range of lines. Positive numbers are 1-based from start. Negative numbers are 1-based from end (-1 is last line). Examples: {start_line: 1, end_line: 100}, {start_line: -50} (last 50 lines), {start_line: -100, end_line: -10} (last 100 to last 10 lines). If omitted, processes the entire file.');

// Schema for a single search/replace operation
const replaceOperationSchema = z.object({
  search: z.string().describe('Text or regex pattern to search for.'),
  replace: z.string().describe('Text to replace matches with.'),
  isRegex: z.boolean().optional().default(false).describe('Treat search as regex. Defaults to false.'),
  matchCase: z.boolean().optional().default(false).describe('Perform case-sensitive search. Defaults to false.'),
});

// Schema for the result of replacements in a single file
const fileReplaceResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  replacementsMade: z.number().int().optional().describe('Total number of replacements made in this file across all operations.'),
  error: z.string().optional().describe('Error encountered while processing this file.'),
});

export const replaceContentTool = tool({
  description: 'Search and replace text or regex patterns within files in the workspace. Supports glob patterns for paths and multiple replacement operations per run.',
  parameters: z.object({
    paths: z.array(z.string()).min(1).describe("An array of relative paths or glob patterns specifying the files to modify within the workspace (e.g., ['src/**/*.ts', 'docs/file.md'])."),
    operations: z.array(replaceOperationSchema).min(1).describe('An array of search/replace operations to apply sequentially to each matched file.'),
    // Consider adding encoding parameter if needed, default to utf8
    lineRange: lineRangeSchema,
  }),
  execute: async ({ paths, operations, lineRange = {} }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => { // Default lineRange to {}
    const results: z.infer<typeof fileReplaceResultSchema>[] = [];
    const decoder = new TextDecoder(); // Default UTF-8
    const encoder = new TextEncoder(); // Default UTF-8

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceContentTool', status: 'processing', message: `Starting content replacement in ${paths.join(', ')}...` });
    }

    // 1. Find matching files
    const foundFilesUris: Set<string> = new Set();
    let filesProcessedCount = 0;

    for (const pattern of paths) {
        try {
            const uris = await vscode.workspace.findFiles(pattern, undefined, undefined);
            uris.forEach(uri => foundFilesUris.add(uri.toString()));
        } catch (globError: any) {
             console.error(`replaceContentTool: Error finding files for pattern "${pattern}": ${globError}`);
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceContentTool', status: 'warning', message: `Error processing glob pattern "${pattern}": ${globError.message}` });
            }
        }
    }
    const uniqueFileUris = Array.from(foundFilesUris).map(uriStr => Uri.parse(uriStr));

     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceContentTool', status: 'processing', message: `Found ${uniqueFileUris.length} unique files matching patterns. Starting replacements...` });
    }

    // 2. Process each found file
    for (const fileUri of uniqueFileUris) {
      const relativePath = path.relative(workspaceUri.fsPath, fileUri.fsPath).replace(/\\/g, '/');
      const fileResult: z.infer<typeof fileReplaceResultSchema> = { path: relativePath, success: false };
      let totalReplacementsInFile = 0;
      let fileModified = false;
      filesProcessedCount++;

       if (data && toolCallId && filesProcessedCount % 10 === 0) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceContentTool', status: 'processing', message: `Processed ${filesProcessedCount}/${uniqueFileUris.length} files...` });
        }

      try {
        const uint8Array = await vscode.workspace.fs.readFile(fileUri);
        const originalContentString = decoder.decode(uint8Array);
        const allLines = originalContentString.split(/\r?\n/);
        const totalLines = allLines.length;
        let targetLines: string[] = [];
        let rangeStartLineNumber = 1; // 1-based start line number of the targetLines within allLines
        let linesBefore: string[] = [];
        let linesAfter: string[] = [];

        // Determine the target lines based on the resolved lineRange
        let startIndex = 0;
        let endIndex = totalLines;
        try {
            const resolvedIndices = resolveLineRangeIndices(lineRange, totalLines);
            startIndex = resolvedIndices.startIndex;
            endIndex = resolvedIndices.endIndex; // Exclusive end index for slice
            targetLines = allLines.slice(startIndex, endIndex);
            linesBefore = allLines.slice(0, startIndex);
            linesAfter = allLines.slice(endIndex);
        } catch (rangeError: any) {
             // Report error for this file and skip to the next
             fileResult.success = false;
             fileResult.error = `Invalid line range for file with ${totalLines} lines: ${rangeError.message}`;
             results.push(fileResult);
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceContentTool', status: 'warning', message: `Skipping ${relativePath}: ${fileResult.error}` });
             }
             continue;
        }

        if (targetLines.length === 0) {
            // If the range results in no lines, nothing to replace
            fileResult.success = true;
            fileResult.replacementsMade = 0;
            results.push(fileResult);
            continue; // Move to the next file
        }

        let currentTargetContent = targetLines.join('\n'); // Work on the content within the target range

        // Apply each operation sequentially
        for (const op of operations) {
          let regex: RegExp;
          if (op.isRegex) {
            try {
              const flags = op.matchCase ? 'g' : 'gi'; // Global flag is crucial for replace all
              regex = new RegExp(op.search, flags);
            } catch (e) {
              throw new Error(`Invalid regular expression in operation: ${op.search}`);
            }
          } else {
            // Escape special regex characters for plain text search
            const escapedQuery = op.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flags = op.matchCase ? 'g' : 'gi';
            regex = new RegExp(escapedQuery, flags);
          }

          let replacementsInOp = 0;
          // Perform replacement only on the target content string
          const newTargetContent = currentTargetContent.replace(regex, (...args) => {
              replacementsInOp++;
              return op.replace;
          });


          if (newTargetContent !== currentTargetContent) {
              totalReplacementsInFile += replacementsInOp;
              currentTargetContent = newTargetContent; // Update the target content for the next operation in this file
              fileModified = true; // Mark that a change occurred within the target range
          }
        } // End loop through operations

        // Write back if modified
        if (fileModified) {
           if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceContentTool', status: 'processing', message: `Writing ${totalReplacementsInFile} replacement(s) to ${relativePath}` });
            }
          // Reconstruct the full content only if modifications were made
          const finalContentString = [...linesBefore, ...currentTargetContent.split('\n'), ...linesAfter].join('\n');
          await vscode.workspace.fs.writeFile(fileUri, encoder.encode(finalContentString));
        }

        fileResult.success = true;
        fileResult.replacementsMade = totalReplacementsInFile;

      } catch (error: any) {
        console.error(`replaceContentTool Error processing file ${relativePath}: ${error}`);
        fileResult.success = false;
        fileResult.error = error instanceof Error ? error.message : String(error);
         if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceContentTool', status: 'warning', message: `Error processing file ${relativePath}: ${fileResult.error}` });
        }
      }
      results.push(fileResult);
    } // End loop through files

    // Send final status
    const filesModified = results.filter(r => r.success && r.replacementsMade && r.replacementsMade > 0).length;
    const filesWithErrors = results.filter(r => !r.success).length;
    const finalMessage = `Replacement complete. Processed ${uniqueFileUris.length} files. Made replacements in ${filesModified} files. Encountered errors in ${filesWithErrors} files.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceContentTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(fileReplaceResultSchema).safeParse(results);
     if (!validationResult.success) {
        console.error("replaceContentTool validation error:", validationResult.error);
        return { success: false, error: "Internal error: Failed to format replacement results.", results: [] };
    }

    // Overall success means no file processing resulted in an error
    const overallSuccess = !results.some(r => !r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});

// Helper function to resolve line range (potentially with negative indices) - Copied from readFilesTool
function resolveLineRangeIndices(lineRange: { start_line?: number; end_line?: number } | undefined, totalLines: number): { startIndex: number; endIndex: number } {
    let start = lineRange?.start_line ?? 1; // Default start is 1
    let end = lineRange?.end_line ?? totalLines; // Default end is totalLines

    // Resolve negative indices relative to totalLines (1-based)
    const resolveIndex = (index: number): number => {
        return index <= 0 ? totalLines + index + 1 : index;
    };

    let resolvedStart = resolveIndex(start);
    let resolvedEnd = resolveIndex(end);

    // Convert 1-based line numbers to 0-based indices, clamping to valid array bounds
    const startIndex = Math.max(0, Math.min(resolvedStart - 1, totalLines));
    // For slice, the end index is exclusive, so we use the resolved 'end' line number directly after clamping.
    // However, we need to ensure it's at least startIndex.
    const endIndex = Math.max(startIndex, Math.min(resolvedEnd, totalLines));

    // Final validation: ensure start index is not greater than end index AFTER resolution
    if (startIndex > endIndex) {
        console.warn(`Calculated start index (${startIndex}) is greater than end index (${endIndex}). Returning empty range.`);
        return { startIndex: endIndex, endIndex: endIndex }; // Return empty range
    }

    return { startIndex, endIndex };
}