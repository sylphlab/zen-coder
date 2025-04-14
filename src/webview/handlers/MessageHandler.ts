import { HandlerContext } from './RequestHandler'; // Reuse the context definition
export { HandlerContext }; // Re-export for other handlers

/**
 * Interface for handling specific fire-and-forget messages from the webview.
 */
export interface MessageHandler {
    /**
     * The specific message type this handler is responsible for.
     */
    readonly messageType: string;

    /**
     * Handles an incoming message. Does not return a response to the webview.
     * @param message The full message object received from the webview.
     * @param context Context object containing shared resources.
     */
    handle(message: any, context: HandlerContext): Promise<void>;
}