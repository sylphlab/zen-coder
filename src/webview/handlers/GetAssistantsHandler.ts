// src/webview/handlers/GetAssistantsHandler.ts
import { ListAssistantsResponse } from '../../common/types';
import { AssistantManager } from '../../session/AssistantManager'; // Import AssistantManager
import { RequestHandler, HandlerContext } from './RequestHandler';
import { Assistant } from '../../common/types'; // Import Assistant type

// Define the expected payload structure for a successful response
interface GetAssistantsSuccessPayload {
    assistants: Assistant[];
}

export class GetAssistantsHandler implements RequestHandler<void, GetAssistantsSuccessPayload> {
    public requestType = 'assistants/list'; // Match the request type from the store

    public async handle(payload: void, context: HandlerContext): Promise<GetAssistantsSuccessPayload> {
        console.log('[GetAssistantsHandler] Handling assistants/list request...');

        // Access AssistantManager from context (needs to be added to HandlerContext)
        const assistantManager = context.assistantManager;
        if (!assistantManager) {
            console.error('[GetAssistantsHandler] AssistantManager not found in context.');
            throw new Error('AssistantManager service is unavailable.');
        }

        try {
            const assistants = await assistantManager.getAllAssistants();
            console.log(`[GetAssistantsHandler] Returning ${assistants.length} assistants.`);
            // Return only the success payload part for requestData
            return {
                assistants: assistants,
            };
        } catch (error: any) {
            console.error('[GetAssistantsHandler] Error fetching assistants:', error);
            // Throw error so it's caught by the generic handler logic
            throw new Error(`Failed to fetch assistants: ${error.message}`);
        }
    }
}