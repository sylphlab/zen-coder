import { FunctionalComponent } from 'preact';
import { Ref } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { UiMessage, SuggestedAction, UiToolCallPart } from '../../../src/common/types';
import { ToolStatusDisplay } from './ToolStatusDisplay';
import { Button } from './ui/Button';

// --- SVG Icons ---
const CopyIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
);

const DeleteIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const LoadingSpinner: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
    <svg class={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const TickIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
);

const ErrorIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// Helper to format timestamp
const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

// --- Component Props ---
interface MessagesAreaProps {
    messages: UiMessage[];
    suggestedActionsMap: { [messageId: string]: SuggestedAction[] };
    isStreaming: boolean;
    handleSuggestedActionClick: (action: SuggestedAction) => void;
    messagesEndRef: Ref<HTMLDivElement>;
    onCopyMessage: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
    className?: string;
}

export const MessagesArea: FunctionalComponent<MessagesAreaProps> = ({
    messages,
    suggestedActionsMap,
    isStreaming,
    handleSuggestedActionClick,
    messagesEndRef,
    onCopyMessage,
    onDeleteMessage,
    className
}) => {
    return (
        <div class={`messages-area px-4 py-4 space-y-6 ${className ?? ''}`}>
            {messages.map((message) => {
                const isUser = message.role === 'user';
                const isAssistant = message.role === 'assistant';
                const messageActions = suggestedActionsMap[message.id] || [];

                if (!isUser && !isAssistant) return null; // Hide other roles

                // Message container with subtle animation
                return (
                    <MessageItem 
                        key={message.id} 
                        message={message}
                        actions={messageActions}
                        isUser={isUser} 
                        isAssistant={isAssistant}
                        handleSuggestedActionClick={handleSuggestedActionClick}
                        onCopyMessage={onCopyMessage}
                        onDeleteMessage={onDeleteMessage}
                    />
                );
            })}
            
            {/* Messages end reference point */}
            <div ref={messagesEndRef} />
            
            {/* Animation styles */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes floatIn {
                    from { opacity: 0; transform: translateY(-3px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
                
                @keyframes blink {
                    0%, 100% { opacity: 0.8; }
                    50% { opacity: 0.5; }
                }
                
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </div>
    );
};

// Separate MessageItem component
interface MessageItemProps {
    message: UiMessage;
    actions?: SuggestedAction[];
    isUser: boolean;
    isAssistant: boolean;
    handleSuggestedActionClick: (action: SuggestedAction) => void;
    onCopyMessage: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
}

// Tool status item component for minimalist design
const ToolStatusItem: FunctionalComponent<{
    status: string;
    label: string;
    progress?: number | string;
    completed?: boolean;
    failed?: boolean;
    duration?: string;
}> = ({ status, label, progress, completed, failed, duration }) => {
    return (
        <div class="flex items-center space-x-2 text-xs my-1 text-gray-600 dark:text-gray-400">
            {completed ? (
                <TickIcon className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
            ) : failed ? (
                <ErrorIcon className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
            ) : (
                <LoadingSpinner className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
            )}
            
            <div class="flex items-center space-x-1">
                <span class={`${completed ? 'line-through opacity-70' : ''} ${failed ? 'line-through text-red-500 dark:text-red-400' : ''}`}>
                    {label}
                </span>
                
                {progress !== undefined && !completed && !failed && (
                    <span class="opacity-70 text-[10px]">({typeof progress === 'number' ? Math.round(progress * 100) : progress}%)</span>
                )}
                
                {duration && completed && (
                    <span class="text-[10px] opacity-60">{duration}</span>
                )}
            </div>
        </div>
    );
};

const MessageItem: FunctionalComponent<MessageItemProps> = ({
    message,
    actions = [],
    isUser,
    isAssistant,
    handleSuggestedActionClick,
    onCopyMessage,
    onDeleteMessage
}) => {
    const [showActions, setShowActions] = useState(false);
    const messageRef = useRef<HTMLDivElement>(null);
    const messageContentRef = useRef<HTMLDivElement>(null);

    // Get tool call parts from message content
    const toolCallParts = message.content.filter((part): part is UiToolCallPart => part.type === 'tool-call');

    return (
        <div
            class={`message-container w-full transition-all duration-200 ease-out 
                   ${isUser ? 'pl-10 md:pl-16' : 'pr-10 md:pr-16'}`}
            style={{ 
                animation: `fadeIn 250ms ease-out forwards`, 
                opacity: 0 
            }}
            ref={messageRef}
        >
            <div
                class={`relative group rounded-lg p-3.5 
                      ${isUser 
                        ? 'bg-black/3 dark:bg-white/5 ml-auto' 
                        : 'bg-indigo-50/20 dark:bg-indigo-950/10'
                      } 
                      max-w-[90%] hover:shadow-sm transition-shadow duration-150`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {/* Assistant Name */}
                {isAssistant && (
                    <div class="text-xs font-bold mb-2 text-indigo-600 dark:text-indigo-400">
                        {message.modelName || message.providerName || 'Assistant'}
                    </div>
                )}

                {/* Content */}
                <div 
                    ref={messageContentRef}
                    class="message-content text-sm text-gray-800 dark:text-gray-200"
                >
                    {message.content.map((part, index) => {
                        if (part.type === 'text') {
                            const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
                            const textWithCodeBlocks = part.text.replace(codeBlockRegex, (match, lang, code) => {
                                return `<pre class="bg-black/5 dark:bg-white/5 p-3 rounded my-3 overflow-x-auto text-xs font-mono"><code>${code.trim()}</code></pre>`;
                            });
                            const inlineCodeRegex = /`([^`]+)`/g;
                            const textWithInlineCode = textWithCodeBlocks.replace(inlineCodeRegex, '<code class="bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');
                            const boldRegex = /\*\*([^\*]+)\*\*/g;
                            const textWithBold = textWithInlineCode.replace(boldRegex, '<strong class="font-semibold">$1</strong>');
                            const listItemRegex = /^- (.+)$/gm;
                            const textWithListItems = textWithBold.replace(listItemRegex, '<div class="flex"><span class="mr-2">•</span><span>$1</span></div>');
                            return <div key={index} class="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: textWithListItems }} />;
                        } else if (part.type === 'image') {
                            return (
                                <div key={index} class="my-2 relative group/image">
                                    <img 
                                        src={`data:${part.mediaType};base64,${part.data}`} 
                                        alt="Uploaded content" 
                                        class="max-w-xs max-h-xs rounded-lg shadow-sm hover:shadow transition-shadow duration-200" 
                                    />
                                    <div class="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 dark:group-hover/image:bg-white/5 transition-colors duration-200 rounded-lg"></div>
                                </div>
                            );
                        }
                        return null;
                    })}

                    {/* Enhanced Tool Status Display with subtle animations */}
                    {isAssistant && message.status === 'pending' && (
                        <div class="tool-status-container mt-3 mb-1 text-xs border-t border-black/5 dark:border-white/5 pt-2 opacity-80">
                            <div class="flex items-center text-indigo-500 dark:text-indigo-400">
                                <LoadingSpinner className="h-3 w-3 mr-2" />
                                <span class="opacity-80" style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>
                                    Working...
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Custom minimalist tool status display */}
                    {isAssistant && toolCallParts.length > 0 && (
                        <div class="tool-status-container mt-3 mb-1 text-xs border-t border-black/5 dark:border-white/5 pt-2">
                            {toolCallParts.map((tool, index) => {
                                const isCompleted = tool.status === 'complete';
                                const isFailed = tool.status === 'error';
                                
                                let displayName = tool.toolName || 'Processing';
                                let durationText = '';
                                
                                // Helper to extract relevant information from tool
                                if (tool.toolName?.startsWith('read_file') && tool.args?.target_file) {
                                    displayName = `Reading ${tool.args.target_file}`;
                                } else if (tool.toolName?.startsWith('edit_file') && tool.args?.target_file) {
                                    displayName = `Editing ${tool.args.target_file}`;
                                } else if (tool.toolName?.startsWith('codebase_search') && tool.args?.query) {
                                    displayName = `Searching for "${tool.args.query}"`;
                                } else if (tool.toolName?.includes('terminal') && tool.args?.command) {
                                    displayName = `Running command`;
                                }
                                
                                return (
                                    <ToolStatusItem
                                        key={index}
                                        status={tool.status || 'pending'}
                                        label={displayName}
                                        progress={tool.progress}
                                        completed={isCompleted}
                                        failed={isFailed}
                                        duration={durationText}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Timestamp */}
                <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-2 opacity-75">
                    {formatTime(message.timestamp)}
                </div>

                {/* Suggested Actions */}
                {actions.length > 0 && (
                    <div class="suggested-actions mt-3 flex flex-wrap gap-1.5">
                        {actions.map((action, i) => (
                            <Button
                                key={i}
                                variant="outline"
                                size="sm"
                                onClick={() => handleSuggestedActionClick(action)}
                                className="text-xs py-0.5 h-auto bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/30 transition-colors duration-150"
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Action Buttons - Original absolute positioning */}
                <div 
                    class="message-actions flex space-x-1 z-10 transition-all duration-150 ease-out absolute bottom-1 right-1"
                    style={{
                        opacity: showActions ? 1 : 0,
                        transform: showActions ? 'scale(1)' : 'scale(0.95)',
                        pointerEvents: showActions ? 'auto' : 'none',
                    }}
                >
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onCopyMessage(message.id)}
                        title="Copy"
                        className="bg-white/90 dark:bg-gray-800/90 shadow-sm h-6 w-6 rounded-full text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 backdrop-blur-sm"
                    >
                        <CopyIcon className="w-3 h-3"/>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDeleteMessage(message.id)}
                        title="Delete"
                        className="bg-white/90 dark:bg-gray-800/90 shadow-sm h-6 w-6 rounded-full text-gray-600 dark:text-gray-300 hover:text-rose-500 dark:hover:text-rose-400 backdrop-blur-sm"
                    >
                        <DeleteIcon className="w-3 h-3"/>
                    </Button>
                </div>
            </div>
        </div>
    );
};
