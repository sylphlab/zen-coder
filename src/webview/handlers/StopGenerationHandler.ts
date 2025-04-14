import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Use RequestHandler
import { AiService } from '../../ai/aiService'; // Adjust path as needed
// HandlerContext is imported from RequestHandler now

export class StopGenerationHandler implements RequestHandler { // Implement RequestHandler
    public readonly requestType = 'stopGeneration'; // Change to requestType

    // Constructor remains the same, AiService is injected elsewhere (likely in extension.ts)
    constructor(private aiService: AiService) {}

    // Update signature to use HandlerContext
    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log('[StopGenerationHandler] Received stopGeneration message.');
        try {
            // Access aiService via the injected instance (this.aiService)
            this.aiService.abortCurrentStream();
            // No need to send a response back to the webview,
            // the stream termination itself will signal the end.
        } catch (error: any) {
            console.error('[StopGenerationHandler] Error stopping generation:', error);
            // Optionally, inform the webview of the error using context.postMessage
            // context.postMessage({ type: 'showError', payload: { message: `Failed to stop generation: ${error.message}` } });
        }
    }
}