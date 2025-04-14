import { MessageHandler, HandlerContext } from './MessageHandler';
import { AllToolsStatusInfo } from '../../common/types'; // Import the new response type
export class GetAllToolsStatusHandler implements MessageHandler {
    public readonly messageType = 'getAllToolsStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            // Directly call the method on AiService to get combined status
            // Call the new method to get categorized and resolved status
            const allToolsStatusInfo: AllToolsStatusInfo = await context.aiService.getResolvedToolStatusInfo();

            // Respond with the tools status
            context.postMessage({
                type: 'responseData', // Use the generic response type
                payload: allToolsStatusInfo, // Send the new structure
                requestId: message.requestId // Include requestId for correlation
            });
            console.log(`[${this.messageType}] Sent status for ${allToolsStatusInfo.reduce((count, cat) => count + cat.tools.length, 0)} tools across ${allToolsStatusInfo.length} categories.`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error fetching tools status:`, error);
            // Send error response back to the webview
            context.postMessage({
                type: 'responseData', // Use the generic response type
                error: error.message || 'Failed to fetch tools status', // Use the error field
                requestId: message.requestId
            });
        }
    }
}