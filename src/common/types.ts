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
    status?: 'pending' | 'running' | 'complete' | 'error'; // UI state tracking for tool calls
    result?: any; // Result of the tool execution
    progress?: string; // Optional progress message during execution
}
export interface UiImagePart { type: 'image'; mediaType: string; data: string; } // Add image part type
export type UiMessageContentPart = UiTextMessagePart | UiToolCallPart | UiImagePart; // Include image part

/**
 * Represents a single message displayed in the UI chat history.
 */
export interface UiMessage {
    id: string; // Unique identifier for the message (can be temporary on frontend initially)
    tempId?: string; // Optional temporary ID used for optimistic updates reconciliation
    role: 'user' | 'assistant' | 'tool' | 'system'; // Add role property
    content: UiMessageContentPart[]; // Array of content parts (text, tool calls, images)
    timestamp: number; // When the message was created/received
    /** Optional status for UI rendering (e.g., pending response, error) */
    status?: 'pending' | 'error'; // Status for the message itself (e.g., waiting for AI response)
    // Model/Provider info (optional, primarily for assistant messages)
    providerId?: string;
    providerName?: string;
    modelId?: string;
    modelName?: string; // User-friendly model name
    // sender property is deprecated, use role instead
}

// ================== Delta Update Payloads ==================

// ----- History Deltas -----

// NOTE: Most specific history delta types are deprecated in favor of JSON Patch (Operation[]).
// Keeping HistoryAddMessageDelta for potential use in frontend optimistic UI reconciliation.

// Delta payload for adding a message, includes optional tempId for reconciliation
export interface HistoryAddMessageDelta {
  type: 'historyAddMessage'; // Keep this type for potential frontend optimistic logic
  chatId: string;
  message: UiMessage; // This message might contain tempId from the backend
}

// Deprecated: Use JSON Patch instead
// export interface HistorySetDelta { ... }
// export interface HistoryAppendChunkDelta { ... }
// export interface HistoryAddContentPartDelta { ... }
// export interface HistoryUpdateToolCallDelta { ... }
// export interface HistoryUpdateMessageStatusDelta { ... }
// export interface HistoryDeleteMessageDelta { ... }
// export interface HistoryClearDelta { ... }

// Deprecated: Use Operation[] (JSON Patch) for updates pushed via SubscriptionManager
// export type ChatHistoryUpdateData = ...


// ----- Session Deltas -----

export interface SessionSetDelta {
  type: 'sessionSet';
  sessions: ChatSession[];
}

export interface SessionAddDelta {
  type: 'sessionAdd';
  session: ChatSession;
}

export interface SessionDeleteDelta {
  type: 'sessionDelete';
  sessionId: string;
}

export interface SessionUpdateDelta {
  type: 'sessionUpdate';
  sessionId: string;
  name?: string;
  config?: ChatConfig;
  lastModified?: number;
}

export type ChatSessionsUpdateData =
  | SessionSetDelta
  | SessionAddDelta
  | SessionDeleteDelta
  | SessionUpdateDelta;

// ================== Pub/Sub Data Payloads ==================

// Payload for streaming status updates
export type StreamingStatusPayload = {
    streaming: boolean;
};

// Payload for suggested action updates (sent after a message stream finishes)
export type SuggestedActionsPayload = {
    type: 'setActions'; // Action type (could be expanded later, e.g., 'clearActions')
    chatId: string; // Needed for topic filtering on frontend
    messageId: string;
    actions: SuggestedAction[];
} | {
    type: 'clearAllActions'; // Action type to clear all actions for a chat
    chatId: string; // Needed for topic filtering on frontend
};


// ================== Existing Types ==================


/**
 * Represents the status of an AI provider, including whether its
 * API key is set and if it's enabled in the settings.
 */
