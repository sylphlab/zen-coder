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
    onSamplePromptSelect?: (prompt: string) => void; // Optional callback for sample prompt selection
}

export const MessagesArea: FunctionalComponent<MessagesAreaProps> = ({
    messages,
    suggestedActionsMap,
    isStreaming,
    handleSuggestedActionClick,
    messagesEndRef,
    onCopyMessage,
    onDeleteMessage,
    className,
    onSamplePromptSelect = () => {} // Default no-op function if not provided
}) => {
    // Sample prompts that can be clicked to auto-fill - focused on real development tasks
    const samplePrompts = [
        "Analyze this code and suggest performance optimizations",
        "Refactor this function to use async/await instead of callbacks",
        "Help me debug this TypeScript error in my React component",
        "Create a Jest test suite for this utility function",
        "Explain the design pattern used in this code and suggest improvements"
    ];
    
    // Handle prompt selection
    const handlePromptSelect = (prompt: string) => {
        if (onSamplePromptSelect) {
            onSamplePromptSelect(prompt);
        }
    };
    return (
        <div class={`messages-area px-2 py-4 space-y-5 flex flex-col ${className ?? ''}`}>
            {/* Show Welcome Message if messages array is empty */}
            {messages.length === 0 ? (
                <div class="flex-1 flex flex-col items-center justify-center px-6 select-none">
                    {/* VS Code-themed welcome screen */}
                    <div class="w-full max-w-2xl">
                        {/* Header with VS Code-themed styling */}
                        <div class="relative mb-8 flex flex-col items-center">
                            {/* VS Code extension badge */}
                            <div class="absolute -top-4 right-0 px-2 py-0.5 text-xs font-semibold rounded flex items-center gap-1 bg-[var(--vscode-activityBarBadge-background,#007acc)] text-[var(--vscode-activityBarBadge-foreground,#ffffff)]">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M13.5 16.5L21 12L13.5 7.5M21 12H3" />
                                </svg>
                                <span>VS Code Extension</span>
                            </div>
                            
                            {/* ZenCoder Logo */}
                            <div class="mb-4 relative flex items-center justify-center">
                                <svg viewBox="0 0 100 100" class="w-24 h-24">
                                    <circle cx="50" cy="50" r="46" fill="none" stroke="var(--vscode-button-background,#0078d4)" stroke-width="3" opacity="0.2" />
                                    <circle cx="50" cy="50" r="38" fill="none" stroke="var(--vscode-button-background,#0078d4)" stroke-width="3" opacity="0.4" />
                                    <circle cx="50" cy="50" r="30" fill="var(--vscode-button-background,#0078d4)" />
                                    
                                    {/* Code-like symbol in the center */}
                                    <path d="M37 50L45 58L63 40" stroke="var(--vscode-button-foreground,#ffffff)" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                                    
                                    {/* Outer pulsing ring animation */}
                                    <circle cx="50" cy="50" r="46" fill="none" stroke="var(--vscode-button-background,#0078d4)" stroke-width="3" opacity="0.2">
                                        <animate attributeName="r" values="46;50;46" dur="3s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" values="0.2;0.4;0.2" dur="3s" repeatCount="indefinite" />
                                    </circle>
                                </svg>
                            </div>
                            
                            {/* Title in VS Code style */}
                            <h1 class="text-4xl font-bold mb-2 text-[var(--vscode-editor-foreground)]">ZenCoder</h1>
                            
                            {/* Subtitle */}
                            <p class="text-xl text-[var(--vscode-descriptionForeground)] mb-2">Open-Source AI Coding Partner</p>
                            
                            {/* Tagline */}
                            <div class="text-center mb-3">
                                <span class="bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] px-2 py-0.5 rounded text-xs inline-block">
                                    Performance • Stability • Efficiency
                                </span>
                            </div>
                        </div>
                        
                        {/* Main content area with VS Code-like panels */}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {/* Core strengths panel */}
                                <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border,rgba(128,128,128,0.35))] rounded overflow-hidden shadow-sm col-span-2">
                                    <div class="bg-[var(--vscode-titleBar-activeBackground)] px-3 py-1.5 text-xs font-medium text-[var(--vscode-titleBar-activeForeground)] flex items-center justify-between">
                                        <span>WHY ZENCODER</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                        </svg>
                                    </div>
                                    <div class="p-4 text-[var(--vscode-editor-foreground)]">
                                        <div class="space-y-3">
                                            <div class="flex items-start">
                                                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--vscode-button-background,#0078d4)] flex items-center justify-center text-[var(--vscode-button-foreground,#ffffff)] text-xs mt-0.5 mr-2">⚡</div>
                                                <div>
                                                    <h3 class="font-semibold">High-Performance & Lightweight</h3>
                                                    <p class="text-sm text-[var(--vscode-descriptionForeground)]">Built for speed and efficiency with minimal resource usage, keeping your development environment responsive</p>
                                                </div>
                                            </div>
                                            <div class="flex items-start">
                                                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--vscode-button-background,#0078d4)] flex items-center justify-center text-[var(--vscode-button-foreground,#ffffff)] text-xs mt-0.5 mr-2">🛠️</div>
                                                <div>
                                                    <h3 class="font-semibold">Development-First Design</h3>
                                                    <p class="text-sm text-[var(--vscode-descriptionForeground)]">Focused on real coding workflows with practical file operations, terminal access, and context-aware assistance</p>
                                                </div>
                                            </div>
                                            <div class="flex items-start">
                                                <div class="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--vscode-button-background,#0078d4)] flex items-center justify-center text-[var(--vscode-button-foreground,#ffffff)] text-xs mt-0.5 mr-2">🔓</div>
                                                <div>
                                                    <h3 class="font-semibold">Open Source & Transparent</h3>
                                                    <p class="text-sm text-[var(--vscode-descriptionForeground)]">Full visibility into how your data is processed, with the freedom to modify and extend functionality</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* AI Providers panel */}
                                <div class="bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border,rgba(128,128,128,0.35))] rounded overflow-hidden shadow-sm">
                                    <div class="bg-[var(--vscode-titleBar-activeBackground)] px-3 py-1.5 text-xs font-medium text-[var(--vscode-titleBar-activeForeground)] flex items-center justify-between">
                                        <span>AI PROVIDERS</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                        </svg>
                                    </div>
                                    <div class="p-4 text-[var(--vscode-editor-foreground)] space-y-2">
                                        {/* This would typically be populated from a store, using placeholder data for now */}
                                        {[
                                            { name: 'Anthropic', color: 'green' },
                                            { name: 'Google', color: 'blue' },
                                            { name: 'OpenRouter', color: 'purple' },
                                            { name: 'DeepSeek', color: 'yellow' },
                                            { name: 'OpenAI', color: 'red' },
                                            { name: 'Vertex AI', color: 'teal' },
                                            { name: 'Ollama', color: 'orange' }
                                        ].map((provider, index) => (
                                            <div key={index} class="flex items-center">
                                                <div class={`w-3 h-3 bg-${provider.color}-500 rounded-full mr-2`}></div>
                                                <span>{provider.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                        </div>
                        
                        {/* Clickable sample prompts in VS Code terminal style */}
                        <div class="w-full bg-[var(--vscode-terminal-background,#1e1e1e)] rounded-md overflow-hidden border border-[var(--vscode-widget-border,rgba(128,128,128,0.35))] mb-6">
                            <div class="bg-[var(--vscode-titleBar-activeBackground)] px-3 py-1.5 text-xs font-medium text-[var(--vscode-titleBar-activeForeground)] flex items-center justify-between">
                                <span>SAMPLE PROMPTS</span>
                                <div class="flex gap-1">
                                    <div class="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiRed,#ff0000)] opacity-80"></div>
                                    <div class="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiYellow,#ffff00)] opacity-80"></div>
                                    <div class="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiGreen,#00ff00)] opacity-80"></div>
                                </div>
                            </div>
                            <div class="p-3 font-mono text-sm space-y-2 text-[var(--vscode-terminal-foreground,#cccccc)]">
                                {samplePrompts.map((prompt, index) => (
                                    <div
                                        key={index}
                                        class="flex cursor-pointer hover:bg-[var(--vscode-list-hoverBackground,rgba(255,255,255,0.1))] p-1 rounded transition-colors group"
                                        onClick={() => handlePromptSelect(prompt)}
                                    >
                                        <span class="text-[var(--vscode-terminal-ansiBlue,#3794ff)] mr-2">{'>'}</span>
                                        <span>{prompt}</span>
                                        <span class="ml-auto text-[var(--vscode-terminal-ansiGreen,#00ff00)] opacity-0 group-hover:opacity-100 transition-opacity">
                                            Click to use
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Prompt tip */}
                        <div class="text-center mb-6">
                            <span class="inline-flex items-center gap-1.5 text-[var(--vscode-descriptionForeground)] text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Click on any sample prompt to use it, or type your own below
                            </span>
                        </div>
                        
                        {/* Add typing animation to keyframes */}
                        <style jsx>{`
                            @keyframes typing {
                                from { width: 0 }
                                to { width: 100% }
                            }
                            
                            @keyframes blink-caret {
                                from, to { border-color: transparent }
                                50% { border-color: var(--vscode-terminal-ansiCyan, #00ffff) }
                            }
                        `}</style>
                    </div>
                </div>
            ) : (
                // Otherwise, render the messages
                messages.map((message) => {
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
                })
            )}

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
                   ${isUser ? 'pl-3 pr-1' : 'pl-1 pr-3'}`}
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
                      ${isUser ? 'max-w-[98%]' : 'max-w-[98%]'} hover:shadow-sm transition-shadow duration-150`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {/* Role indicator and name - Compact design */}
                <div class="flex items-center justify-between mb-1.5">
                    <div class={`text-[10px] font-medium ${isUser ? 'text-gray-500 dark:text-gray-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {isAssistant 
                            ? (message.modelName || message.providerName || 'Assistant')
                            : 'You'
                        }
                    </div>
                    <div class="text-[9px] text-gray-400 dark:text-gray-500 opacity-75">
                        {formatTime(message.timestamp)}
                    </div>
                </div>

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
                        <div class="tool-status-container mt-2 mb-1 text-xs border-t border-black/5 dark:border-white/5 pt-2 opacity-80">
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
                        <div class="tool-status-container mt-2 mb-1 text-xs border-t border-black/5 dark:border-white/5 pt-2">
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

                {/* Suggested Actions */}
                {actions.length > 0 && (
                    <div class="suggested-actions mt-2 flex flex-wrap gap-1.5">
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

                {/* Action Buttons - Positioned at the edge of message bubble */}
                <div 
                    class="message-actions flex space-x-1 z-10 transition-all duration-150 ease-out absolute -bottom-3 right-2"
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
                        className="bg-white/95 dark:bg-gray-800/95 shadow-sm h-7 w-7 rounded-full text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 backdrop-blur-sm border border-black/5 dark:border-white/10"
                    >
                        <CopyIcon className="w-3.5 h-3.5"/>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDeleteMessage(message.id)}
                        title="Delete"
                        className="bg-white/95 dark:bg-gray-800/95 shadow-sm h-7 w-7 rounded-full text-gray-600 dark:text-gray-300 hover:text-rose-500 dark:hover:text-rose-400 backdrop-blur-sm border border-black/5 dark:border-white/10"
                    >
                        <DeleteIcon className="w-3.5 h-3.5"/>
                    </Button>
                </div>
            </div>
        </div>
    );
};
