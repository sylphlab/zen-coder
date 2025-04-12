import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { readFilesTool } from '../../tools/filesystem/readFiles'; // Renamed
import { writeFilesTool } from '../../tools/filesystem/writeFiles'; // Renamed
import { listFilesTool } from '../../tools/filesystem/listFiles';
import { createFolderTool } from '../../tools/filesystem/createFolder';
import { statItemsTool } from '../../tools/filesystem/statItems'; // Renamed from getStatTool
import { deleteFileTool } from '../../tools/filesystem/deleteFile';
import { deleteFolderTool } from '../../tools/filesystem/deleteFolder'; // Import deleteFolderTool
import { StreamData } from 'ai';

// Helper function to create a file with content
async function createFile(uri: vscode.Uri, content: string | Buffer): Promise<void> {
    // Explicitly handle string case for Buffer.from to satisfy TS overload resolution
    const buffer = content instanceof Buffer ? content : Buffer.from(content as string, 'utf8');
    await vscode.workspace.fs.writeFile(uri, buffer);
}

// Helper function to delete a file/directory
async function deleteItem(uri: vscode.Uri): Promise<void> {
    try {
        await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
    } catch (error) {
        // Ignore if file doesn't exist
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            return;
        }
        // Ignore if attempting to delete root on teardown (less critical)
        if (error instanceof vscode.FileSystemError && error.code === 'EPERM' && uri.path === vscode.workspace.workspaceFolders?.[0].uri.path) {
             console.warn(`Skipping deletion of workspace root: ${uri.fsPath}`);
             return;
        }
        console.error(`Error deleting ${uri.fsPath}:`, error); // Log other errors
        // Don't re-throw during teardown to avoid masking test failures
        // throw error;
    }
}

// Helper to check if a file/dir exists (moved to top level)
async function verifyItemExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch (error) {
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            return false;
        }
        throw error; // Re-throw unexpected errors
    }
}

