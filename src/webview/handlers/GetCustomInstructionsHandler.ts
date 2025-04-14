import { RequestHandler, HandlerContext } from './RequestHandler';

export class GetCustomInstructionsHandler implements RequestHandler {
    public readonly requestType = 'getCustomInstructions';

    public async handle(payload: any, context: HandlerContext): Promise<any> {
        console.log(`[GetCustomInstructionsHandler] Handling ${this.requestType} request...`);
        try {
            const instructions = await context.aiService.getCombinedCustomInstructions();
            return instructions; // Return the combined instructions object
        } catch (error: any) {
            console.error(`[GetCustomInstructionsHandler] Error fetching custom instructions:`, error);
            throw new Error(`Failed to get custom instructions: ${error.message}`);
        }
    }
}