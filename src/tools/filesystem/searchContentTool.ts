import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';
import { TextDecoder } from 'util';
// We might need a glob library. Let's assume vscode.workspace.findFiles can handle basic globs for now.
// If more complex globbing is needed, we might need to add 'glob' dependency.

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

// Schema for a single search match
const searchMatchSchema = z.object({
  line: z.number().int().positive().describe('1-based line number of the match.'),
  matchContent: z.string().describe('The content of the line containing the match.'),
  before: z.array(z.string()).describe('Lines immediately preceding the match line (context).'),
  after: z.array(z.string()).describe('Lines immediately following the match line (context).'),
  // Could add match position within the line later if needed
});

// Schema for the search results for a single file
const fileSearchResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  matches: z.array(searchMatchSchema).optional().describe('List of matches found in this file.'),
  error: z.string().optional().describe('Error encountered while processing this file.'),
});

export const searchContentTool = tool({
  description: 'Search for text or regex patterns within files in the workspace. Supports glob patterns for paths and provides context lines around matches.',
  parameters: z.object({
    paths: z.array(z.string()).min(1).describe("An array of relative paths or glob patterns specifying the files to search within the workspace (e.g., ['src/**/*.ts', 'docs/file.md'])."),
    query: z.string().describe('The text or regular expression pattern to search for.'),
    isRegex: z.boolean().optional().default(false).describe('Whether the query is a regular expression. Defaults to false.'),
    matchCase: z.boolean().optional().default(false).describe('Whether the search should be case-sensitive. Defaults to false.'),
    contextLinesBefore: z.number().int().min(0).optional().default(0).describe('Number of lines to include before each match line. Defaults to 0.'),
    contextLinesAfter: z.number().int().min(0).optional().default(0).describe('Number of lines to include after each match line. Defaults to 0.'),
    maxResultsPerFile: z.number().int().positive().optional().describe('Maximum number of matches to return per file. If omitted, returns all matches.'),
    lineRange: lineRangeSchema, // Add line range parameter
  }),
  execute: async ({
    paths,
    query,
    isRegex = false,
    matchCase = false,
    contextLinesBefore = 0,
    contextLinesAfter = 0,
    maxResultsPerFile,
    lineRange = {} // Default lineRange to {}
  }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {

    const results: z.infer<typeof fileSearchResultSchema>[] = [];
    const decoder = new TextDecoder(); // Default UTF-8

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'searchContentTool', status: 'processing', message: `Starting search for "${query}" in ${paths.join(', ')}...` });
    }

    // 1. Find matching files using glob patterns
    // Use vscode.workspace.findFiles which supports glob patterns relative to workspace root
    // Combine patterns into a single include pattern string if possible, or iterate
    // For simplicity, let's iterate for now. findFiles might be slow for many patterns.
    const foundFilesUris: Set<string> = new Set(); // Use Set to avoid duplicates if globs overlap
    let filesSearchedCount = 0;

    for (const pattern of paths) {
        try {
            // Note: findFiles excludes files from .gitignore and workspace exclude settings by default.
            const uris = await vscode.workspace.findFiles(pattern, undefined, undefined /* maxResults can be added here */);
            uris.forEach(uri => foundFilesUris.add(uri.toString()));
        } catch (globError: any) {
             console.error(`searchContentTool: Error finding files for pattern "${pattern}": ${globError}`);
             // How to report glob errors? Maybe add to a separate errors array in the final result?
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'searchContentTool', status: 'warning', message: `Error processing glob pattern "${pattern}": ${globError.message}` });
            }
        }
    }

    const uniqueFileUris = Array.from(foundFilesUris).map(uriStr => Uri.parse(uriStr));

     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'searchContentTool', status: 'processing', message: `Found ${uniqueFileUris.length} unique files matching patterns. Starting content search...` });
    }


    // 2. Process each found file
    for (const fileUri of uniqueFileUris) {
      const relativePath = path.relative(workspaceUri.fsPath, fileUri.fsPath).replace(/\\/g, '/');
      const fileResult: z.infer<typeof fileSearchResultSchema> = { path: relativePath, success: false };
      const matchesInFile: z.infer<typeof searchMatchSchema>[] = [];
      filesSearchedCount++;

       if (data && toolCallId && filesSearchedCount % 10 === 0) { // Update status periodically
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'searchContentTool', status: 'processing', message: `Searched ${filesSearchedCount}/${uniqueFileUris.length} files...` });
        }

      try {
        const uint8Array = await vscode.workspace.fs.readFile(fileUri);
        const fileContentString = decoder.decode(uint8Array);
        const allLines = fileContentString.split(/\r?\n/);
        const totalLines = allLines.length;
        let targetLines: string[] = [];
        let rangeStartLineNumber = 1; // 1-based start line number of the targetLines within allLines

        // Determine the target lines based on the resolved lineRange
        let startIndex = 0;
        let endIndex = totalLines;
        try {
            const resolvedIndices = resolveLineRangeIndices(lineRange, totalLines);
            startIndex = resolvedIndices.startIndex;
            endIndex = resolvedIndices.endIndex; // Exclusive end index for slice
            rangeStartLineNumber = startIndex + 1; // 1-based start line number of the target range
            targetLines = allLines.slice(startIndex, endIndex);
        } catch (rangeError: any) {
             // Report error for this file and skip to the next
             fileResult.success = false;
             fileResult.error = `Invalid line range for file with ${totalLines} lines: ${rangeError.message}`;
             results.push(fileResult);
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'searchContentTool', status: 'warning', message: `Skipping ${relativePath}: ${fileResult.error}` });
             }
             continue;
        }

        if (targetLines.length === 0) {
            // If the range results in no lines, skip searching this file
            fileResult.success = true;
            results.push(fileResult); // Add result indicating success but no matches
            continue; // Move to the next file
        }

        let regex: RegExp;
        if (isRegex) {
            try {
                const flags = matchCase ? 'g' : 'gi'; // Global flag is important for finding all matches
                regex = new RegExp(query, flags);
            } catch (e) {
                throw new Error(`Invalid regular expression provided: ${query}`);
            }
        } else {
            // Escape special regex characters for plain text search
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const flags = matchCase ? 'g' : 'gi';
            regex = new RegExp(escapedQuery, flags);
        }

        // Search within the targetLines
        for (let i = 0; i < targetLines.length; i++) {
          const lineContent = targetLines[i];
          const originalLineNumber = rangeStartLineNumber + i; // Calculate original line number

          // Reset lastIndex for global regex search on each line
          regex.lastIndex = 0;
          if (regex.test(lineContent)) { // Check if there's any match on the line
            // Get context from the original allLines array using original line number
            const originalIndex = originalLineNumber - 1;
            const beforeContext = allLines.slice(Math.max(0, originalIndex - contextLinesBefore), originalIndex);
            const afterContext = allLines.slice(originalIndex + 1, Math.min(totalLines, originalIndex + 1 + contextLinesAfter));

            matchesInFile.push({
              line: originalLineNumber, // Use original 1-based line number
              matchContent: lineContent,
              before: beforeContext,
              after: afterContext,
            });

            if (maxResultsPerFile && matchesInFile.length >= maxResultsPerFile) {
              break; // Stop searching this file if max results reached
            }
          }
        }

        fileResult.success = true;
        if (matchesInFile.length > 0) {
          fileResult.matches = matchesInFile;
        }

      } catch (error: any) {
        console.error(`searchContentTool Error processing file ${relativePath}: ${error}`);
        fileResult.success = false;
        fileResult.error = error instanceof Error ? error.message : String(error);
         if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'searchContentTool', status: 'warning', message: `Error searching file ${relativePath}: ${fileResult.error}` });
        }
      }
      // Only add result if it was successful and had matches, or if it failed
      if (!fileResult.success || (fileResult.success && fileResult.matches && fileResult.matches.length > 0)) {
         results.push(fileResult);
      }
    } // End loop through files

    // Send final status
    const filesWithMatches = results.filter(r => r.success && r.matches && r.matches.length > 0).length;
    const filesWithErrors = results.filter(r => !r.success).length;
    const finalMessage = `Search complete. Searched ${uniqueFileUris.length} files. Found matches in ${filesWithMatches} files. Encountered errors in ${filesWithErrors} files.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'searchContentTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(fileSearchResultSchema).safeParse(results);
     if (!validationResult.success) {
        console.error("searchContentTool validation error:", validationResult.error);
        return { success: false, error: "Internal error: Failed to format search results.", results: [] };
    }

    // Overall success could mean no errors occurred, even if no matches were found.
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