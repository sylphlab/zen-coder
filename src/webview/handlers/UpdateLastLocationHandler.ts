    import { MessageHandler, HandlerContext } from './MessageHandler';

export class UpdateLastLocationHandler implements MessageHandler {
    public readonly messageType = 'updateLastLocation';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const location = message?.payload?.location;
        if (typeof location === 'string') {
            // console.log(`[UpdateLastLocationHandler] Received location update: ${location}`); // Optional logging
            await context.historyManager.setLastLocation(location);
        } else {
            console.warn('[UpdateLastLocationHandler] Received invalid payload for location update:', message.payload);
        }
    }
}