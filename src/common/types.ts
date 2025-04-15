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
    role: 'user' | 'assistant' | 'tool' | 'system'; // Add role property
    content: UiMessageContentPart[]; // Array of content parts (text, tool calls, images)
    timestamp: number; // When the message was created/received
    // sender property is deprecated, use role instead
}

// ================== Delta Update Payloads ==================

// ----- History Deltas -----

export interface HistorySetDelta {
  type: 'historySet';
  chatId: string;
  history: UiMessage[];
}

export interface HistoryAddMessageDelta {
  type: 'historyAddMessage';
  chatId: string;
  message: UiMessage;
}

export interface HistoryAppendChunkDelta {
  type: 'historyAppendChunk';
  chatId: string;
  messageId: string; // ID of the message being appended to
  textChunk: string;
}

export interface HistoryAddContentPartDelta { // Added this new delta type
  type: 'historyAddContentPart';
  chatId: string;
  messageId: string;
  part: UiMessageContentPart; // The new part to add (e.g., a tool call)
}

export interface HistoryUpdateToolCallDelta {
  type: 'historyUpdateToolCall';
  chatId: string;
  messageId: string;
  toolCallId: string;
  status?: UiToolCallPart['status'];
  result?: any;
  progress?: string;
}

export interface HistoryDeleteMessageDelta {
  type: 'historyDeleteMessage';
  chatId: string;
  messageId: string;
}

export interface HistoryClearDelta {
  type: 'historyClear';
  chatId: string;
}

export type ChatHistoryUpdateData =
  | HistorySetDelta
  | HistoryAddMessageDelta
  | HistoryAppendChunkDelta
  | HistoryAddContentPartDelta // Add the new type to the union
  | HistoryUpdateToolCallDelta
  | HistoryDeleteMessageDelta
  | HistoryClearDelta;


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
    modelId?: string;      // e.g., "claude-3-5-sonnet-latest" - Overrides default if set (Changed from modelName)
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

// Removed WebviewRequestType as all requests use requestType: string now
// export type WebviewRequestType = ... (removed)
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

// Removed WebviewActionMessage interface

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

export interface UpdateSuggestedActionsPayload {
    chatId: string;
    messageId: string;
    actions: SuggestedAction[];
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
  | { type: 'addSuggestedActions'; payload: { chatId: string; messageId: string; actions: SuggestedAction[] } } // TODO: Refactor to pushUpdate?
  | { type: 'streamFinished'; payload: { chatId: string; messageId: string } } // TODO: Refactor to pushUpdate?
  | { type: 'showSettings' } // Keep for potential future use?
  // | { type: 'mcpConfigReloaded' } // Removed, use pushUpdate topic
  // | { type: 'updateMcpConfiguredStatus'; payload: McpConfiguredStatusPayload } // Removed, use pushUpdate topic
  // | { type: 'updateCustomInstructions'; payload: { global?: string; project?: string; projectPath?: string | null } } // Removed, use pushUpdate topic
  // | { type: 'updateDefaultConfig'; payload: DefaultChatConfig } // Removed, use pushUpdate topic
  // | { type: 'pushUpdateProviderStatus'; payload: ProviderInfoAndStatus[] } // Removed, use pushUpdate topic
  // | UpdateAllToolsStatusPush // Removed, use pushUpdate topic
  | { type: 'pushUpdate'; payload: { topic: string; data: any } } // Unified Pub/Sub update message
  | WebviewResponseMessage; // Add response type


// Removed old/duplicate definitions for ParentStatus, ToolStatus, ToolInfo, AllToolsStatusPayload, ToolAuthorizationConfig
// The new definitions are placed after the Multi-Chat Types section.

// --- Settings Page Specific Types (Payloads for Push/Response) ---

// Payload for MCP server status updates/responses
// Needs McpServerStatus, assume it's imported or defined above
import { McpServerStatus } from '../ai/mcpManager'; // Ensure this import is correct
export interface McpConfiguredStatusPayload {
   [serverName: string]: McpServerStatus;
}

// AllToolsStatusPayload is replaced by AllToolsStatusInfo defined earlier
// --- Default Configuration ---

// Structure for default chat configuration (global scope)
export interface DefaultChatConfig {
    defaultProviderId?: string; // e.g., "anthropic"
    defaultModelId?: string;    // e.g., "claude-3-5-sonnet-latest"
    defaultImageModelId?: string; // Keep for future use
    defaultOptimizeModelId?: string; // Keep for future use
}


// Duplicate DefaultChatConfig removed


// --- Streaming Status ---

export const STREAMING_STATUS_TOPIC = 'streamingStatusUpdate';

export interface StreamingStatusPayload {
    streaming: boolean;
}
