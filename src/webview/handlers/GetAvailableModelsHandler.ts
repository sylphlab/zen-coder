import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetAvailableModelsHandler implements MessageHandler {
    public readonly messageType = 'getAvailableModels';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[GetAvailableModelsHandler] Handling getAvailableModels message...");
        try {
            // Use ModelResolver
            const currentModels = await context.modelResolver.resolveAvailableModels();
            context.postMessage({ type: 'availableModels', payload: currentModels });
        } catch (error: any) {
            console.error("[GetAvailableModelsHandler] Error resolving models:", error);
            context.postMessage({ type: 'availableModels', payload: [] }); // Send empty on error
        }
    }
}