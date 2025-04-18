// src/webview/handlers/UpdateAssistantHandler.ts
import { Assistant, UpdateAssistantRequest, UpdateAssistantResponse } from '../../common/types';
import { AssistantManager } from '../../session/AssistantManager';
import { RequestHandler, HandlerContext } from './RequestHandler';

// Define the expected payload structure for a successful response
interface UpdateAssistantSuccessPayload {
    assistant: Assistant;
}

export class UpdateAssistantHandler implements RequestHandler<UpdateAssistantRequest['payload'], UpdateAssistantSuccessPayload> {
    public requestType = 'assistants/update';

    public async handle(payload: UpdateAssistantRequest['payload'], context: HandlerContext): Promise<UpdateAssistantSuccessPayload> {
        console.log('[UpdateAssistantHandler] Handling assistants/update request...');

        const assistantManager = context.assistantManager;
        if (!assistantManager) {
            console.error('[UpdateAssistantHandler] AssistantManager not found in context.');
            throw new Error('AssistantManager service is unavailable.');
        }

        // TODO: Add input validation for the payload using Zod or similar
        // if (!isValidUpdateAssistantPayload(payload)) {
        //     throw new Error('Invalid payload for updating assistant.');
        // }

        try {
            const updatedAssistant = await assistantManager.updateAssistant(payload);
            if (!updatedAssistant) {
                 // This could mean not found or save failed
                 throw new Error(`Failed to update assistant with ID ${payload.id}. It might not exist or save failed.`);
            }
            console.log(`[UpdateAssistantHandler] Assistant updated with ID ${updatedAssistant.id}.`);
            return {
                assistant: updatedAssistant,
            };
        } catch (error: any) {
            console.error('[UpdateAssistantHandler] Error updating assistant:', error);
            throw new Error(`Failed to update assistant: ${error.message}`);
        }
    }
}