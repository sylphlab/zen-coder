import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

// Define the structure for file/directory stats (reused from statItems)
const fileStatSchema = z.object({
  name: z.string().describe('The name of the file or directory.'),
  path: z.string().describe('The relative path provided.'),
  type: z.enum(['file', 'directory', 'symbolic_link', 'unknown']),
  size: z.number().optional().describe('Size in bytes (only for files)'),
  mtime: z.number().optional().describe('Modification time (Unix timestamp ms)'),
});

// Define the structure for a single line of content
const lineContentSchema = z.object({
    line: z.number().int().positive().describe('1-based line number'),
    content: z.string().describe('The content of the line'),
});

// Define reusable schema for line range selection using start/end with negative indexing support
const lineRangeSchema = z.object({
  start_line: z.number().int().optional()
    .describe('Line number to start from (1-based). Negative values count from the end (e.g., -1 is the last line). Default is 1.'),
  end_line: z.number().int().optional()
    .describe('Line number to end at (inclusive, 1-based). Negative values count from the end (e.g., -1 is the last line). Default is the last line.'),
}).refine(data => {
    // Basic structural validation: Cannot mix positive start and negative end, or vice versa directly.
    // Cannot have negative start > negative end (e.g. -10 to -50).
    // More robust validation (e.g., resolved start > resolved end) happens in execute.
    if (data.start_line && data.start_line > 0 && data.end_line && data.end_line < 0) return false;
    if (data.start_line && data.start_line < 0 && data.end_line && data.end_line > 0) return false;
    if (data.start_line && data.start_line < 0 && data.end_line && data.end_line < 0 && data.start_line > data.end_line) return false;
    return true;
}, {
    message: "Invalid combination of start_line and end_line values (e.g., positive start with negative end, or negative start > negative end)."
}).optional().describe('Specify a range of lines. Positive numbers are 1-based from start. Negative numbers are 1-based from end (-1 is last line). Examples: {start_line: 1, end_line: 100}, {start_line: -50} (last 50 lines), {start_line: -100, end_line: -10} (last 100 to last 10 lines). If omitted, processes the entire file.');

const readFileResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  content: z.union([z.string(), z.array(lineContentSchema), z.null()]).optional().describe("File content as a single string ('plain'), array of lines ('lines'), or null ('stats_only')"),
  stat: fileStatSchema.optional().describe('File status information if includeStats is true'),
  error: z.string().optional(),
  encoding: z.string().optional(),
  lines_read: z.number().int().optional().describe('Number of lines actually read and returned in content.'), // Add lines_read
  total_lines: z.number().int().optional().describe('Total lines in the original file (if read).'), // Add total_lines
});

