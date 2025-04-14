    import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

export class UpdateLastLocationHandler implements RequestHandler {
    public readonly requestType = 'updateLastLocation'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const location = payload?.location;
        if (typeof location === 'string') {
            // console.log(`[UpdateLastLocationHandler] Received location update: ${location}`);
            await context.historyManager.setLastLocation(location);
            return { success: true }; // Return success
        } else {
            console.warn('[UpdateLastLocationHandler] Received invalid payload for location update:', payload);
            throw new Error("Invalid payload for updateLastLocation request."); // Throw error
        }
    }
}