// src/webview/handlers/DeleteAssistantHandler.ts
import { DeleteAssistantRequest, DeleteAssistantResponse } from '../../common/types';
import { AssistantManager } from '../../session/AssistantManager';
import { RequestHandler, HandlerContext } from './RequestHandler';

// Define the expected payload structure for a successful response (empty object)
interface DeleteAssistantSuccessPayload {}

export class DeleteAssistantHandler implements RequestHandler<DeleteAssistantRequest['payload'], DeleteAssistantSuccessPayload> {
    public requestType = 'assistants/delete';

    public async handle(payload: DeleteAssistantRequest['payload'], context: HandlerContext): Promise<DeleteAssistantSuccessPayload> {
        console.log('[DeleteAssistantHandler] Handling assistants/delete request...');

        const assistantManager = context.assistantManager;
        if (!assistantManager) {
            console.error('[DeleteAssistantHandler] AssistantManager not found in context.');
            throw new Error('AssistantManager service is unavailable.');
        }

        if (!payload || typeof payload.id !== 'string') {
             throw new Error('Invalid payload: Missing assistant ID.');
        }

        try {
            const deleted = await assistantManager.deleteAssistant(payload.id);
            if (!deleted) {
                 // This could mean not found or save failed
                 throw new Error(`Failed to delete assistant with ID ${payload.id}. It might not exist or save failed.`);
            }
            console.log(`[DeleteAssistantHandler] Assistant deleted with ID ${payload.id}.`);
            return {}; // Return empty object on success
        } catch (error: any) {
            console.error('[DeleteAssistantHandler] Error deleting assistant:', error);
            throw new Error(`Failed to delete assistant: ${error.message}`);
        }
    }
}