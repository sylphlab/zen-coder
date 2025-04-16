import * as vscode from 'vscode';
import { AiService } from './aiService'; // Import AiService to access its methods/getters
import { HistoryManager } from '../historyManager';
import { ProviderStatusManager } from './providerStatusManager';
import { ToolManager } from './toolManager';
import { UiMessage, SUGGESTED_ACTIONS_TOPIC_PREFIX, SuggestedActionsPayload, ProviderInfoAndStatus, AllToolsStatusInfo, DefaultChatConfig } from '../common/types'; // Import necessary types, ADDED UiMessage
import { Operation } from 'fast-json-patch'; // Import Operation directly
import { generatePatch } from '../utils/patchUtils'; // Re-add generatePatch import

 /**
  * Manages subscriptions from the webview and pushes updates.
  */
export class SubscriptionManager {
    private _activeTopics: Set<string> = new Set();
    private _postMessageCallback?: (message: any) => void;
    private _aiServiceGetter: () => AiService; // Getter to avoid circular dependency issues
    // Re-add caches for patch generation
    private _lastProviderStatus: ProviderInfoAndStatus[] | null = null;
    private _lastToolStatus: AllToolsStatusInfo | null = null;
    private _lastDefaultConfig: DefaultChatConfig | null = null;
    private _lastCustomInstructions: { global?: string; project?: string; projectPath?: string | null } | null = null;


    constructor(
        aiServiceGetter: () => AiService,
    ) {
        this._aiServiceGetter = aiServiceGetter;
    }

    /**
     * Sets the callback used to send messages (updates) to the webview.
     */
    public setPostMessageCallback(callback: (message: any) => void): void {
        this._postMessageCallback = callback;
    }

    /**
     * Adds a subscription for a given topic.
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
     * Checks if a topic is currently active.
     */
    public hasSubscription(topic: string): boolean {
        return this._activeTopics.has(topic);
    }

    // --- Notification Helpers ---

    /**
     * Fetches the latest provider status, calculates a JSON patch against the cached status,
     * updates the cache, and pushes the patch if changes exist.
     */
    public async notifyProviderStatusChange(): Promise<void> {
        const topic = 'providerStatus'; // Topic used by the frontend store
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                const newStatus = await aiService.providerStatusManager.getProviderStatus(
                    aiService.providerManager.allProviders,
                    aiService.providerManager.providerMap
                );
                const oldStatus = this._lastProviderStatus;
                const patch = generatePatch(oldStatus ?? [], newStatus);
                this._lastProviderStatus = newStatus;

                if (patch.length > 0) {
                    console.log('[SubscriptionManager] Pushing providerStatus patch.');
                    this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: patch } });
                } else {
                    console.log('[SubscriptionManager] No providerStatus change detected, skipping patch push.');
                }
            } catch (error) {
                console.error('[SubscriptionManager] Error fetching/pushing provider status patch:', error);
            }
        }
    }

    /**
     * Fetches the latest tool status, calculates a JSON patch against the cached status,
     * updates the cache, and pushes the patch if changes exist.
     */
    public async notifyToolStatusChange(): Promise<void> {
        const topic = 'allToolsStatusUpdate';
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                const newStatusInfo = await aiService.getResolvedToolStatusInfo();
                const oldStatusInfo = this._lastToolStatus;
                const patch = generatePatch(oldStatusInfo ?? [], newStatusInfo);
                this._lastToolStatus = newStatusInfo; // Update cache

                if (patch.length > 0) {
                    console.log('[SubscriptionManager] Pushing tool status patch.');
                    this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: patch } });
                } else {
                    console.log('[SubscriptionManager] No tool status change detected, skipping patch push.');
                }
            } catch (error) {
                console.error(`[SubscriptionManager] Error fetching/pushing tool status patch (${topic}):`, error);
            }
        }
    }

    /**
     * Calculates a JSON patch for default config changes against the cached config,
     * updates the cache, and pushes the patch if changes exist.
     */
    public notifyDefaultConfigChange(newConfig: DefaultChatConfig): void { // Ensure parameter name matches usage
        const topic = 'defaultConfigUpdate';
        if (this.hasSubscription(topic)) {
            try {
                const oldConfig = this._lastDefaultConfig; // Get cached state
                const patch = generatePatch(oldConfig ?? {}, newConfig); // Calculate patch using newConfig
                this._lastDefaultConfig = newConfig; // Update cache with newConfig

                if (patch.length > 0) {
                    console.log('[SubscriptionManager] Pushing defaultConfig patch.');
                    // *** CRITICAL FIX: Ensure 'data' is the calculated 'patch', not 'newConfig' ***
                    this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: patch } });
                } else {
                     console.log(`[SubscriptionManager] No defaultConfig change detected, skipping patch push.`);
                }
            } catch (error) {
                console.error('[SubscriptionManager] Error processing/pushing default config patch:', error);
            }
        } else {
             console.log(`[SubscriptionManager] No active subscription for ${topic}, skipping defaultConfig push.`);
        }
    }

    /**
     * Fetches the latest custom instructions, calculates a JSON patch against the cached instructions,
     * updates the cache, and pushes the patch if changes exist.
     */
    public async notifyCustomInstructionsChange(): Promise<void> {
        const topic = 'customInstructionsUpdate';
        if (this.hasSubscription(topic)) {
            try {
                const aiService = this._aiServiceGetter();
                const newInstructions = await aiService.getCombinedCustomInstructions();
                const oldInstructions = this._lastCustomInstructions;
                const patch = generatePatch(oldInstructions ?? {}, newInstructions); // Compare with empty object
                this._lastCustomInstructions = newInstructions; // Update cache

                if (patch.length > 0) {
                    console.log('[SubscriptionManager] Pushing customInstructions patch.');
                    this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: patch } });
                } else {
                     console.log(`[SubscriptionManager] No customInstructions change detected, skipping patch push.`);
                }
            } catch (error) {
                console.error('[SubscriptionManager] Error fetching/pushing custom instructions patch:', error);
            }
        }
    }

    /**
     * Pushes chat session updates (expects JSON Patch array from caller).
     */
    public notifyChatSessionsUpdate(sessionsPatch: Operation[]): void { // Expect patch
        const topic = 'chatSessionsUpdate';
        if (this.hasSubscription(topic)) {
            if (Array.isArray(sessionsPatch)) { // Basic validation
                console.log('[SubscriptionManager] Pushing chatSessions patch.');
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: sessionsPatch } });
            } else {
                 console.warn('[SubscriptionManager] Received non-array data for chatSessions patch, skipping push.');
            }
        }
    }

    /**
     * Pushes chat history updates (expects JSON Patch array from caller).
     */
    public notifyChatHistoryUpdate(chatId: string, historyPatch: Operation[]): void { // Expect patch
        const topic = `chatHistoryUpdate/${chatId}`;
        if (this.hasSubscription(topic)) {
            if (Array.isArray(historyPatch)) { // Basic validation
                // console.log(`[SubscriptionManager] Pushing ${topic} patch.`); // Less verbose
                this._postMessageCallback?.({ type: 'pushUpdate', payload: { topic, data: historyPatch } });
            } else {
                 // console.warn(`[SubscriptionManager] Received non-array data for ${topic} patch, skipping push.`); // Less verbose
            }
        }
    }

    /**
     * Pushes suggested actions updates (still sends full payload).
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
