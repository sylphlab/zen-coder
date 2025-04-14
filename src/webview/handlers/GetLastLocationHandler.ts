import { RequestHandler, HandlerContext } from './RequestHandler';

export class GetLastLocationHandler implements RequestHandler {
    public readonly requestType = 'getLastLocation';

    public async handle(payload: any, context: HandlerContext): Promise<{ location: string | null }> {
        console.log(`[${this.requestType}] Handling request...`);
        try {
            const lastLocation = context.historyManager.getLastLocation();
            console.log(`[${this.requestType}] Returning last location: ${lastLocation}`);
            return { location: lastLocation };
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching last location:`, error);
            throw new Error(`Failed to fetch last location: ${error.message}`);
        }
    }
}