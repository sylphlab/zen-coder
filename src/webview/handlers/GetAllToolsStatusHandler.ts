import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
import { AllToolsStatusInfo } from '../../common/types'; // Import the new response type
export class GetAllToolsStatusHandler implements RequestHandler {
    public readonly requestType = 'getAllToolsStatus'; // Change messageType to requestType

    // Return the tool status info or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<AllToolsStatusInfo> {
        console.log(`[${this.requestType}] Handling request...`);
        try {
            // Directly call the method on AiService to get combined status
            // Call the new method to get categorized and resolved status
            const allToolsStatusInfo: AllToolsStatusInfo = await context.aiService.getResolvedToolStatusInfo();

            console.log(`[${this.requestType}] Returning status for ${allToolsStatusInfo.reduce((count, cat) => count + cat.tools.length, 0)} tools across ${allToolsStatusInfo.length} categories.`);
            // Return the payload directly for requestData
            return allToolsStatusInfo;
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching tools status:`, error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to fetch tools status: ${error.message}`);
        }
    }
}