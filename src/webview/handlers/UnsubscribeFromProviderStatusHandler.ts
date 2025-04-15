import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path

export class UnsubscribeFromProviderStatusHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'unsubscribeFromProviderStatus'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log(`[${this.requestType}] Handling request...`);
        try {
            await context.aiService.removeSubscription('providerStatus'); // Use removeSubscription
            console.log(`[${this.requestType}] Webview unsubscribed from Provider status updates.`);
            return { success: true }; // Return success
        } catch (error: any) {
            console.error(`[${this.requestType}] Error setting subscription:`, error); // Use correct property name
            // Rethrow the error
            throw new Error(`Failed to unsubscribe from Provider status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
