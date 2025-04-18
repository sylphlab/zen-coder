// src/webview/handlers/CreateAssistantHandler.ts
import { Assistant, CreateAssistantRequest, CreateAssistantResponse } from '../../common/types';
import { AssistantManager } from '../../session/AssistantManager';
import { RequestHandler, HandlerContext } from './RequestHandler';

// Define the expected payload structure for a successful response
interface CreateAssistantSuccessPayload {
    assistant: Assistant;
}

export class CreateAssistantHandler implements RequestHandler<CreateAssistantRequest['payload'], CreateAssistantSuccessPayload> {
    public requestType = 'assistants/create';

    public async handle(payload: CreateAssistantRequest['payload'], context: HandlerContext): Promise<CreateAssistantSuccessPayload> {
        console.log('[CreateAssistantHandler] Handling assistants/create request...');

        const assistantManager = context.assistantManager;
        if (!assistantManager) {
            console.error('[CreateAssistantHandler] AssistantManager not found in context.');
            throw new Error('AssistantManager service is unavailable.');
        }

        // TODO: Add input validation for the payload using Zod or similar
        // if (!isValidNewAssistantPayload(payload)) {
        //     throw new Error('Invalid payload for creating assistant.');
        // }

        try {
            const newAssistant = await assistantManager.createAssistant(payload);
            if (!newAssistant) {
                 throw new Error('Failed to save the new assistant.');
            }
            console.log(`[CreateAssistantHandler] Assistant created with ID ${newAssistant.id}.`);
            return {
                assistant: newAssistant,
            };
        } catch (error: any) {
            console.error('[CreateAssistantHandler] Error creating assistant:', error);
            throw new Error(`Failed to create assistant: ${error.message}`);
        }
    }
}