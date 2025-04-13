import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';

export class SetGlobalCustomInstructionsHandler implements MessageHandler {
    public readonly messageType = 'setGlobalCustomInstructions';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const instructions = message.payload?.instructions;
        if (typeof instructions !== 'string') {
            console.error('[SetGlobalCustomInstructionsHandler] Invalid payload. Expected instructions string.');
            vscode.window.showErrorMessage('Failed to save global instructions: Invalid data received.');
            return;
        }

        try {
            // Update the VS Code setting
            await vscode.workspace.getConfiguration('zencoder.customInstructions').update('global', instructions, vscode.ConfigurationTarget.Global);
            console.log('[SetGlobalCustomInstructionsHandler] Global custom instructions updated successfully.');
            vscode.window.showInformationMessage('Global custom instructions saved.'); // Provide feedback
        } catch (error: any) {
            console.error('[SetGlobalCustomInstructionsHandler] Error updating global custom instructions setting:', error);
            vscode.window.showErrorMessage(`Failed to save global custom instructions: ${error.message}`);
        }
    }
}