    import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

export class UpdateLastLocationHandler implements RequestHandler {
    public readonly requestType = 'updateLastLocation'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const location = payload?.location;
        if (typeof location === 'string') {
            // console.log(`[UpdateLastLocationHandler] Received location update: ${location}`);
            await context.historyManager.setLastLocation(location);

            // Check if the location matches the chat route pattern
            const chatRouteMatch = location.match(/^\/chat\/([a-zA-Z0-9_-]+)$/);
            if (chatRouteMatch && chatRouteMatch[1]) {
                const chatId = chatRouteMatch[1];
                console.log(`[UpdateLastLocationHandler] Location matches chat route, setting last active chat ID to: ${chatId}`);
                await context.historyManager.setLastActiveChatId(chatId);
            }
            // If it doesn't match a chat route, we don't necessarily clear the last active ID,
            // as the user might just be temporarily visiting settings or the chat list.

            return { success: true }; // Return success
        } else {
            console.warn('[UpdateLastLocationHandler] Received invalid payload for location update:', payload);
            throw new Error("Invalid payload for updateLastLocation request."); // Throw error
        }
    }
}