import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';
import { TextEncoder, TextDecoder } from 'util'; // Node.js util for encoding

// Schema for a single edit operation within a file
const fileEditOperationSchema = z.object({
  search_pattern: z.string().optional().describe('Multi-line text or regex pattern to find the block to replace or delete. If empty or omitted, implies insertion at start_line.'),
  start_line: z.number().int().positive().describe('The 1-based line number where the search_pattern is expected to start, or where insertion should occur.'),
  replace_content: z.string().optional().describe('The content to replace the matched block with. If omitted and search_pattern is present, it deletes the matched block. Required for insertion.'),
  use_regex: z.boolean().optional().default(false).describe('Treat search_pattern as a regular expression.'),
  ignore_leading_whitespace: z.boolean().optional().default(true).describe('Ignore leading whitespace on each line of search_pattern when matching plain text.'),
  preserve_indentation: z.boolean().optional().default(true).describe('Attempt to automatically adjust the indentation of replace_content to match the context of the replaced/inserted block.'),
  match_occurrence: z.number().int().positive().optional().default(1).describe('Specifies which occurrence of the search_pattern (relative to start_line if provided, or globally otherwise) to target (1-based). Default is 1.'),
}).refine(data => data.search_pattern || data.replace_content !== undefined, {
    message: "Either 'search_pattern' (for replace/delete) or 'replace_content' (for insertion) must be provided.",
}).refine(data => !(!data.search_pattern && data.replace_content === undefined), {
    message: "'replace_content' is required when 'search_pattern' is omitted (for insertion).",
});


// Schema for the changes to apply to a single file
const fileChangesSchema = z.object({
  path: z.string().min(1).describe('Relative path to the file to modify.'),
  edits: z.array(fileEditOperationSchema).min(1).describe('List of edit operations to apply to this file sequentially.'),
});

// Schema for the result of a single edit operation
const editResultSchema = z.object({
  edit_index: z.number().int().describe('Corresponds to the index in the input edits array.'),
  success: z.boolean(),
  match_found: z.boolean().optional().describe('Whether the search_pattern was found (if provided).'),
  lines_affected: z.number().int().optional().describe('Number of lines affected by this edit.'),
  error: z.string().optional().describe('Reason if this specific edit failed.'),
});

// Schema for the overall result for a single file
const fileEditResultSchema = z.object({
  path: z.string(),
  success: z.boolean().describe('Whether all edits for this file were successful.'),
  edit_results: z.array(editResultSchema).describe('Results for each edit operation attempted on this file.'),
  // diff: z.string().optional().describe('Unified diff string if output_diff was true and the file was modified.'), // Diff generation TBD
  error: z.string().optional().describe('Top-level error for this file (e.g., file not found, permission error).'),
});