export interface ProviderInfoAndStatus {
    id: string; // e.g., 'anthropic', 'google'
    name: string; // e.g., 'Anthropic', 'Google Gemini'
    requiresApiKey: boolean; // Does the provider need an API key?
    apiKeySet: boolean | undefined; // Allow undefined for synchronous status checks
    enabled: boolean;
    apiKeyUrl?: string; // Optional URL to get the API key
    apiKeyDescription?: string; // Optional description for the key/credentials
    usesComplexCredentials?: boolean; // Optional flag for JSON/complex credentials
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
    providerId?: string;   // e.g., "anthropic" - Overrides default if set
    providerName?: string; // Optional user-friendly provider name (primarily for display)
    modelId?: string;      // e.g., "claude-3-5-sonnet-latest" - Overrides default if set
    modelName?: string;    // Optional user-friendly model name (primarily for display)
    // Keep image/optimize as combined IDs for now, or refactor later if needed
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

// --- Tool Authorization ---

export enum ToolStatus {
  Disabled = 'disabled',
  RequiresAuthorization = 'requiresAuthorization',
  AlwaysAvailable = 'alwaysAvailable',
  Inherited = 'inherited', // Only applicable to individual tool overrides
}

export enum CategoryStatus {
  Disabled = 'disabled',
  RequiresAuthorization = 'requiresAuthorization',
  AlwaysAvailable = 'alwaysAvailable',
}

// Structure for the zencoder.toolAuthorization setting
export interface ToolAuthorizationConfig {
  categories?: {
    [categoryId: string]: CategoryStatus; // e.g., 'filesystem', 'vscode'
  };
  mcpServers?: {
     [serverName: string]: CategoryStatus; // e.g., 'github'
  };
  overrides?: {
    [toolId: string]: ToolStatus; // toolId can be standard (e.g., 'readFile') or MCP (e.g., 'mcp_github_create_issue')
  };
}

// Structure for individual tool status info returned to UI
export interface ToolInfo {
  id: string; // e.g., 'readFile', 'mcp_github_create_issue'
  name: string; // e.g., 'readFile', 'github: create_issue' (display name)
  description?: string;
  status: ToolStatus; // The configured status (could be 'inherited')
  resolvedStatus: CategoryStatus; // The final calculated status (Disabled, RequiresAuth, AlwaysAvailable)
}

// Structure for categorized tool status info returned to UI
export interface ToolCategoryInfo {
  id: string; // e.g., 'filesystem', 'vscode', 'github'
  name: string; // e.g., 'Filesystem', 'VS Code', 'GitHub Server'
  status: CategoryStatus;
  tools: ToolInfo[];
}

// Type for the data returned by GetAllToolsStatusHandler and pushed via updateAllToolsStatus
export type AllToolsStatusInfo = ToolCategoryInfo[];

// --- End Tool Authorization ---

// --- Request/Response Types for Webview <-> Extension Communication ---

// Define a union type for all possible action request types initiated by the frontend
export type ActionRequestType =
    | 'setApiKey'
    | 'deleteApiKey'
    | 'setProviderEnabled'
    | 'setDefaultConfig'
    | 'setGlobalCustomInstructions'
    | 'setProjectCustomInstructions'
    | 'openOrCreateProjectInstructionsFile'
    | 'setToolAuthorization'
    | 'retryMcpConnection'
    | 'setActiveChat'
    | 'createChat'
    | 'deleteChat'
    | 'updateChatConfig'
    | 'clearChatHistory'
    | 'deleteMessage'
    | 'updateLastLocation'
    | 'openGlobalMcpConfig' // Added
    | 'openProjectMcpConfig'
    | 'stopGeneration' // Added
    // Add other action types here as needed
    | 'executeToolAction'; // Although handled differently, include for completeness? Or keep separate? Let's include for now.

export interface WebviewRequestMessage {
  type: 'requestData'; // Generic type for requests needing a response
  requestId: string;
  requestType: string; // Use string to allow any handler type
    payload?: any; // Optional payload for the request (e.g., providerId for getModelsForProvider)
}

// --- Payload Types for Message Passing ---

export interface LoadChatStatePayload {
    chats: ChatSession[];
    lastActiveChatId: string | null;
    lastLocation?: string; // Optional last known UI location
}

export interface StartAssistantMessagePayload {
    chatId: string;
    messageId: string;
}

export interface AppendMessageChunkPayload {
    chatId: string;
    messageId: string;
    textChunk: string;
}

// Add other payload types as needed...

export interface WebviewResponseMessage {
  type: 'responseData'; // Generic type for responses
  requestId: string;
  payload?: any; // Successful response data
  error?: string; // Error message if request failed
}



// Structure for storing chat data in workspaceState
export interface WorkspaceChatState {
    chats: { [chatId: string]: ChatSession }; // Map of chatId to ChatSession
    lastActiveChatId: string | null; // ID of the last viewed chat in this workspace
    lastLocation?: string; // Last viewed route/path (e.g., '/index.html', '/chats', '/settings')
}

// --- Message Interfaces for Tool Authorization ---

export interface GetAllToolsStatusRequest {
  type: 'getAllToolsStatus';
}

// Make SetToolAuthorizationRequest compatible with request/response
export interface SetToolAuthorizationRequest {
  type: 'setToolAuthorization';
  requestId: string; // Add requestId
  payload: {
    config: ToolAuthorizationConfig; // Send the whole config object to update
  };
}

export interface UpdateAllToolsStatusPush {
  type: 'updateAllToolsStatus';
  payload: AllToolsStatusInfo; // Send the resolved, categorized status info
}
// --- Message Types (Webview -> Extension) ---

export type WebviewMessageType =
  | 'webviewReady' // Initial signal
  | 'settingsPageReady' // Signal from settings page
  | 'sendMessage'
  | 'setApiKey'
  | 'deleteApiKey'
  | 'setProviderEnabled'
  | 'clearChatHistory'
  | 'stopGeneration'
  | 'setActiveChat'
  | 'createChat'
  | 'deleteChat'
  | 'updateChatConfig'
  | 'deleteMessage'
  | 'retryMcpConnection'
  | 'openGlobalMcpConfig'
  | 'openProjectMcpConfig'
  | 'setToolEnabled' // Unified tool toggle
  | 'setGlobalCustomInstructions'
  | 'setProjectCustomInstructions'
  | 'openOrCreateProjectInstructionsFile'
  | 'setDefaultConfig'
  | 'logAction' // Generic logging/debugging
  | 'subscribeToMcpStatus' // MCP Pub/Sub
  | 'unsubscribeFromMcpStatus' // MCP Pub/Sub
  | 'subscribeToProviderStatus' // Provider Status Pub/Sub
  | 'unsubscribeFromProviderStatus' // Provider Status Pub/Sub
  | GetAllToolsStatusRequest // Added for Tool Auth
  | SetToolAuthorizationRequest // Added for Tool Auth
  | WebviewRequestMessage; // Add request type

// --- Message Types (Extension -> Webview) ---

export type ExtensionMessageType =
  | { type: 'loadChatState'; payload: { chats: ChatSession[]; lastActiveChatId: string | null; lastLocation?: string } } // Initial full state push (TODO: Refactor?)
  | { type: 'startAssistantMessage'; payload: { chatId: string; messageId: string } } // TODO: Refactor to pushUpdate?
  | { type: 'appendMessageChunk'; payload: { chatId: string; messageId: string; contentChunk: any } } // TODO: Refactor to pushUpdate? Type contentChunk more strictly.
  | { type: 'updateToolCall'; payload: { chatId: string; messageId: string; toolCallId: string; status: UiToolCallPart['status']; result?: any; progress?: string } } // TODO: Refactor to pushUpdate?
  | { type: 'streamFinished'; payload: { chatId: string; messageId: string } } // TODO: Refactor to pushUpdate?
  | { type: 'showSettings' } // Keep for potential future use?
  | { type: 'pushUpdate'; payload: { topic: string; data: any } } // Unified Pub/Sub update message
  | WebviewResponseMessage; // Add response type


// Payload for MCP server status updates/responses
import { McpServerStatus } from '../ai/mcpManager'; // Ensure this import is correct
export interface McpConfiguredStatusPayload {
   [serverName: string]: McpServerStatus;
}

// --- Default Configuration ---

// Structure for default chat configuration (global scope)
export interface DefaultChatConfig {
    defaultProviderId?: string; // e.g., "anthropic"
    defaultModelId?: string;    // e.g., "claude-3-5-sonnet-latest"
    defaultImageModelId?: string; // Keep for future use
    defaultOptimizeModelId?: string; // Keep for future use
}

// --- Pub/Sub Topics ---
export const STREAMING_STATUS_TOPIC = 'streamingStatusUpdate';
export const SUGGESTED_ACTIONS_TOPIC_PREFIX = 'suggestedActionsUpdate/'; // Topic prefix for suggested actions (dynamic per chat)
// Add other static topic constants here as needed

// --- Streaming Status --- Payload defined in Pub/Sub Data Payloads section

// --- Suggested Actions --- Payload defined in Pub/Sub Data Payloads section