export const readFilesTool = tool({
  description: 'Read the content of one or more files in the workspace. Can return content as plain text or line-by-line, optionally include file stats, and read specific line ranges (supports negative indexing from end). Use relative paths from the workspace root. Reading specific ranges requires loading the whole file.',
  parameters: z.object({
    paths: z.array(z.string()).min(1).describe('An array of relative paths to the files within the workspace.'),
    encoding: z.enum(['utf8', 'hex', 'base64']).optional().default('utf8').describe("The encoding to use for reading the file content. Defaults to 'utf8'."),
    outputFormat: z.enum(['plain', 'lines', 'stats_only']).optional().default('lines').describe("Output format: 'plain' (full content string), 'lines' (array of {line, content}), 'stats_only' (only file stats). Defaults to 'lines'."),
    includeStats: z.boolean().optional().default(false).describe("Whether to include file status information (type, size, mtime) in the result. Defaults to false. Implicitly true if outputFormat is 'stats_only'."),
    lineRange: lineRangeSchema,
  }),
  // Modify execute signature
  execute: async ({ paths, encoding = 'utf8', outputFormat = 'lines', includeStats: requestedIncludeStats = false, lineRange = {} }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => { // Default lineRange to {}
    const results: z.infer<typeof readFileResultSchema>[] = [];

    if (!vscode.workspace.workspaceFolders) {
      // Return a general error if no workspace is open, affecting all files
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Determine if stats are needed (requested or implied by stats_only format)
    const includeStats = requestedIncludeStats || outputFormat === 'stats_only';

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'processing', message: `Starting to process ${paths.length} file(s)... (Format: ${outputFormat}, Stats: ${includeStats})` });
    }

    for (const filePath of paths) {
      let fileResult: z.infer<typeof readFileResultSchema> = { path: filePath, success: false, encoding: encoding };
      let fileStat: z.infer<typeof fileStatSchema> | undefined = undefined;

      try {
        // Ensure the path is relative and within the workspace
        const absolutePath = path.resolve(workspaceUri.fsPath, filePath);
        if (!absolutePath.startsWith(workspaceUri.fsPath)) {
            throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
        }

        const fileUri = Uri.joinPath(workspaceUri, filePath);

        // Send status update for the current file
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'processing', message: `Reading file: ${filePath} (encoding: ${encoding})` });
        }

        // Get stats if requested or needed for format check
        if (includeStats) {
          try {
            if (data && toolCallId) {
              data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'processing', message: `Getting stats for: ${filePath}` });
            }
            const stat = await vscode.workspace.fs.stat(fileUri);
            let fileTypeString: 'file' | 'directory' | 'symbolic_link' | 'unknown' = 'unknown';
            let size: number | undefined = undefined;
            switch (stat.type) {
              case vscode.FileType.File: fileTypeString = 'file'; size = stat.size; break;
              case vscode.FileType.Directory: fileTypeString = 'directory'; break;
              case vscode.FileType.SymbolicLink: fileTypeString = 'symbolic_link'; break;
              default: fileTypeString = 'unknown';
            }
            fileStat = {
              name: path.basename(filePath),
              path: filePath,
              type: fileTypeString,
              size: size,
              mtime: stat.mtime,
            };
            // Validate stat before proceeding
            const statValidation = fileStatSchema.safeParse(fileStat);
            if (!statValidation.success) {
              console.warn(`readFilesTool: Stat validation failed for ${filePath}:`, statValidation.error);
              fileStat = undefined; // Don't include invalid stat
            }
            if (data && toolCallId) {
              data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'processing', message: `Got stats for: ${filePath}` });
            }
          } catch (statError: any) {
            // If stats fail, we must error out if stats_only was requested.
            // Otherwise, we can warn and continue for 'plain'/'lines' if includeStats was optional.
            if (outputFormat === 'stats_only') {
               throw new Error(`Could not get required stats for ${filePath}: ${statError.message}`);
            } else {
               console.warn(`readFilesTool: Could not get stats for ${filePath}: ${statError.message}`);
               if (data && toolCallId) {
                   data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'warning', message: `Could not get stats for: ${filePath}` });
               }
               // Proceed without stats if not strictly required
            }
          }
        }

        // Check if it's a directory (based on stats if available, otherwise let readFile fail)
        if (fileStat?.type === 'directory') {
            throw new Error(`Cannot read content of a directory: ${filePath}`);
        }

        let fileContent: string | z.infer<typeof lineContentSchema>[] | null = null;
        let linesReadCount: number | undefined = undefined;
        let totalLines: number | undefined = undefined;

        // Only read content if format is not 'stats_only'
        if (outputFormat !== 'stats_only') {
            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'processing', message: `Reading content for: ${filePath} (encoding: ${encoding})` });
            }
            const uint8Array = await vscode.workspace.fs.readFile(fileUri);

            if (encoding === 'utf8') {
                const decodedString = new TextDecoder().decode(uint8Array);
                const allLines = decodedString.split(/\r?\n/);
                totalLines = allLines.length; // Assign to the outer scope variable
                let selectedLines: string[] = [];
                let actualStartLine = 1; // Keep track of the original start line number for 'lines' format
                let startIndex = 0;
                let endIndex = totalLines;

                try {
                    // Resolve potentially negative line numbers to 0-based indices
                    const resolvedIndices = resolveLineRangeIndices(lineRange, totalLines);
                    startIndex = resolvedIndices.startIndex;
                    endIndex = resolvedIndices.endIndex; // Slice uses exclusive end index
                    actualStartLine = startIndex + 1; // 1-based line number for the first selected line
                    selectedLines = allLines.slice(startIndex, endIndex);
                } catch (rangeError: any) {
                    throw new Error(`Invalid line range for file with ${totalLines} lines: ${rangeError.message}`);
                }
                linesReadCount = selectedLines.length; // Assign to the outer scope variable

                if (outputFormat === 'lines') {
                    fileContent = selectedLines.map((line, index) => ({
                        line: actualStartLine + index, // Use original line number
                        content: line,
                    }));
                } else { // plain
                    fileContent = selectedLines.join('\n');
                }
            } else {
                // For non-utf8 encodings, line-based operations (range, tail, 'lines' format) don't make sense.
                // Always return the full content as a plain string.
                if (outputFormat === 'lines' || lineRange.start_line || lineRange.end_line) { // Check if range or lines format was attempted
                     if (data && toolCallId) {
                        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'warning', message: `Line operations (range, 'lines' format) ignored for non-utf8 encoding (${encoding}) on file: ${filePath}. Returning full content.` });
                     }
                }
                fileContent = Buffer.from(uint8Array).toString(encoding);
                outputFormat = 'plain'; // Force output format to plain
            }
        } else {
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'processing', message: `Skipping content read for: ${filePath} (format: stats_only)` });
             }
        }

        fileResult = {
            path: filePath,
            success: true,
            content: fileContent, // Will be null if stats_only
            stat: fileStat, // Include stat if available (always attempted if stats_only or includeStats=true)
            encoding: encoding,
            lines_read: outputFormat !== 'stats_only' ? linesReadCount : undefined,
            total_lines: outputFormat !== 'stats_only' ? totalLines : undefined,
        };

      } catch (error: any) {
        // Provide more specific error messages
        let errorMessage = `Failed to read file '${filePath}'.`;
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
          errorMessage = `Error: File not found at path '${filePath}'.`;
        } else if (error.message.includes('Access denied')) {
            errorMessage = error.message; // Use the specific access denied message
        } else if (error instanceof Error) {
          errorMessage += ` Reason: ${error.message}`;
        } else {
          errorMessage += ` Unknown error: ${String(error)}`;
        }
        console.error(`readFilesTool Error for ${filePath}: ${error}`);
        fileResult = { path: filePath, success: false, error: errorMessage, encoding: encoding, stat: fileStat }; // Include stat even on error if available
      }
      results.push(fileResult);
    } // End loop

    // Send final status
    const successfulReads = results.filter(r => r.success).length;
    const finalMessage = `Processed ${paths.length} file(s). Successful: ${successfulReads}.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFilesTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(readFileResultSchema).safeParse(results);
    // Determine overall success based on whether *any* file read succeeded? Or all?
    // Let's define overall success as at least one file read successfully.
    const overallSuccess = results.some(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  } // End execute
});

// Helper function to resolve line range (potentially with negative indices)
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
        // This case should ideally be caught by the clamping above or basic Zod checks,
        // but as a safeguard:
        console.warn(`Calculated start index (${startIndex}) is greater than end index (${endIndex}). Returning empty range.`);
        return { startIndex: endIndex, endIndex: endIndex }; // Return empty range
        // Or throw: throw new Error(`Calculated start index (${startIndex}) cannot be greater than calculated end index (${endIndex}).`);
    }

    return { startIndex, endIndex };
}