export const editFileTool = tool({
  description: 'Make selective edits to one or more files using advanced pattern matching and formatting options. Supports insertion, deletion, and replacement with indentation preservation. Use relative paths.',
  parameters: z.object({
    changes: z.array(fileChangesSchema).min(1).describe('List of changes to apply across one or more files.'),
    // dry_run: z.boolean().optional().default(false).describe('If true, perform matching and generate diffs but do not write any changes to disk.'), // Dry run TBD
    // output_diff: z.boolean().optional().default(true).describe('Whether to include a unified diff string in the result for each modified file.'), // Diff output TBD
  }),
  execute: async ({ changes/*, dry_run = false, output_diff = true*/ }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof fileEditResultSchema>[] = [];
    const decoder = new TextDecoder(); // Default UTF-8
    const encoder = new TextEncoder(); // Default UTF-8

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'processing', message: `Starting to edit ${changes.length} file(s)...` });
    }

    for (const change of changes) {
      const { path: filePath, edits } = change;
      const fileEditResults: z.infer<typeof editResultSchema>[] = [];
      let fileSuccess = true;
      let fileErrorMessage: string | undefined = undefined;

      // Send status update for the current file
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'processing', message: `Processing file: ${filePath}` });
      }

      try {
        // --- File Level Operations ---
        const absolutePath = path.resolve(workspaceUri.fsPath, filePath);
        if (!absolutePath.startsWith(workspaceUri.fsPath)) {
            throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
        }
        if (filePath.includes('.git/') || filePath.startsWith('.git')) {
            throw new Error(`Editing files in '.git' directory is not allowed.`);
        }

        const fileUri = Uri.joinPath(workspaceUri, filePath);
        let fileContentLines: string[];

        // Read the entire file content first
        try {
            const uint8Array = await vscode.workspace.fs.readFile(fileUri);
            const fileContentString = decoder.decode(uint8Array);
            fileContentLines = fileContentString.split(/\r?\n/);
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'processing', message: `Read ${fileContentLines.length} lines from ${filePath}` });
            }
        } catch (readError: any) {
            if (readError instanceof vscode.FileSystemError && readError.code === 'FileNotFound') {
                // Allow creation if the first edit is an insertion at line 1? Or just fail? Let's fail for now.
                throw new Error(`File not found at path '${filePath}'. Cannot edit non-existent file.`);
            }
            throw readError; // Re-throw other read errors
        }

        // --- Edit Level Operations ---
        let currentLineOffset = 0; // Track line changes due to previous edits in the same file

        for (let i = 0; i < edits.length; i++) {
          const edit = edits[i];
          const editResult: z.infer<typeof editResultSchema> = { edit_index: i, success: false };

          try {
            // Adjust start line based on previous edits
            const adjustedStartLine = edit.start_line + currentLineOffset;

            let matchStartIndex = -1;
            let matchEndIndex = -1; // Exclusive end index
            let matchFound = false;
            const searchPatternLines = edit.search_pattern?.split(/\r?\n/) ?? [];
            const numSearchLines = searchPatternLines.length;

            if (edit.search_pattern && numSearchLines > 0) {
                let occurrenceCount = 0;
                const searchStartFileIndex = Math.max(0, adjustedStartLine - 1); // Convert 1-based line to 0-based index

                for (let lineIndex = searchStartFileIndex; lineIndex <= fileContentLines.length - numSearchLines; lineIndex++) {
                    let isMatch = true;
                    for (let searchLineIndex = 0; searchLineIndex < numSearchLines; searchLineIndex++) {
                        const fileLine = fileContentLines[lineIndex + searchLineIndex];
                        let patternLine = searchPatternLines[searchLineIndex];

                        if (edit.use_regex) {
                            // Regex matching (simple line-by-line for now, multi-line regex needs more complex handling)
                            try {
                                const regex = new RegExp(patternLine); // Consider flags?
                                if (!regex.test(fileLine)) {
                                    isMatch = false;
                                    break;
                                }
                            } catch (regexError) {
                                throw new Error(`Invalid regex in search_pattern: ${patternLine}. Error: ${regexError}`);
                            }
                        } else {
                            // Plain text matching
                            if (edit.ignore_leading_whitespace) {
                                patternLine = patternLine.trimStart();
                                if (fileLine.trimStart() !== patternLine) {
                                    isMatch = false;
                                    break;
                                }
                            } else {
                                if (fileLine !== patternLine) {
                                    isMatch = false;
                                    break;
                                }
                            }
                        }
                    }

                    if (isMatch) {
                        occurrenceCount++;
                        if (occurrenceCount === edit.match_occurrence) {
                            matchStartIndex = lineIndex;
                            matchEndIndex = lineIndex + numSearchLines;
                            matchFound = true;
                            break; // Found the desired occurrence
                        }
                    }
                }
                editResult.match_found = matchFound;
            } else {
                 // No search pattern means insertion, technically no "match" to find
                 editResult.match_found = false;
            }

            // --- Now perform the edit based on match results ---
            const replaceContentLines = edit.replace_content?.split(/\r?\n/) ?? [];
            let linesAdded = 0;
            let linesRemoved = 0;

            if (!edit.search_pattern) { // Insertion
                if (edit.replace_content === undefined) throw new Error("replace_content is required for insertion.");
                const insertIndex = Math.max(0, Math.min(adjustedStartLine - 1, fileContentLines.length)); // Ensure index is valid
                let finalReplaceLines = replaceContentLines;

                if (edit.preserve_indentation && replaceContentLines.length > 0) {
                    // Get indentation of the line *at* the insertion index (or previous line if inserting at end)
                    const targetLineIndex = Math.min(insertIndex, fileContentLines.length - 1);
                    const targetIndentation = targetLineIndex >= 0 ? (fileContentLines[targetLineIndex].match(/^\s*/) ?? [''])[0] : '';
                    finalReplaceLines = adjustIndentation(replaceContentLines, targetIndentation);
                }

                if (edit.preserve_indentation && replaceContentLines.length > 0) {
                    // Get indentation of the line *at* the insertion index (or previous line if inserting at end)
                    const targetLineIndex = Math.min(insertIndex, fileContentLines.length - 1);
                    const targetIndentation = targetLineIndex >= 0 ? (fileContentLines[targetLineIndex].match(/^\s*/) ?? [''])[0] : '';
                    finalReplaceLines = adjustIndentation(replaceContentLines, targetIndentation);
                }

                fileContentLines.splice(insertIndex, 0, ...finalReplaceLines);
                linesAdded = finalReplaceLines.length;
                editResult.lines_affected = linesAdded;
            } else if (matchFound) { // Replace or Delete
                linesRemoved = matchEndIndex - matchStartIndex;
                if (edit.replace_content !== undefined) { // Replace
                    let finalReplaceLines = replaceContentLines;
                    if (edit.preserve_indentation && replaceContentLines.length > 0 && matchStartIndex < fileContentLines.length) {
                         // Get indentation of the first line being replaced
                        const targetIndentation = (fileContentLines[matchStartIndex].match(/^\s*/) ?? [''])[0];
                        finalReplaceLines = adjustIndentation(replaceContentLines, targetIndentation);
                    }
                    fileContentLines.splice(matchStartIndex, linesRemoved, ...finalReplaceLines);
                    linesAdded = finalReplaceLines.length;
                    editResult.lines_affected = Math.max(linesAdded, linesRemoved);
                } else { // Delete
                    fileContentLines.splice(matchStartIndex, linesRemoved);
                    editResult.lines_affected = linesRemoved;
                }
            } else {
                // Search pattern provided but not found
                throw new Error(`Search pattern not found starting from line ${adjustedStartLine} (occurrence ${edit.match_occurrence}).`);
            }

            // Update line offset for subsequent edits
            currentLineOffset += (linesAdded - linesRemoved);

            // Set final edit result details
            editResult.success = true; // Assume success unless error thrown above
            // match_found was set during the search phase (lines 176/179)
            // lines_affected was set during the splice operations (lines 201, 208, 211)

             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'processing', message: `File ${filePath}: Applied edit #${i+1}` });
            }


          } catch (editError: any) {
            console.error(`editFileTool Error during edit #${i} for ${filePath}: ${editError}`);
            editResult.success = false;
            editResult.error = editError instanceof Error ? editError.message : String(editError);
            fileSuccess = false; // Mark file as failed if any edit fails
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'warning', message: `File ${filePath}: Failed edit #${i+1}: ${editResult.error}` });
            }
          }
          fileEditResults.push(editResult);
        } // End loop through edits

        // --- Write Modified File (if all edits succeeded and not dry_run) ---
        if (fileSuccess /* && !dry_run */) {
          const modifiedContent = fileContentLines.join('\n');
          await vscode.workspace.fs.writeFile(fileUri, encoder.encode(modifiedContent));
           if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'processing', message: `Successfully wrote changes to ${filePath}` });
            }
        } else {
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'warning', message: `Skipped writing file ${filePath} due to edit errors.` });
            }
        }

        // --- TODO: Generate Diff (if output_diff and modified) ---


      } catch (fileError: any) {
        console.error(`editFileTool Error processing file ${filePath}: ${fileError}`);
        fileSuccess = false;
        fileErrorMessage = fileError instanceof Error ? fileError.message : String(fileError);
         if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'error', message: `Error processing file ${filePath}: ${fileErrorMessage}` });
        }
      }

      results.push({
        path: filePath,
        success: fileSuccess,
        edit_results: fileEditResults,
        error: fileErrorMessage,
        // diff: generatedDiff // TBD
      });
    } // End loop through changes

    // Send final status
    const successfulFiles = results.filter(r => r.success).length;
    const finalMessage = `Finished editing ${successfulFiles}/${changes.length} files.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'editFileTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(fileEditResultSchema).safeParse(results);
     if (!validationResult.success) {
        console.error("editFileTool validation error:", validationResult.error);
        return { success: false, error: "Internal error: Failed to format edit results.", results: [] };
    }

    // Determine overall success
    const overallSuccess = results.every(r => r.success); // Require all files to succeed for overall success? Or some? Let's say all for now.

    return { success: overallSuccess, results: validationResult.data };
  },
});

// Helper function to adjust indentation of replacement lines
function adjustIndentation(linesToAdjust: string[], targetIndentation: string): string[] {
    if (linesToAdjust.length === 0) return [];

    const firstLineIndentation = (linesToAdjust[0].match(/^\s*/) ?? [''])[0];
    const adjustedLines = [linesToAdjust[0].trimStart()]; // First line always matches target indent exactly (after trim)

    for (let i = 1; i < linesToAdjust.length; i++) {
        const currentLine = linesToAdjust[i];
        const currentIndentation = (currentLine.match(/^\s*/) ?? [''])[0];
        // Calculate relative indentation compared to the first replacement line
        const relativeIndentation = currentIndentation.startsWith(firstLineIndentation)
            ? currentIndentation.substring(firstLineIndentation.length)
            : currentIndentation; // Or handle differently if indent decreases? Keep original relative indent for now.

        adjustedLines.push(relativeIndentation + currentLine.trimStart());
    }

    // Apply the target indentation to all lines
    return adjustedLines.map(line => targetIndentation + line);
}