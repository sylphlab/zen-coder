import * as vscode from 'vscode';
import { AiService } from './aiService'; // Import AiService to access its methods/getters
import { HistoryManager } from '../historyManager';
import { ProviderStatusManager } from './providerStatusManager';
import { ToolManager } from './toolManager';

/**
 * Manages subscriptions from the webview and pushes updates.
 */
export class SubscriptionManager {
    private _activeTopics: Set<string> = new Set();
    private _postMessageCallback?: (message: any) => void;
    private _aiServiceGetter: () => AiService; // Getter to avoid circular dependency issues

    constructor(
        aiServiceGetter: () => AiService,
    ) {
        this._aiServiceGetter = aiServiceGetter;
        // Note: postMessageCallback needs to be set separately after AiService is fully constructed.
    }

    /**
     * Sets the callback used to send messages (updates) to the webview.
     * This should be called by AiService after its own construction.
     */
    public setPostMessageCallback(callback: (message: any) => void): void {
        this._postMessageCallback = callback;
    }

    /**
     * Adds a subscription for a given topic.
     * Marks a topic as active, indicating the webview is interested in updates for it.
     */
    public async addSubscription(topic: string): Promise<void> {
        if (!this._activeTopics.has(topic)) {
            this._activeTopics.add(topic);
            console.log(`[SubscriptionManager] Topic '${topic}' is now active.`);
            // Potentially start background processes based on topic here if needed
        } else {
            console.log(`[SubscriptionManager] Topic '${topic}' was already active.`);
        }
        console.log(`[SubscriptionManager] Active topics: ${Array.from(this._activeTopics).join(', ')}`);
        // Initial state is fetched via requestData by the frontend's createStore.
    }

    /**
     * Removes a subscription for a given topic.
     * Marks a topic as inactive.
     */
    public async removeSubscription(topic: string): Promise<void> {
        if (this._activeTopics.has(topic)) {
            this._activeTopics.delete(topic);
            console.log(`[SubscriptionManager] Topic '${topic}' is now inactive.`);
            // Potentially stop background processes based on topic here if needed
        } else {
            console.warn(`[SubscriptionManager] Attempted to unsubscribe from inactive topic: ${topic}`);
        }
        console.log(`[SubscriptionManager] Active topics: ${Array.from(this._activeTopics).join(', ')}`);
    }

    /**
     * Checks if a topic is currently active (i.e., the webview is subscribed).
     */
    public hasSubscription(topic: string): boolean {
        return this._activeTopics.has(topic);
    }

    // --- Notification Helpers ---
    // These methods fetch the latest data (using the AiService getter)
    // and push it to the webview if the relevant topic is active.

    public async notifyProviderStatusChange(): Promise<void> {
        const topic = 'providerStatus'; // Standard topic name used by frontend store
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                // Access necessary managers/data via AiService instance
                const latestStatus = await aiService.providerStatusManager.getProviderStatus(aiService.allProviders, aiService.providerMap);
                 // Wrap in payload as expected by the specific store ($providerStatus)
                const dataToSend = { payload: latestStatus };
                console.log('[SubscriptionManager] Pushing providerStatus update.');
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: dataToSend } });
            } catch (error) {
                console.error('[SubscriptionManager] Error fetching/pushing provider status:', error);
            }
        }
    }

    public async notifyToolStatusChange(): Promise<void> {
        const topic = 'allToolsStatusUpdate'; // Standard topic name used by frontend store
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                // Delegate fetching the status info to AiService -> ToolManager
                const latestStatusInfo = await aiService.getResolvedToolStatusInfo();
                console.log('[SubscriptionManager] Pushing tool status update.');
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: latestStatusInfo } });
            } catch (error) {
                console.error(`[SubscriptionManager] Error fetching/pushing tool status for notification (${topic}):`, error);
            }
        }
    }

    public async notifyDefaultConfigChange(): Promise<void> {
        const topic = 'defaultConfig'; // Standard topic name used by frontend store
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                const latestConfig = await aiService.getDefaultConfig();
                console.log('[SubscriptionManager] Pushing defaultConfig update.');
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: latestConfig } });
            } catch (error) {
                console.error('[SubscriptionManager] Error fetching/pushing default config:', error);
            }
        }
    }

    public async notifyCustomInstructionsChange(): Promise<void> {
        const topic = 'customInstructions'; // Standard topic name used by frontend store
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                const latestInstructions = await aiService.getCombinedCustomInstructions();
                console.log('[SubscriptionManager] Pushing customInstructions update.');
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: latestInstructions } });
            } catch (error) {
                console.error('[SubscriptionManager] Error fetching/pushing custom instructions:', error);
            }
        }
    }

    // Note: McpManager pushes its own status updates via the callback passed during its construction in AiService.
    // SubscriptionManager doesn't need to handle mcpStatus notifications directly, but AiService might
    // want to check hasSubscription('mcpStatus') before passing the callback or forwarding the message.

    // Add methods for other push updates if needed (e.g., chat sessions, chat history)
    public notifyChatSessionsUpdate(sessionsData: any): void {
        const topic = 'chatSessionsUpdate';
        if (this.hasSubscription(topic)) {
            console.log('[SubscriptionManager] Pushing chatSessionsUpdate.');
            this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: sessionsData } });
        }
    }

    public notifyChatHistoryUpdate(chatId: string, historyData: any): void {
        const topic = `chatHistoryUpdate/${chatId}`;
        if (this.hasSubscription(topic)) {
            console.log(`[SubscriptionManager] Pushing ${topic}.`);
            this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: historyData } });
        }
    }

}
