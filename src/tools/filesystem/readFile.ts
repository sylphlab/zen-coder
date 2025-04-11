import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

const readFileResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  content: z.string().optional(),
  error: z.string().optional(),
  encoding: z.string().optional(),
});

export const readFileTool = tool({
  description: 'Read the content of one or more files in the workspace. Use relative paths from the workspace root.',
  parameters: z.object({
    filePaths: z.array(z.string()).min(1).describe('An array of relative paths to the files within the workspace.'),
    encoding: z.enum(['utf8', 'hex', 'base64']).optional().default('utf8').describe("The encoding to use for reading the file content. Defaults to 'utf8'."),
  }),
  // Modify execute signature
  execute: async ({ filePaths, encoding = 'utf8' }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof readFileResultSchema>[] = [];

    if (!vscode.workspace.workspaceFolders) {
      // Return a general error if no workspace is open, affecting all files
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFileTool', status: 'processing', message: `Starting to read ${filePaths.length} file(s)...` });
    }

    for (const filePath of filePaths) {
      let fileResult: z.infer<typeof readFileResultSchema> = { path: filePath, success: false, encoding: encoding };
      try {
        // Ensure the path is relative and within the workspace
        const absolutePath = path.resolve(workspaceUri.fsPath, filePath);
        if (!absolutePath.startsWith(workspaceUri.fsPath)) {
            throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
        }

        const fileUri = Uri.joinPath(workspaceUri, filePath);

        // Send status update for the current file
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFileTool', status: 'processing', message: `Reading file: ${filePath} (encoding: ${encoding})` });
        }

        const uint8Array = await vscode.workspace.fs.readFile(fileUri);
        let content: string;
        if (encoding === 'utf8') {
            content = new TextDecoder().decode(uint8Array);
        } else {
            content = Buffer.from(uint8Array).toString(encoding);
        }

        fileResult = { path: filePath, success: true, content: content, encoding: encoding };

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
        console.error(`readFileTool Error for ${filePath}: ${error}`);
        fileResult = { path: filePath, success: false, error: errorMessage, encoding: encoding };
      }
      results.push(fileResult);
    } // End loop

    // Send final status
    const successfulReads = results.filter(r => r.success).length;
    const finalMessage = `Read ${successfulReads}/${filePaths.length} files.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'readFileTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(readFileResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("readFileTool validation error:", validationResult.error);
        // Return a general error if validation fails
        return { success: false, error: "Internal error: Failed to format read results.", results: [] };
    }

    // Determine overall success based on whether *any* file read succeeded? Or all?
    // Let's define overall success as at least one file read successfully.
    const overallSuccess = results.some(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  } // End execute
});