suite('Filesystem Tools Test Suite', () => {
    vscode.window.showInformationMessage('Start all filesystem tool tests.');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    assert.ok(workspaceFolders, "No workspace folder found for testing");
    const workspaceUri = workspaceFolders[0].uri;
    const testDirUri = vscode.Uri.joinPath(workspaceUri, '.test_temp_fs');
    const testFile1Path = '.test_temp_fs/testFile1.txt';
    const testFile2Path = '.test_temp_fs/testFile2.bin';
    const testFile1Uri = vscode.Uri.joinPath(workspaceUri, testFile1Path);
    const testFile2Uri = vscode.Uri.joinPath(workspaceUri, testFile2Path);
    const nonExistentFilePath = '.test_temp_fs/nonExistent.txt';
    const outsideFilePath = '../outside_workspace_file.txt'; // Relative path attempting to go outside
    const writeFileNewPath = '.test_temp_fs/newWriteFile.txt';
    const writeFileNewUri = vscode.Uri.joinPath(workspaceUri, writeFileNewPath);
    const writeFileAppendPath = '.test_temp_fs/appendFile.txt';
    const writeFileAppendUri = vscode.Uri.joinPath(workspaceUri, writeFileAppendPath);
    const writeBinaryPath = '.test_temp_fs/writeBinary.bin';
    const writeBinaryUri = vscode.Uri.joinPath(workspaceUri, writeBinaryPath);
    // For listFiles tests
    const listRootDir = '.test_temp_fs';
    const listSubDir1 = '.test_temp_fs/subDir1';
    const listSubDir1Uri = vscode.Uri.joinPath(workspaceUri, listSubDir1);
    const listSubFile1 = '.test_temp_fs/subDir1/subFile1.txt';
    const listSubFile1Uri = vscode.Uri.joinPath(workspaceUri, listSubFile1);
    const listSubDir2 = '.test_temp_fs/subDir2';
    const listSubDir2Uri = vscode.Uri.joinPath(workspaceUri, listSubDir2);
    const listSubSubDir = '.test_temp_fs/subDir2/subSubDir';
    const listSubSubDirUri = vscode.Uri.joinPath(workspaceUri, listSubSubDir);
    const listSubSubFile = '.test_temp_fs/subDir2/subSubDir/subSubFile.txt';
    const listSubSubFileUri = vscode.Uri.joinPath(workspaceUri, listSubSubFile);
    const listNonExistentDir = '.test_temp_fs/nonExistentDir';
    // For createFolder tests
    const createFolderPath1 = '.test_temp_fs/newFolder1';
    const createFolderPath1Uri = vscode.Uri.joinPath(workspaceUri, createFolderPath1);
    const createFolderPath2 = '.test_temp_fs/newFolder2/nested';
    const createFolderPath2Uri = vscode.Uri.joinPath(workspaceUri, createFolderPath2);
    const createFolderExistingPath = listSubDir1; // Already created in setup
    const createFolderFilePath = testFile1Path; // Path is a file, not a dir
    // For deleteFile tests
    const deleteFilePath1 = '.test_temp_fs/deleteMe1.txt';
    const deleteFilePath1Uri = vscode.Uri.joinPath(workspaceUri, deleteFilePath1);
    const deleteFilePath2 = '.test_temp_fs/deleteMe2.txt';
    const deleteFilePath2Uri = vscode.Uri.joinPath(workspaceUri, deleteFilePath2);
    const deleteFilePathPerm = '.test_temp_fs/deleteMePerm.txt';
    const deleteFilePathPermUri = vscode.Uri.joinPath(workspaceUri, deleteFilePathPerm);
    const deleteNonExistentPath = '.test_temp_fs/iDoNotExistToDelete.txt';
    const deleteDirPath = listSubDir1; // Path is a directory
    // For deleteFolder tests
    const deleteFolderPath1 = '.test_temp_fs/deleteFolder1'; // Will be created in setup
    const deleteFolderPath1Uri = vscode.Uri.joinPath(workspaceUri, deleteFolderPath1);
    const deleteFolderWithContentPath = '.test_temp_fs/deleteFolderWithContent'; // Will be created with content in setup
    const deleteFolderWithContentUri = vscode.Uri.joinPath(workspaceUri, deleteFolderWithContentPath);
    const deleteFolderWithContentFilePath = '.test_temp_fs/deleteFolderWithContent/somefile.txt';
    const deleteFolderWithContentFileUri = vscode.Uri.joinPath(workspaceUri, deleteFolderWithContentFilePath);
    const deleteFolderPermPath = '.test_temp_fs/deleteFolderPerm'; // Will be created in setup
    const deleteFolderPermUri = vscode.Uri.joinPath(workspaceUri, deleteFolderPermPath);
    const deleteFolderNonExistentPath = '.test_temp_fs/iDoNotExistToDeleteFolder';
    const deleteFolderFilePath = testFile1Path; // Path is a file


    const testContent1 = 'Hello World!';
    const testContent2 = Buffer.from([0x01, 0x02, 0x03, 0x04]); // Binary content
    const writeContentNew = 'This is a new file.';
    const writeContentOverwrite = 'This file was overwritten.';
    const appendContentStart = 'Initial append content. ';
    const appendContentNext = 'More appended content.';
    const hexContent = '48656c6c6f20486578'; // "Hello Hex"
    const base64Content = 'SGVsbG8gQmFzZTY0'; // "Hello Base64"
    const subFileContent = 'Content in subfile 1';
    const subSubFileContent = 'Content in sub-sub-file';
    const deleteFileContent = 'This file is destined for deletion.';
    const deleteFolderFileContent = 'Content inside folder to be deleted.';

    // Instantiate a real StreamData object for mocking
    const mockStreamData = new StreamData();
    // Optionally, spy on or override methods if needed for specific tests, e.g.:
    // vi.spyOn(mockStreamData, 'appendMessageAnnotation'); // If using Vitest/Jest spies
    // mockStreamData.appendMessageAnnotation = (annotation) => { console.log('Overridden Annotation:', annotation); };

    // Minimal mock for ToolExecutionOptions needed by some tool function signatures
    const mockToolExecutionOptions = {
        toolCallId: 'test-call-id', // Provide a mock ID
        messages: [], // Provide an empty messages array
        // data: mockStreamData // Include if the tool actually uses StreamData
    };


    // Setup before all tests in this suite
    suiteSetup(async () => {
        console.log(`Setting up test directory: ${testDirUri.fsPath}`);
        await deleteItem(testDirUri); // Clean up previous runs
        await vscode.workspace.fs.createDirectory(testDirUri);
        await createFile(testFile1Uri, testContent1); // For reading
        await createFile(testFile2Uri, testContent2); // For reading binary
        await createFile(writeFileAppendUri, appendContentStart); // For appending
        // Create structure for listFiles tests
        await vscode.workspace.fs.createDirectory(listSubDir1Uri);
        await createFile(listSubFile1Uri, subFileContent);
        await vscode.workspace.fs.createDirectory(listSubDir2Uri);
        await vscode.workspace.fs.createDirectory(listSubSubDirUri);
        await createFile(listSubSubFileUri, subSubFileContent);
        // Create files for delete tests
        await createFile(deleteFilePath1Uri, deleteFileContent);
        await createFile(deleteFilePath2Uri, deleteFileContent);
        await createFile(deleteFilePathPermUri, deleteFileContent);
        // Create files for deleteFile tests (will be recreated in deleteFileTool suite setup)
        // await createFile(deleteFilePath1Uri, deleteFileContent);
        // await createFile(deleteFilePath2Uri, deleteFileContent);
        // await createFile(deleteFilePathPermUri, deleteFileContent);
        console.log(`Test files created in ${testDirUri.fsPath}`);
    });

    // Teardown after all tests in this suite
    suiteTeardown(async () => {
        console.log(`Tearing down test directory: ${testDirUri.fsPath}`);
        await deleteItem(testDirUri);
        console.log(`Test directory torn down.`);
    });

    suite('readFileTool Tests', () => {
        test('Should read a single existing UTF-8 file', async () => {
            // Explicitly provide default encoding and assert options type
            const result = await readFilesTool.execute({ paths: [testFile1Path], encoding: 'utf8', outputFormat: 'plain', includeStats: false }, { data: mockStreamData, toolCallId: 'test1' } as any);
            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results, 'Results array should exist on success');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const fileResult = result.results[0];
            assert.strictEqual(fileResult.path, testFile1Path);
            assert.ok(fileResult.success, 'File read success should be true');
            assert.strictEqual(fileResult.content, testContent1);
            assert.strictEqual(fileResult.encoding, 'utf8');
            assert.strictEqual(fileResult.error, undefined);
        });

        test('Should read multiple existing files (UTF-8 and binary as hex)', async () => {
            const result = await readFilesTool.execute({ paths: [testFile1Path, testFile2Path], encoding: 'hex', outputFormat: 'plain', includeStats: false }, { data: mockStreamData, toolCallId: 'test2' } as any);
            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results, 'Results array should exist on success');
            assert.strictEqual(result.results.length, 2, 'Should have two results');

            const fileResult1 = result.results.find((r: { path: string }) => r.path === testFile1Path);
            assert.ok(fileResult1, 'Result for testFile1.txt not found');
            assert.ok(fileResult1.success, 'File 1 read success should be true');
            assert.strictEqual(fileResult1.content, Buffer.from(testContent1, 'utf8').toString('hex')); // Compare hex
            assert.strictEqual(fileResult1.encoding, 'hex');

            const fileResult2 = result.results.find((r: { path: string }) => r.path === testFile2Path);
            assert.ok(fileResult2, 'Result for testFile2.bin not found');
            assert.ok(fileResult2.success, 'File 2 read success should be true');
            assert.strictEqual(fileResult2.content, testContent2.toString('hex')); // Compare hex
            assert.strictEqual(fileResult2.encoding, 'hex');
        });

        test('Should handle non-existent files gracefully', async () => {
            const result = await readFilesTool.execute({ paths: [nonExistentFilePath], encoding: 'utf8', outputFormat: 'plain', includeStats: false }, { data: mockStreamData, toolCallId: 'test3' } as any);
            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.ok(result.results, 'Results array should exist even on failure');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const fileResult = result.results[0];
            assert.strictEqual(fileResult.path, nonExistentFilePath);
            assert.strictEqual(fileResult.success, false, 'File read success should be false');
            assert.ok(fileResult.error?.includes('File not found'), `Error message "${fileResult.error}" should indicate file not found`);
            assert.strictEqual(fileResult.content, undefined);
        });

        test('Should handle mix of existing and non-existent files', async () => {
            const result = await readFilesTool.execute({ paths: [testFile1Path, nonExistentFilePath], encoding: 'utf8', outputFormat: 'plain', includeStats: false }, { data: mockStreamData, toolCallId: 'test4' } as any);
            // Overall success is true because at least one file succeeded
            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results, 'Results array should exist on partial success');
            assert.strictEqual(result.results.length, 2, 'Should have two results');

            const fileResult1 = result.results.find((r: { path: string }) => r.path === testFile1Path);
            assert.ok(fileResult1, 'Result for testFile1.txt not found');
            assert.ok(fileResult1.success, 'File 1 read success should be true');
            assert.strictEqual(fileResult1.content, testContent1);

            const fileResult2 = result.results.find((r: { path: string }) => r.path === nonExistentFilePath);
            assert.ok(fileResult2, 'Result for nonExistentFilePath not found');
            assert.strictEqual(fileResult2.success, false, 'File 2 read success should be false');
            assert.ok(fileResult2.error?.includes('File not found'), `Error message "${fileResult2.error}" should indicate file not found`);
        });

        test('Should prevent reading files outside the workspace', async () => {
            const result = await readFilesTool.execute({ paths: [outsideFilePath], encoding: 'utf8', outputFormat: 'plain', includeStats: false }, { data: mockStreamData, toolCallId: 'test5' } as any);
            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.ok(result.results, 'Results array should exist on failure');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const fileResult = result.results[0];
            assert.strictEqual(fileResult.path, outsideFilePath);
            assert.strictEqual(fileResult.success, false, 'File read success should be false');
            assert.ok(fileResult.error?.includes('outside the workspace'), `Error message "${fileResult.error}" should indicate outside workspace`);
        });

         test('Should read binary file as base64', async () => {
            const result = await readFilesTool.execute({ paths: [testFile2Path], encoding: 'base64', outputFormat: 'plain', includeStats: false }, { data: mockStreamData, toolCallId: 'test6' } as any);
            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results, 'Results array should exist on success');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const fileResult = result.results[0];
            assert.strictEqual(fileResult.path, testFile2Path);
            assert.ok(fileResult.success, 'File read success should be true');
            assert.strictEqual(fileResult.content, testContent2.toString('base64'));
            assert.strictEqual(fileResult.encoding, 'base64');
        });

    });

    // Add suites for other filesystem tools here...

    suite('writeFileTool Tests', () => {
        // Helper to read file content for verification
        async function verifyFileContent(uri: vscode.Uri, expectedContent: string | Buffer, encoding: 'utf8' | 'hex' | 'base64' = 'utf8') {
            try {
                const actualBuffer = await vscode.workspace.fs.readFile(uri);
                let actualContent: string | Buffer;
                 if (Buffer.isBuffer(expectedContent)) {
                     actualContent = Buffer.from(actualBuffer); // Convert Uint8Array to Buffer
                     assert.deepStrictEqual(actualContent, expectedContent, `Binary content mismatch for ${uri.fsPath}`);
                 } else {
                     actualContent = Buffer.from(actualBuffer).toString(encoding);
                     assert.strictEqual(actualContent, expectedContent, `Content mismatch for ${uri.fsPath}`);
                 }

            } catch (error) {
                 assert.fail(`Failed to read file for verification ${uri.fsPath}: ${error}`);
            }
        }

         test('Should write a single new UTF-8 file', async () => {
            const filesToWrite = [{ path: writeFileNewPath, content: writeContentNew }];
            const result = await writeFilesTool.execute({ items: filesToWrite, encoding: 'utf8', append: false }, { data: mockStreamData, toolCallId: 'write-test1' } as any); // Use items

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const fileResult = result.results[0];
            assert.strictEqual(fileResult.path, writeFileNewPath);
            assert.ok(fileResult.success, 'File write success should be true');
            assert.ok(fileResult.message?.includes('written successfully'), 'Success message mismatch');
            await verifyFileContent(writeFileNewUri, writeContentNew);
        });

        test('Should overwrite an existing UTF-8 file', async () => {
            // First ensure the file exists from the previous test
             await verifyFileContent(writeFileNewUri, writeContentNew);

            const filesToWrite = [{ path: writeFileNewPath, content: writeContentOverwrite }];
            const result = await writeFilesTool.execute({ items: filesToWrite, encoding: 'utf8', append: false }, { data: mockStreamData, toolCallId: 'write-test2' } as any); // Use items

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'File write success should be true');
            assert.ok(result.results[0].message?.includes('overwritten'), 'Success message should indicate overwrite');
            await verifyFileContent(writeFileNewUri, writeContentOverwrite);
        });

         test('Should append to an existing UTF-8 file', async () => {
            const filesToAppend = [{ path: writeFileAppendPath, content: appendContentNext }];
            const result = await writeFilesTool.execute({ items: filesToAppend, encoding: 'utf8', append: true }, { data: mockStreamData, toolCallId: 'write-test3' } as any); // Use items

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'File append success should be true');
            assert.ok(result.results[0].message?.includes('appended'), 'Success message should indicate append');
            await verifyFileContent(writeFileAppendUri, appendContentStart + appendContentNext);
        });

        test('Should write a new file with hex encoding', async () => {
            const filesToWrite = [{ path: writeBinaryPath, content: hexContent }];
            const result = await writeFilesTool.execute({ items: filesToWrite, encoding: 'hex', append: false }, { data: mockStreamData, toolCallId: 'write-test4' } as any); // Use items

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'File write success should be true');
            await verifyFileContent(writeBinaryUri, Buffer.from(hexContent, 'hex')); // Verify binary content
        });

         test('Should write a new file with base64 encoding', async () => {
            const filesToWrite = [{ path: writeBinaryPath, content: base64Content }]; // Overwrite previous binary
            const result = await writeFilesTool.execute({ items: filesToWrite, encoding: 'base64', append: false }, { data: mockStreamData, toolCallId: 'write-test5' } as any); // Use items

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'File write success should be true');
            await verifyFileContent(writeBinaryUri, Buffer.from(base64Content, 'base64')); // Verify binary content
        });

        test('Should write multiple files (new and overwrite)', async () => {
            const filesToWrite = [
                { path: writeFileNewPath, content: "Multi-write overwrite" }, // Overwrite
                { path: '.test_temp_fs/multiWriteNew.txt', content: "Multi-write new file" } // New
            ];
            const newMultiUri = vscode.Uri.joinPath(workspaceUri, '.test_temp_fs/multiWriteNew.txt');

            const result = await writeFilesTool.execute({ items: filesToWrite, encoding: 'utf8', append: false }, { data: mockStreamData, toolCallId: 'write-test6' } as any); // Use items

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 2, 'Should have two results');
            assert.ok(result.results.every(r => r.success), 'All individual writes should succeed');

            await verifyFileContent(writeFileNewUri, "Multi-write overwrite");
            await verifyFileContent(newMultiUri, "Multi-write new file");
        });

        test('Should prevent writing files outside the workspace', async () => {
            const filesToWrite = [{ path: outsideFilePath, content: "Attempting escape" }];
            const result = await writeFilesTool.execute({ items: filesToWrite, encoding: 'utf8', append: false }, { data: mockStreamData, toolCallId: 'write-test7' } as any); // Use items

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const fileResult = result.results[0];
            assert.strictEqual(fileResult.success, false, 'File write success should be false');
            assert.ok(fileResult.error?.includes('outside the workspace'), `Error message "${fileResult.error}" should indicate outside workspace`);
        });

         test('Should handle invalid content for encoding', async () => {
            const filesToWrite = [{ path: '.test_temp_fs/invalidHex.txt', content: "This is not hex" }];
            const result = await writeFilesTool.execute({ items: filesToWrite, encoding: 'hex', append: false }, { data: mockStreamData, toolCallId: 'write-test8' } as any); // Use items

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const fileResult = result.results[0];
            assert.strictEqual(fileResult.success, false, 'File write success should be false');
            assert.ok(fileResult.error?.includes('Invalid content for encoding'), `Error message "${fileResult.error}" should indicate invalid content/encoding`);
        });

         test('Should handle mix of successful and failed writes', async () => {
             const filesToWrite = [
                { path: '.test_temp_fs/mixSuccess.txt', content: "Mix success" }, // Should succeed
                { path: outsideFilePath, content: "Mix fail" } // Should fail
            ];
            const mixSuccessUri = vscode.Uri.joinPath(workspaceUri, '.test_temp_fs/mixSuccess.txt');

            const result = await writeFilesTool.execute({ items: filesToWrite, encoding: 'utf8', append: false }, { data: mockStreamData, toolCallId: 'write-test9' } as any); // Use items

            assert.ok(result.success, 'Overall success should be true (at least one succeeded)');
            assert.strictEqual(result.results.length, 2, 'Should have two results');

            const successResult = result.results.find(r => r.path === '.test_temp_fs/mixSuccess.txt');
            assert.ok(successResult, 'Success result not found');
            assert.ok(successResult.success, 'Success result should indicate success');
            await verifyFileContent(mixSuccessUri, "Mix success");


            const failResult = result.results.find(r => r.path === outsideFilePath);
            assert.ok(failResult, 'Fail result not found');
            assert.strictEqual(failResult.success, false, 'Fail result should indicate failure');
            assert.ok(failResult.error?.includes('outside the workspace'), 'Fail result error message mismatch');
        });

    });

    suite('listFilesTool Tests', () => {
        // Helper to normalize paths for comparison
        const normalize = (p: string) => p.replace(/\\/g, '/');

        test('Should list files and directories non-recursively in test root', async () => {
            const result = await listFilesTool.execute({ paths: [listRootDir], recursive: false, maxDepth: 5, includeStats: true }, { data: mockStreamData, toolCallId: 'list-test1' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results, 'Results object should exist');
            assert.ok(listRootDir in result.results, `Key ${listRootDir} should exist in results`);
            const listRootDirResult = result.results[listRootDir];
            assert.ok(listRootDirResult, 'Results for listRootDir should exist');
            assert.ok(listRootDirResult.success, `Listing for ${listRootDir} should succeed`);
            assert.ok(listRootDirResult.entries, `Entries for ${listRootDir} should exist`);
            const entries = listRootDirResult.entries!; // Assert non-null
            const names = entries.map((e: { name: string }) => normalize(e.name)).sort(); // Add type

            // Expected files/dirs directly under .test_temp_fs created in setup/writeFile tests
            const expectedDirectChildren = [
                normalize(testFile1Path),
                normalize(testFile2Path),
                normalize(writeFileNewPath), // Created in writeFile tests
                normalize(writeFileAppendPath),
                normalize(writeBinaryPath), // Created/overwritten in writeFile tests
                normalize(listSubDir1),
                normalize(listSubDir2),
                normalize('.test_temp_fs/multiWriteNew.txt'), // Created in writeFile tests
                normalize('.test_temp_fs/mixSuccess.txt'), // Created in writeFile tests
                // '.test_temp_fs/invalidHex.txt' might exist if that test ran and failed partially,
                // but we won't assert its presence strictly here.
            ].sort();

             // Check if all expected children are present (allow for potential extra files like invalidHex)
             expectedDirectChildren.forEach((expected: string) => {
                 assert.ok(names.includes(expected), `Expected entry ${expected} not found in non-recursive list`);
             });

            // Verify types (spot check)
            const subDir1Entry = entries.find((e: { name: string }) => normalize(e.name) === normalize(listSubDir1));
            assert.ok(subDir1Entry, 'subDir1 entry not found');
            assert.strictEqual(subDir1Entry.type, 'directory', 'subDir1 should be a directory');

            const testFile1Entry = entries.find((e: { name: string }) => normalize(e.name) === normalize(testFile1Path));
            assert.ok(testFile1Entry, 'testFile1.txt entry not found');
            assert.strictEqual(testFile1Entry.type, 'file', 'testFile1.txt should be a file');
            assert.ok(typeof testFile1Entry.size === 'number', 'testFile1.txt should have a size');
            assert.ok(typeof testFile1Entry.mtime === 'number', 'testFile1.txt should have an mtime');

            // Ensure no recursive files are present
            assert.strictEqual(names.find((n: string) => n.includes('subFile1.txt')), undefined, 'Recursive file subFile1.txt should not be listed');
            assert.strictEqual(names.find((n: string) => n.includes('subSubFile.txt')), undefined, 'Recursive file subSubFile.txt should not be listed');
        });

         test('Should list files recursively in test root (default depth)', async () => {
            const result = await listFilesTool.execute({ paths: [listRootDir], recursive: true, maxDepth: 5, includeStats: true }, { data: mockStreamData, toolCallId: 'list-test2' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results, 'Results object should exist');
            assert.ok(listRootDir in result.results, `Key ${listRootDir} should exist in results`);
            const listRootDirResult = result.results[listRootDir];
            assert.ok(listRootDirResult, 'Results for listRootDir should exist');
            assert.ok(listRootDirResult.success, `Listing for ${listRootDir} should succeed`);
            assert.ok(listRootDirResult.entries, `Entries for ${listRootDir} should exist`);
            const entries = listRootDirResult.entries!; // Assert non-null
            const names = entries.map((e: { name: string }) => normalize(e.name)).sort(); // Add type

            // Check for presence of specific recursive files/dirs
            assert.ok(names.includes(normalize(listSubDir1)), 'subDir1 should be listed');
            assert.ok(names.includes(normalize(listSubFile1)), 'subFile1.txt should be listed');
            assert.ok(names.includes(normalize(listSubDir2)), 'subDir2 should be listed');
            assert.ok(names.includes(normalize(listSubSubDir)), 'subSubDir should be listed');
            assert.ok(names.includes(normalize(listSubSubFile)), 'subSubFile.txt should be listed');

             // Spot check type
             const subSubFileEntry = entries.find((e: { name: string }) => normalize(e.name) === normalize(listSubSubFile));
             assert.ok(subSubFileEntry, 'subSubFile.txt entry not found');
             assert.strictEqual(subSubFileEntry.type, 'file', 'subSubFile.txt should be a file');
        });

        test('Should list files recursively with limited depth', async () => {
            // Depth 1: Only list items directly inside .test_temp_fs
            // Depth 2: List items inside .test_temp_fs AND inside subDir1, subDir2
            // Depth 3: List items inside .test_temp_fs, subDir1, subDir2, AND subSubDir
            const result = await listFilesTool.execute({ paths: [listRootDir], recursive: true, maxDepth: 2, includeStats: true }, { data: mockStreamData, toolCallId: 'list-test3' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results, 'Results object should exist');
            assert.ok(listRootDir in result.results, `Key ${listRootDir} should exist in results`);
            const listRootDirResult = result.results[listRootDir];
            assert.ok(listRootDirResult, 'Results for listRootDir should exist');
            assert.ok(listRootDirResult.success, `Listing for ${listRootDir} should succeed`);
            assert.ok(listRootDirResult.entries, `Entries for ${listRootDir} should exist`);
            const entries = listRootDirResult.entries!; // Assert non-null
            const names = entries.map((e: { name: string }) => normalize(e.name)).sort(); // Add type

            // Should include items at depth 1 & 2
            assert.ok(names.includes(normalize(listSubDir1)), 'subDir1 should be listed (depth 1)');
            assert.ok(names.includes(normalize(listSubFile1)), 'subFile1.txt should be listed (depth 2)');
            assert.ok(names.includes(normalize(listSubDir2)), 'subDir2 should be listed (depth 1)');
            assert.ok(names.includes(normalize(listSubSubDir)), 'subSubDir should be listed (depth 2)');


            // Should NOT include items at depth 3
            assert.strictEqual(names.find((n: string) => normalize(n) === normalize(listSubSubFile)), undefined, 'subSubFile.txt (depth 3) should NOT be listed with maxDepth 2');
        });

        test('Should handle listing a non-existent directory', async () => {
            const result = await listFilesTool.execute({ paths: [listNonExistentDir], recursive: false, maxDepth: 5, includeStats: true }, { data: mockStreamData, toolCallId: 'list-test4' } as any);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.ok(result.results, 'Results object should exist');
            assert.ok(listNonExistentDir in result.results, `Key ${listNonExistentDir} should exist in results`);
            const nonExistentResult = result.results[listNonExistentDir];
            assert.ok(nonExistentResult, 'Results for nonExistentDir should exist');
            assert.strictEqual(nonExistentResult.success, false, `Listing for ${listNonExistentDir} should fail`);
            assert.ok(nonExistentResult.error?.includes('Directory not found'), `Error message "${nonExistentResult.error}" should indicate directory not found`);
            assert.strictEqual(nonExistentResult.entries, undefined, 'Entries should be undefined on error');
        });

        test('Should prevent listing directories outside the workspace', async () => {
             const result = await listFilesTool.execute({ paths: [outsideFilePath], recursive: false, maxDepth: 5, includeStats: true }, { data: mockStreamData, toolCallId: 'list-test5' } as any);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.ok(result.results, 'Results object should exist');
            assert.ok(outsideFilePath in result.results, `Key ${outsideFilePath} should exist in results`);
            const outsideResult = result.results[outsideFilePath];
            assert.ok(outsideResult, 'Results for outsideFilePath should exist');
            assert.strictEqual(outsideResult.success, false, `Listing for ${outsideFilePath} should fail`);
            assert.ok(outsideResult.error?.includes('outside the workspace'), `Error message "${outsideResult.error}" should indicate outside workspace`);
        });
    });

    suite('createFolderTool Tests', () => {
        // Helper to check if a directory exists
        async function verifyDirectoryExists(uri: vscode.Uri) {
            try {
                const stat = await vscode.workspace.fs.stat(uri);
                assert.strictEqual(stat.type, vscode.FileType.Directory, `Path ${uri.fsPath} should be a directory`);
            } catch (error) {
                 assert.fail(`Directory ${uri.fsPath} not found or error stating: ${error}`);
            }
        }

        test('Should create a single new folder', async () => {
            const result = await createFolderTool.execute({ folderPaths: [createFolderPath1] }, mockToolExecutionOptions);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const folderResult = result.results[0];
            assert.strictEqual(folderResult.path, createFolderPath1);
            assert.ok(folderResult.success, 'Folder creation success should be true');
            assert.ok(folderResult.message?.includes('created successfully'), 'Success message mismatch');
            await verifyDirectoryExists(createFolderPath1Uri);
        });

        test('Should create nested folders', async () => {
            const result = await createFolderTool.execute({ folderPaths: [createFolderPath2] }, mockToolExecutionOptions);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'Folder creation success should be true');
            await verifyDirectoryExists(createFolderPath2Uri);
            // Also check the parent implicitly created
            await verifyDirectoryExists(vscode.Uri.joinPath(workspaceUri, '.test_temp_fs/newFolder2'));
        });

        test('Should handle creating multiple folders (new and nested)', async () => {
            const newFolder3 = '.test_temp_fs/newFolder3';
            const newFolder4Nested = '.test_temp_fs/newFolder4/nestedAgain';
            const newFolder3Uri = vscode.Uri.joinPath(workspaceUri, newFolder3);
            const newFolder4NestedUri = vscode.Uri.joinPath(workspaceUri, newFolder4Nested);

            const result = await createFolderTool.execute({ folderPaths: [newFolder3, newFolder4Nested] }, mockToolExecutionOptions);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 2, 'Should have two results');
            assert.ok(result.results.every(r => r.success), 'All individual creations should succeed');

            await verifyDirectoryExists(newFolder3Uri);
            await verifyDirectoryExists(newFolder4NestedUri);
        });

        test('Should report success if folder already exists', async () => {
            // listSubDir1 was created in suiteSetup
            await verifyDirectoryExists(listSubDir1Uri); // Ensure it exists first
            const result = await createFolderTool.execute({ folderPaths: [createFolderExistingPath] }, mockToolExecutionOptions);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'Result success should be true');
            assert.ok(result.results[0].message?.includes('already exists'), 'Message should indicate folder already exists');
        });

        test('Should fail if path exists but is a file', async () => {
            // testFile1Path points to a file created in suiteSetup
            const result = await createFolderTool.execute({ folderPaths: [createFolderFilePath] }, mockToolExecutionOptions);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const folderResult = result.results[0];
            assert.strictEqual(folderResult.success, false, 'Folder creation success should be false');
            assert.ok(folderResult.error?.includes('already exists but is not a directory'), `Error message "${folderResult.error}" mismatch`);
        });

        test('Should prevent creating folders outside the workspace', async () => {
            const result = await createFolderTool.execute({ folderPaths: [outsideFilePath] }, mockToolExecutionOptions);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const folderResult = result.results[0];
            assert.strictEqual(folderResult.success, false, 'Folder creation success should be false');
            assert.ok(folderResult.error?.includes('outside the workspace'), `Error message "${folderResult.error}" mismatch`);
        });

        test('Should handle mix of successful and failed creations', async () => {
            const mixNewFolder = '.test_temp_fs/mixNewFolder';
            const mixNewFolderUri = vscode.Uri.joinPath(workspaceUri, mixNewFolder);

            const result = await createFolderTool.execute({ folderPaths: [mixNewFolder, createFolderFilePath] }, mockToolExecutionOptions); // One new, one file conflict

            assert.ok(result.success, 'Overall success should be true (at least one succeeded)');
            assert.strictEqual(result.results.length, 2, 'Should have two results');

            const successResult = result.results.find(r => r.path === mixNewFolder);
            assert.ok(successResult, 'Success result not found');
            assert.ok(successResult.success, 'Success result should indicate success');
            await verifyDirectoryExists(mixNewFolderUri);

            const failResult = result.results.find(r => r.path === createFolderFilePath);
            assert.ok(failResult, 'Fail result not found');
            assert.strictEqual(failResult.success, false, 'Fail result should indicate failure');
            assert.ok(failResult.error?.includes('already exists but is not a directory'), 'Fail result error message mismatch');
        });
    });

    suite('statItemsTool Tests', () => { // Renamed suite
        test('Should get stat for an existing file', async () => {
            const result = await statItemsTool.execute({ paths: [testFile1Path] }, mockToolExecutionOptions);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const statResult = result.results[0];
            assert.strictEqual(statResult.path, testFile1Path);
            assert.ok(statResult.success, 'Stat success should be true');
            assert.ok(statResult.stat, 'Stat object should exist');
            assert.strictEqual(statResult.stat.name, path.basename(testFile1Path));
            assert.strictEqual(statResult.stat.type, 'file');
            assert.strictEqual(statResult.stat.size, testContent1.length); // Assuming UTF8 size matches byte length
            assert.ok(typeof statResult.stat.mtime === 'number');
            assert.strictEqual(statResult.error, undefined);
        });

        test('Should get stat for an existing directory', async () => {
            const result = await statItemsTool.execute({ paths: [listSubDir1] }, mockToolExecutionOptions);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'Stat success should be true');
            const statInfo = result.results[0].stat;
            assert.ok(statInfo, 'Stat object should exist');
            assert.strictEqual(statInfo.name, path.basename(listSubDir1));
            assert.strictEqual(statInfo.type, 'directory');
            assert.strictEqual(statInfo.size, undefined, 'Directory size should be undefined'); // Directories usually don't report size this way
            assert.ok(typeof statInfo.mtime === 'number');
        });

        test('Should get stats for multiple existing items (file and directory)', async () => {
            const result = await statItemsTool.execute({ paths: [testFile1Path, listSubDir1] }, mockToolExecutionOptions);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 2, 'Should have two results');
            assert.ok(result.results.every((r: { success: boolean }) => r.success), 'All individual stats should succeed');

            const fileStat = result.results.find((r: { path: string }) => r.path === testFile1Path)?.stat;
            assert.ok(fileStat, 'File stat not found');
            assert.strictEqual(fileStat.type, 'file');
            assert.strictEqual(fileStat.size, testContent1.length);

            const dirStat = result.results.find((r: { path: string }) => r.path === listSubDir1)?.stat;
            assert.ok(dirStat, 'Directory stat not found');
            assert.strictEqual(dirStat.type, 'directory');
        });

        test('Should handle non-existent path', async () => {
            const result = await statItemsTool.execute({ paths: [nonExistentFilePath] }, mockToolExecutionOptions);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const statResult = result.results[0];
            assert.strictEqual(statResult.success, false, 'Stat success should be false');
            assert.ok(statResult.error?.includes('File or directory not found'), `Error message "${statResult.error}" mismatch`);
            assert.strictEqual(statResult.stat, undefined);
        });

        test('Should handle mix of existing and non-existent paths', async () => {
            const result = await statItemsTool.execute({ paths: [testFile1Path, nonExistentFilePath] }, mockToolExecutionOptions);

            assert.ok(result.success, 'Overall success should be true (at least one succeeded)');
            assert.strictEqual(result.results.length, 2, 'Should have two results');

            const successResult = result.results.find((r: { path: string }) => r.path === testFile1Path);
            assert.ok(successResult, 'Success result not found');
            assert.ok(successResult.success, 'Success result should indicate success');
            assert.ok(successResult.stat, 'Success result stat should exist');
            assert.strictEqual(successResult.stat.type, 'file');

            const failResult = result.results.find((r: { path: string }) => r.path === nonExistentFilePath);
            assert.ok(failResult, 'Fail result not found');
            assert.strictEqual(failResult.success, false, 'Fail result should indicate failure');
            assert.ok(failResult.error?.includes('File or directory not found'), 'Fail result error message mismatch');
            assert.strictEqual(failResult.stat, undefined);
        });

        test('Should prevent getting stat for paths outside the workspace', async () => {
            const result = await statItemsTool.execute({ paths: [outsideFilePath] }, mockToolExecutionOptions);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const statResult = result.results[0];
            assert.strictEqual(statResult.success, false, 'Stat success should be false');
            assert.ok(statResult.error?.includes('outside the workspace'), `Error message "${statResult.error}" mismatch`);
        });
    });

    suite('deleteFileTool Tests', () => {
         // Re-create files before each delete test as they get deleted
        setup(async () => {
            await createFile(deleteFilePath1Uri, deleteFileContent);
            await createFile(deleteFilePath2Uri, deleteFileContent);
            await createFile(deleteFilePathPermUri, deleteFileContent);
        });

        test('Should delete a single existing file (useTrash=true)', async () => {
            assert.ok(await verifyItemExists(deleteFilePath1Uri), 'File should exist before deletion');
            const result = await deleteFileTool.execute({ filePaths: [deleteFilePath1], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-test1' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const deleteResult = result.results[0];
            assert.strictEqual(deleteResult.path, deleteFilePath1);
            assert.ok(deleteResult.success, 'Delete success should be true');
            assert.ok(deleteResult.message?.includes('moved to trash'), 'Success message mismatch');
            assert.strictEqual(await verifyItemExists(deleteFilePath1Uri), false, 'File should not exist after deletion');
        });

        test('Should delete a single existing file permanently (useTrash=false)', async () => {
             assert.ok(await verifyItemExists(deleteFilePathPermUri), 'File should exist before deletion');
            const result = await deleteFileTool.execute({ filePaths: [deleteFilePathPerm], useTrash: false }, { data: mockStreamData, toolCallId: 'delete-test2' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'Delete success should be true');
            assert.ok(result.results[0].message?.includes('deleted permanently'), 'Success message mismatch');
            assert.strictEqual(await verifyItemExists(deleteFilePathPermUri), false, 'File should not exist after deletion');
        });

        test('Should delete multiple existing files', async () => {
            assert.ok(await verifyItemExists(deleteFilePath1Uri), 'File 1 should exist before deletion');
            assert.ok(await verifyItemExists(deleteFilePath2Uri), 'File 2 should exist before deletion');
            const result = await deleteFileTool.execute({ filePaths: [deleteFilePath1, deleteFilePath2], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-test3' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 2, 'Should have two results');
            assert.ok(result.results.every((r: { success: boolean }) => r.success), 'All individual deletes should succeed');
            assert.strictEqual(await verifyItemExists(deleteFilePath1Uri), false, 'File 1 should not exist after deletion');
            assert.strictEqual(await verifyItemExists(deleteFilePath2Uri), false, 'File 2 should not exist after deletion');
        });

        test('Should report success for non-existent file', async () => {
            assert.strictEqual(await verifyItemExists(vscode.Uri.joinPath(workspaceUri, deleteNonExistentPath)), false, 'File should not exist before test');
            const result = await deleteFileTool.execute({ filePaths: [deleteNonExistentPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-test4' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const deleteResult = result.results[0];
            assert.ok(deleteResult.success, 'Delete success should be true');
            assert.ok(deleteResult.message?.includes('does not exist'), 'Success message mismatch');
        });

        test('Should fail to delete a directory', async () => {
            assert.ok(await verifyItemExists(listSubDir1Uri), 'Directory should exist before test');
            const result = await deleteFileTool.execute({ filePaths: [deleteDirPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-test5' } as any);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const deleteResult = result.results[0];
            assert.strictEqual(deleteResult.success, false, 'Delete success should be false');
            assert.ok(deleteResult.error?.includes('not a file'), `Error message "${deleteResult.error}" mismatch`);
            assert.ok(await verifyItemExists(listSubDir1Uri), 'Directory should still exist after failed deletion');
        });

        test('Should prevent deleting files outside the workspace', async () => {
            const result = await deleteFileTool.execute({ filePaths: [outsideFilePath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-test6' } as any);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const deleteResult = result.results[0];
            assert.strictEqual(deleteResult.success, false, 'Delete success should be false');
            assert.ok(deleteResult.error?.includes('outside the workspace'), `Error message "${deleteResult.error}" mismatch`);
        });

         test('Should handle mix of successful and failed deletions', async () => {
             assert.ok(await verifyItemExists(deleteFilePath1Uri), 'File 1 should exist before deletion');
             assert.ok(await verifyItemExists(listSubDir1Uri), 'Directory should exist before deletion');
             const result = await deleteFileTool.execute({ filePaths: [deleteFilePath1, deleteDirPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-test7' } as any);

             assert.ok(result.success, 'Overall success should be true (at least one succeeded)');
             assert.strictEqual(result.results.length, 2, 'Should have two results');

             const successResult = result.results.find((r: { path: string }) => r.path === deleteFilePath1);
             assert.ok(successResult, 'Success result not found');
             assert.ok(successResult.success, 'Success result should indicate success');
             assert.strictEqual(await verifyItemExists(deleteFilePath1Uri), false, 'File 1 should not exist after deletion');

             const failResult = result.results.find((r: { path: string }) => r.path === deleteDirPath);
             assert.ok(failResult, 'Fail result not found');
             assert.strictEqual(failResult.success, false, 'Fail result should indicate failure');
             assert.ok(failResult.error?.includes('not a file'), 'Fail result error message mismatch');
             assert.ok(await verifyItemExists(listSubDir1Uri), 'Directory should still exist after failed deletion');
         });
     
         suite('deleteFolderTool Tests', () => {
             // Re-create folders before each delete test
             setup(async () => {
                 // Clean up potential leftovers first
                 await deleteItem(deleteFolderPath1Uri);
                 await deleteItem(deleteFolderWithContentUri);
                 await deleteItem(deleteFolderPermUri);
                 // Create fresh folders for testing
                 await vscode.workspace.fs.createDirectory(deleteFolderPath1Uri); // Empty folder
                 await vscode.workspace.fs.createDirectory(deleteFolderWithContentUri); // Folder with content
                 await createFile(deleteFolderWithContentFileUri, deleteFolderFileContent);
                 await vscode.workspace.fs.createDirectory(deleteFolderPermUri); // Folder for permanent delete test
             });
     
             test('Should delete a single existing empty folder (useTrash=true)', async () => {
                 assert.ok(await verifyItemExists(deleteFolderPath1Uri), 'Folder should exist before deletion');
                 const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderPath1], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test1' } as any);
     
                 assert.ok(result.success, 'Overall success should be true');
                 assert.strictEqual(result.results.length, 1, 'Should have one result');
                 const deleteResult = result.results[0];
                 assert.strictEqual(deleteResult.path, deleteFolderPath1);
                 assert.ok(deleteResult.success, 'Delete success should be true');
                 assert.ok(deleteResult.message?.includes('moved to trash'), 'Success message mismatch');
                 assert.strictEqual(await verifyItemExists(deleteFolderPath1Uri), false, 'Folder should not exist after deletion');
             });
     
              test('Should delete a folder with content recursively (useTrash=true)', async () => {
                 assert.ok(await verifyItemExists(deleteFolderWithContentUri), 'Folder should exist before deletion');
                 assert.ok(await verifyItemExists(deleteFolderWithContentFileUri), 'File inside folder should exist before deletion');
                 const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderWithContentPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test2' } as any);
     
                 assert.ok(result.success, 'Overall success should be true');
                 assert.ok(result.results[0].success, 'Delete success should be true');
                 assert.strictEqual(await verifyItemExists(deleteFolderWithContentUri), false, 'Folder should not exist after deletion');
                 assert.strictEqual(await verifyItemExists(deleteFolderWithContentFileUri), false, 'File inside folder should not exist after deletion');
             });
     
             test('Should delete a folder permanently (useTrash=false)', async () => {
                  assert.ok(await verifyItemExists(deleteFolderPermUri), 'Folder should exist before deletion');
                 const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderPermPath], useTrash: false }, { data: mockStreamData, toolCallId: 'delete-folder-test3' } as any);
     
                 assert.ok(result.success, 'Overall success should be true');
                 assert.ok(result.results[0].success, 'Delete success should be true');
                 assert.ok(result.results[0].message?.includes('deleted permanently'), 'Success message mismatch');
                 assert.strictEqual(await verifyItemExists(deleteFolderPermUri), false, 'Folder should not exist after deletion');
             });
     
             test('Should delete multiple folders', async () => {
                 assert.ok(await verifyItemExists(deleteFolderPath1Uri), 'Folder 1 should exist before deletion');
                 assert.ok(await verifyItemExists(deleteFolderWithContentUri), 'Folder 2 should exist before deletion');
                 const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderPath1, deleteFolderWithContentPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test4' } as any);
     
                 assert.ok(result.success, 'Overall success should be true');
                 assert.strictEqual(result.results.length, 2, 'Should have two results');
                 assert.ok(result.results.every((r: { success: boolean }) => r.success), 'All individual deletes should succeed');
                 assert.strictEqual(await verifyItemExists(deleteFolderPath1Uri), false, 'Folder 1 should not exist after deletion');
                 assert.strictEqual(await verifyItemExists(deleteFolderWithContentUri), false, 'Folder 2 should not exist after deletion');
             });
     
             test('Should report success for non-existent folder', async () => {
                 assert.strictEqual(await verifyItemExists(vscode.Uri.joinPath(workspaceUri, deleteFolderNonExistentPath)), false, 'Folder should not exist before test');
                 const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderNonExistentPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test5' } as any);
     
                 assert.ok(result.success, 'Overall success should be true');
                 assert.strictEqual(result.results.length, 1, 'Should have one result');
                 const deleteResult = result.results[0];
                 assert.ok(deleteResult.success, 'Delete success should be true');
                 assert.ok(deleteResult.message?.includes('does not exist'), 'Success message mismatch');
             });
     
             test('Should fail to delete a path that is a file', async () => {
                 assert.ok(await verifyItemExists(testFile1Uri), 'File should exist before test');
                 const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderFilePath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test6' } as any);
     
                 assert.strictEqual(result.success, false, 'Overall success should be false');
                 assert.strictEqual(result.results.length, 1, 'Should have one result');
                 const deleteResult = result.results[0];
                 assert.strictEqual(deleteResult.success, false, 'Delete success should be false');
                 assert.ok(deleteResult.error?.includes('not a directory'), `Error message "${deleteResult.error}" mismatch`);
                 assert.ok(await verifyItemExists(testFile1Uri), 'File should still exist after failed deletion');
             });
     
              test('Should prevent deleting the workspace root', async () => {
                 const result = await deleteFolderTool.execute({ folderPaths: ['.'], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test7' } as any);
                 assert.strictEqual(result.success, false, 'Overall success should be false');
                 assert.ok(result.results[0].error?.includes('workspace root directory is not allowed'), `Error message "${result.results[0].error}" mismatch`);
     
                  const result2 = await deleteFolderTool.execute({ folderPaths: [''], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test8' } as any);
                  assert.strictEqual(result2.success, false, 'Overall success should be false');
                  assert.ok(result2.results[0].error?.includes('workspace root directory is not allowed'), `Error message "${result2.results[0].error}" mismatch`);
             });
     
             test('Should prevent deleting folders outside the workspace', async () => {
                 const result = await deleteFolderTool.execute({ folderPaths: [outsideFilePath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test9' } as any);
     
                 assert.strictEqual(result.success, false, 'Overall success should be false');
                 assert.strictEqual(result.results.length, 1, 'Should have one result');
                 const deleteResult = result.results[0];
                 assert.strictEqual(deleteResult.success, false, 'Delete success should be false');
                 assert.ok(deleteResult.error?.includes('outside the workspace'), `Error message "${deleteResult.error}" mismatch`);
             });
     
              test('Should handle mix of successful and failed deletions', async () => {
                  assert.ok(await verifyItemExists(deleteFolderPath1Uri), 'Folder 1 should exist before deletion');
                  assert.ok(await verifyItemExists(testFile1Uri), 'File should exist before deletion');
                  const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderPath1, deleteFolderFilePath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test10' } as any);
     
                  assert.ok(result.success, 'Overall success should be true (at least one succeeded)');
                  assert.strictEqual(result.results.length, 2, 'Should have two results');
     
                  const successResult = result.results.find((r: { path: string }) => r.path === deleteFolderPath1);
                  assert.ok(successResult, 'Success result not found');
                  assert.ok(successResult.success, 'Success result should indicate success');
                  assert.strictEqual(await verifyItemExists(deleteFolderPath1Uri), false, 'Folder 1 should not exist after deletion');
     
                  const failResult = result.results.find((r: { path: string }) => r.path === deleteFolderFilePath);
                  assert.ok(failResult, 'Fail result not found');
                  assert.strictEqual(failResult.success, false, 'Fail result should indicate failure');
                  assert.ok(failResult.error?.includes('not a directory'), 'Fail result error message mismatch');
                  assert.ok(await verifyItemExists(testFile1Uri), 'File should still exist after failed deletion');
              });
         });
     });

    suite('deleteFolderTool Tests', () => {
        // Use existing verifyItemExists helper

        // Re-create folders before each delete test
        setup(async () => {
            // Clean up potential leftovers first
            await deleteItem(deleteFolderPath1Uri);
            await deleteItem(deleteFolderWithContentUri);
            await deleteItem(deleteFolderPermUri);
            // Create fresh folders for testing
            await vscode.workspace.fs.createDirectory(deleteFolderPath1Uri); // Empty folder
            await vscode.workspace.fs.createDirectory(deleteFolderWithContentUri); // Folder with content
            await createFile(deleteFolderWithContentFileUri, deleteFolderFileContent);
            await vscode.workspace.fs.createDirectory(deleteFolderPermUri); // Folder for permanent delete test
        });

        test('Should delete a single existing empty folder (useTrash=true)', async () => {
            assert.ok(await verifyItemExists(deleteFolderPath1Uri), 'Folder should exist before deletion');
            const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderPath1], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test1' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const deleteResult = result.results[0];
            assert.strictEqual(deleteResult.path, deleteFolderPath1);
            assert.ok(deleteResult.success, 'Delete success should be true');
            assert.ok(deleteResult.message?.includes('moved to trash'), 'Success message mismatch');
            assert.strictEqual(await verifyItemExists(deleteFolderPath1Uri), false, 'Folder should not exist after deletion');
        });

         test('Should delete a folder with content recursively (useTrash=true)', async () => {
            assert.ok(await verifyItemExists(deleteFolderWithContentUri), 'Folder should exist before deletion');
            assert.ok(await verifyItemExists(deleteFolderWithContentFileUri), 'File inside folder should exist before deletion');
            const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderWithContentPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test2' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'Delete success should be true');
            assert.strictEqual(await verifyItemExists(deleteFolderWithContentUri), false, 'Folder should not exist after deletion');
            assert.strictEqual(await verifyItemExists(deleteFolderWithContentFileUri), false, 'File inside folder should not exist after deletion');
        });

        test('Should delete a folder permanently (useTrash=false)', async () => {
             assert.ok(await verifyItemExists(deleteFolderPermUri), 'Folder should exist before deletion');
            const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderPermPath], useTrash: false }, { data: mockStreamData, toolCallId: 'delete-folder-test3' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.ok(result.results[0].success, 'Delete success should be true');
            assert.ok(result.results[0].message?.includes('deleted permanently'), 'Success message mismatch');
            assert.strictEqual(await verifyItemExists(deleteFolderPermUri), false, 'Folder should not exist after deletion');
        });

        test('Should delete multiple folders', async () => {
            assert.ok(await verifyItemExists(deleteFolderPath1Uri), 'Folder 1 should exist before deletion');
            assert.ok(await verifyItemExists(deleteFolderWithContentUri), 'Folder 2 should exist before deletion');
            const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderPath1, deleteFolderWithContentPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test4' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 2, 'Should have two results');
            assert.ok(result.results.every((r: { success: boolean }) => r.success), 'All individual deletes should succeed');
            assert.strictEqual(await verifyItemExists(deleteFolderPath1Uri), false, 'Folder 1 should not exist after deletion');
            assert.strictEqual(await verifyItemExists(deleteFolderWithContentUri), false, 'Folder 2 should not exist after deletion');
        });

        test('Should report success for non-existent folder', async () => {
            assert.strictEqual(await verifyItemExists(vscode.Uri.joinPath(workspaceUri, deleteFolderNonExistentPath)), false, 'Folder should not exist before test');
            const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderNonExistentPath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test5' } as any);

            assert.ok(result.success, 'Overall success should be true');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const deleteResult = result.results[0];
            assert.ok(deleteResult.success, 'Delete success should be true');
            assert.ok(deleteResult.message?.includes('does not exist'), 'Success message mismatch');
        });

        test('Should fail to delete a path that is a file', async () => {
            assert.ok(await verifyItemExists(testFile1Uri), 'File should exist before test');
            const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderFilePath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test6' } as any);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const deleteResult = result.results[0];
            assert.strictEqual(deleteResult.success, false, 'Delete success should be false');
            assert.ok(deleteResult.error?.includes('not a directory'), `Error message "${deleteResult.error}" mismatch`);
            assert.ok(await verifyItemExists(testFile1Uri), 'File should still exist after failed deletion');
        });

         test('Should prevent deleting the workspace root', async () => {
            const result = await deleteFolderTool.execute({ folderPaths: ['.'], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test7' } as any);
            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.ok(result.results[0].error?.includes('workspace root directory is not allowed'), `Error message "${result.results[0].error}" mismatch`);

             const result2 = await deleteFolderTool.execute({ folderPaths: [''], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test8' } as any);
             assert.strictEqual(result2.success, false, 'Overall success should be false');
             assert.ok(result2.results[0].error?.includes('workspace root directory is not allowed'), `Error message "${result2.results[0].error}" mismatch`);
        });

        test('Should prevent deleting folders outside the workspace', async () => {
            const result = await deleteFolderTool.execute({ folderPaths: [outsideFilePath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test9' } as any);

            assert.strictEqual(result.success, false, 'Overall success should be false');
            assert.strictEqual(result.results.length, 1, 'Should have one result');
            const deleteResult = result.results[0];
            assert.strictEqual(deleteResult.success, false, 'Delete success should be false');
            assert.ok(deleteResult.error?.includes('outside the workspace'), `Error message "${deleteResult.error}" mismatch`);
        });

         test('Should handle mix of successful and failed deletions', async () => {
             assert.ok(await verifyItemExists(deleteFolderPath1Uri), 'Folder 1 should exist before deletion');
             assert.ok(await verifyItemExists(testFile1Uri), 'File should exist before deletion');
             const result = await deleteFolderTool.execute({ folderPaths: [deleteFolderPath1, deleteFolderFilePath], useTrash: true }, { data: mockStreamData, toolCallId: 'delete-folder-test10' } as any);

             assert.ok(result.success, 'Overall success should be true (at least one succeeded)');
             assert.strictEqual(result.results.length, 2, 'Should have two results');

             const successResult = result.results.find((r: { path: string }) => r.path === deleteFolderPath1);
             assert.ok(successResult, 'Success result not found');
             assert.ok(successResult.success, 'Success result should indicate success');
             assert.strictEqual(await verifyItemExists(deleteFolderPath1Uri), false, 'Folder 1 should not exist after deletion');

             const failResult = result.results.find((r: { path: string }) => r.path === deleteFolderFilePath);
             assert.ok(failResult, 'Fail result not found');
             assert.strictEqual(failResult.success, false, 'Fail result should indicate failure');
             assert.ok(failResult.error?.includes('not a directory'), 'Fail result error message mismatch');
             assert.ok(await verifyItemExists(testFile1Uri), 'File should still exist after failed deletion');
         });
    });
});