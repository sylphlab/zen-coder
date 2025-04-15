import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

export class SetGlobalCustomInstructionsHandler implements RequestHandler {
    public readonly requestType = 'setGlobalCustomInstructions'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const instructions = payload?.instructions;
        if (typeof instructions !== 'string') {
            console.error('[SetGlobalCustomInstructionsHandler] Invalid payload. Expected instructions string.');
            throw new Error('Invalid payload for setGlobalCustomInstructions request.'); // Throw error
        }

        try {
            // Update the VS Code setting
            await vscode.workspace.getConfiguration('zencoder.customInstructions').update('global', instructions, vscode.ConfigurationTarget.Global);
            console.log('[SetGlobalCustomInstructionsHandler] Global custom instructions updated successfully.');
            vscode.window.showInformationMessage('Global custom instructions saved.');
            // Trigger notification via AiService method
            context.aiService.triggerCustomInstructionsNotification(); // Use public trigger method
            return { success: true }; // Return success
        } catch (error: any) {
            console.error('[SetGlobalCustomInstructionsHandler] Error updating global custom instructions setting:', error);
            vscode.window.showErrorMessage(`Failed to save global custom instructions: ${error.message}`);
            throw new Error(`Failed to save global custom instructions: ${error.message}`); // Throw error
        }
    }
}
