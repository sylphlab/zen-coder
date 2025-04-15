import * as vscode from 'vscode';
import { AiService } from './aiService'; // Import AiService to access its methods/getters
import { HistoryManager } from '../historyManager';
import { ProviderStatusManager } from './providerStatusManager';
import { ToolManager } from './toolManager';
import { SUGGESTED_ACTIONS_TOPIC_PREFIX, SuggestedActionsPayload, ProviderInfoAndStatus, AllToolsStatusInfo, DefaultChatConfig } from '../common/types'; // Import necessary types

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
        } else {
            console.log(`[SubscriptionManager] Topic '${topic}' was already active.`);
        }
        console.log(`[SubscriptionManager] Active topics: ${Array.from(this._activeTopics).join(', ')}`);
    }

    /**
     * Removes a subscription for a given topic.
     * Marks a topic as inactive.
     */
    public async removeSubscription(topic: string): Promise<void> {
        if (this._activeTopics.has(topic)) {
            this._activeTopics.delete(topic);
            console.log(`[SubscriptionManager] Topic '${topic}' is now inactive.`);
        } else {
            console.warn(`[SubscriptionManager] Attempted to unsubscribe from inactive topic: ${topic}`);
        }
        console.log(`[SubscriptionManager] Active topics: ${Array.from(this._activeTopics).join(', ')}`);
    }

    /**
     * Checks if a topic is currently active (i.e., the webview is subscribed).
     */
    public hasSubscription(topic: string): boolean {
        if (topic.startsWith(SUGGESTED_ACTIONS_TOPIC_PREFIX)) {
            return this._activeTopics.has(topic);
        }
        return this._activeTopics.has(topic);
    }

    // --- Notification Helpers ---

    public async notifyProviderStatusChange(): Promise<void> {
        const topic = 'providerStatusUpdate'; // Consistent topic name
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                const latestStatus = await aiService.providerStatusManager.getProviderStatus(
                    aiService.providerManager.allProviders,
                    aiService.providerManager.providerMap
                );
                const dataToSend = latestStatus; // Send array directly
                console.log('[SubscriptionManager] Pushing providerStatus update.');
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: dataToSend } });
            } catch (error) {
                console.error('[SubscriptionManager] Error fetching/pushing provider status:', error);
            }
        }
    }


    public async notifyToolStatusChange(): Promise<void> {
        const topic = 'allToolsStatusUpdate';
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                const latestStatusInfo = await aiService.getResolvedToolStatusInfo();
                console.log('[SubscriptionManager] Pushing tool status update.');
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: latestStatusInfo } });
            } catch (error) {
                console.error(`[SubscriptionManager] Error fetching/pushing tool status for notification (${topic}):`, error);
            }
        }
    }

    // Updated to accept the config directly
    public notifyDefaultConfigChange(config: DefaultChatConfig): void {
        const topic = 'defaultConfigUpdate';
        if (this.hasSubscription(topic)) {
            try {
                // No need to fetch, use the provided config
                console.log('[SubscriptionManager] Pushing defaultConfig update with provided data:', config);
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: config } });
            } catch (error) {
                // Catch potential errors during message posting (though less likely)
                console.error('[SubscriptionManager] Error pushing default config update:', error);
            }
        } else {
             console.log(`[SubscriptionManager] No active subscription for ${topic}, skipping defaultConfig push.`);
        }
    }

    public async notifyCustomInstructionsChange(): Promise<void> {
        const topic = 'customInstructionsUpdate';
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                const latestInstructions = await aiService.getCombinedCustomInstructions();
                console.log('[SubscriptionManager] Fetched latest instructions for push:', JSON.stringify(latestInstructions, null, 2));
                console.log('[SubscriptionManager] Pushing customInstructions update.');
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: latestInstructions } });
            } catch (error) {
                console.error('[SubscriptionManager] Error fetching/pushing custom instructions:', error);
            }
        }
    }

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
            console.log(`[SubscriptionManager] Pushing ${topic}. Data type: ${historyData.type}`);
            
            // Debug message status updates specifically
            if (historyData.type === 'historyUpdateMessageStatus') {
                console.log(`[SubscriptionManager] MessageStatus update for message ${historyData.messageId}, status: ${historyData.status === undefined ? 'undefined' : historyData.status}`);
            }
            
            this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: historyData } });
        }
    }

    /**
     * Pushes suggested actions updates to the webview for a specific chat.
     * @param payload - The SuggestedActionsPayload containing the actions or clear instruction.
     */
    public notifySuggestedActionsUpdate(payload: SuggestedActionsPayload): void {
        const topic = `${SUGGESTED_ACTIONS_TOPIC_PREFIX}${payload.chatId}`;
        if (this.hasSubscription(topic)) {
            console.log(`[SubscriptionManager] Pushing ${topic}. Action Type: ${payload.type}`);
            this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: payload } });
        } else {
             console.log(`[SubscriptionManager] No active subscription for ${topic}, skipping suggested actions push.`);
        }
    }

}
