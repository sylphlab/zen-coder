import { z } from 'zod';

// Shared type definitions for communication between Extension Host and Webview UI

/**
 * Represents a part of a message's content in the UI.
 * Can be simple text or a tool call representation.
 */
export interface UiTextMessagePart { type: 'text'; text: string; }
export interface UiToolCallPart {
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: any;
    status?: 'pending' | 'running' | 'complete' | 'error'; // UI state tracking
    result?: any; // Result of the tool execution
    progress?: string; // Optional progress message during execution
}
export interface UiImagePart { type: 'image'; mediaType: string; data: string; } // Add image part type
export type UiMessageContentPart = UiTextMessagePart | UiToolCallPart | UiImagePart; // Include image part

/**
 * Represents a single message displayed in the UI chat history.
 */
export interface UiMessage {
    id: string; // Unique identifier for the message
    sender: 'user' | 'assistant'; // Who sent the message
    content: UiMessageContentPart[]; // Array of content parts (text, tool calls, images)
    timestamp: number; // When the message was created/received
}

/**
 * Represents the status of an AI provider, including whether its
 * API key is set and if it's enabled in the settings.
 */
export interface ProviderInfoAndStatus {
    id: string; // e.g., 'anthropic', 'google'
    name: string; // e.g., 'Anthropic', 'Google Gemini'
    requiresApiKey: boolean; // Does the provider need an API key?
    apiKeySet: boolean;
    enabled: boolean;
    apiKeyUrl?: string; // Optional URL to get the API key
    models: { id: string; name: string }[]; // Available models for this provider
}

/**
 * Represents an available AI model for selection.
 */
export interface AvailableModel {
    id: string; // Unique ID used by the SDK (e.g., 'claude-3-5-sonnet-latest')
    name: string; // User-friendly display name (e.g., 'Claude 3.5 Sonnet')
    providerId: string; // ID of the provider (e.g., 'anthropic')
    providerName: string; // Name of the provider (e.g., 'Anthropic')
}

// --- Schemas for Structured AI Response ---

/**
 * Defines the structure for a single suggested action presented to the user.
 */
export const suggestedActionSchema = z.object({
  label: z.string().describe('The text displayed on the button/option for the user.'),
  action_type: z.enum(['send_message', 'run_tool', 'fill_input'])
    .describe('The type of action to perform when the user selects this option.'),
  value: z.any().describe('The data associated with the action. E.g., the message text for send_message, tool name and args for run_tool, or the text template for fill_input.')
});

export type SuggestedAction = z.infer<typeof suggestedActionSchema>;

/**
 * Defines the structured response expected from the AI, including the main
 * text content and optional suggested actions.
 */
export const structuredAiResponseSchema = z.object({
  // main_content removed again, as we parse JSON from the end of the text stream
  suggested_actions: z.array(suggestedActionSchema).optional()
    .describe('An optional list of actions the user can take next, to be rendered as interactive elements (e.g., buttons).')
});

export type StructuredAiResponse = z.infer<typeof structuredAiResponseSchema>;
// --- Multi-Chat Types ---

// Configuration for a specific chat session
export interface ChatConfig {
    chatModelId?: string; // Overrides default if set
    imageModelId?: string; // Overrides default if set
    optimizeModelId?: string; // Overrides default if set
    useDefaults: boolean; // If true, uses default settings where overrides are not set
    // We can add more config options later, e.g., temperature, custom instructions per chat
}

// Represents a single chat session within a project
export interface ChatSession {
    id: string; // Unique identifier for the chat
    name: string; // User-editable name for the chat
    history: UiMessage[]; // The chat messages
    config: ChatConfig; // Chat-specific configuration
    createdAt: number; // Timestamp of creation
    lastModified: number; // Timestamp of last modification
}

// Structure for storing chat data in workspaceState
export interface WorkspaceChatState {
    chats: { [chatId: string]: ChatSession }; // Map of chatId to ChatSession
    lastActiveChatId: string | null; // ID of the last viewed chat in this workspace
    lastLocation?: string; // Last viewed route/path (e.g., '/index.html', '/chats', '/settings')
}

// Structure for default chat configuration (global scope)
export interface DefaultChatConfig {
    defaultChatModelId?: string;
    defaultImageModelId?: string;
    defaultOptimizeModelId?: string;
}