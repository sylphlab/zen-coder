import { FunctionalComponent, ComponentChildren } from 'preact';
import { Ref } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime'; // Import JSX namespace
import { UiMessage, SuggestedAction, UiToolCallPart } from '../../../src/common/types';
import ReactMarkdown, { Options, ExtraProps } from 'react-markdown'; // Import Options and ExtraProps
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// Choose a style, e.g., vscDarkPlus or oneDark. Ensure it matches VS Code theme variables if possible.
// Using oneDark for now as a common choice.
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
// Removed ToolStatusDisplay import
import { Button } from './ui/Button';
// Removed duplicate ExtraProps import

// --- SVG Icons ---
// Removed unused icons: DeleteIcon, LoadingSpinner, TickIcon, ErrorIcon, ChevronDownIcon, ArrowRightIcon, InfoIcon
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

const ChevronDownIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>
);

const ArrowRightIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3 w-3" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path d="M13.5 16.5L21 12L13.5 7.5M21 12H3" />
    </svg>
);

const InfoIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-4 w-4" }) => (
    <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    // Removed isStreaming prop
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
    // Removed isStreaming prop
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
                <div class="flex-1 flex flex-col items-center justify-center">
                    {/* Enhanced welcome screen with more dynamic styling */}
                    <div class="text-center max-w-lg mx-auto px-6">
                        {/* ZenCoder Logo Animation */}
                        <div class="mb-6 relative mx-auto w-24 h-24">
                            <div class="absolute inset-0 rounded-full bg-[var(--vscode-button-background)] bg-opacity-5 animate-ping"></div>
                            <div class="relative w-24 h-24 rounded-full bg-[var(--vscode-button-background)] bg-opacity-10 flex items-center justify-center">
                                <span class="i-carbon-code h-12 w-12 text-[var(--vscode-button-background)]"></span>
                            </div>
                        </div>
                        
                        {/* Exciting Welcome Title */}
                        <h1 class="text-3xl font-bold mb-3 text-[var(--vscode-foreground)]">
                            <span class="text-[var(--vscode-button-background)]">Zen</span>Coder
                        </h1>
                        
                        {/* Engaging Subtitle */}
                        <h2 class="text-lg font-medium mb-4 text-[var(--vscode-foreground)] opacity-90">
                            Your AI-Powered Coding Partner
                        </h2>
                        
                        {/* More attractive introduction */}
                        <p class="text-sm text-[var(--vscode-foreground)] opacity-80 mb-6 leading-relaxed">
                            👋 Hello! I'm your intelligent coding assistant who understands your code,
                            solves complex problems, and helps turn your ideas into reality.
                            I can help with debugging, refactoring, testing, and explaining code concepts.
                        </p>
                        
                        {/* Feature highlights */}
                        <div class="grid grid-cols-2 gap-3 mb-8">
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left">
                                <div class="flex items-center mb-1.5">
                                    <span class="i-carbon-code-reference h-5 w-5 text-[var(--vscode-button-background)] mr-2"></span>
                                    <span class="font-medium text-[var(--vscode-foreground)]">Code Understanding</span>
                                </div>
                                <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                    I can analyze your code and provide intelligent suggestions.
                                </p>
                            </div>
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left">
                                <div class="flex items-center mb-1.5">
                                    <span class="i-carbon-debug h-5 w-5 text-[var(--vscode-button-background)] mr-2"></span>
                                    <span class="font-medium text-[var(--vscode-foreground)]">Smart Debugging</span>
                                </div>
                                <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                    I help identify and fix bugs with practical solutions.
                                </p>
                            </div>
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left">
                                <div class="flex items-center mb-1.5">
                                    <span class="i-carbon-development h-5 w-5 text-[var(--vscode-button-background)] mr-2"></span>
                                    <span class="font-medium text-[var(--vscode-foreground)]">Code Generation</span>
                                </div>
                                <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                    I can write efficient, maintainable code based on your requirements.
                                </p>
                            </div>
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left">
                                <div class="flex items-center mb-1.5">
                                    <span class="i-carbon-chart-multitype h-5 w-5 text-[var(--vscode-button-background)] mr-2"></span>
                                    <span class="font-medium text-[var(--vscode-foreground)]">Learning Resources</span>
                                </div>
                                <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                    I can explain concepts and provide learning materials.
                                </p>
                            </div>
                        </div>
                        
                        {/* Sample prompts with better styling */}
                        <div class="mb-6">
                            <p class="text-sm font-medium text-[var(--vscode-foreground)] mb-3">Try asking me about:</p>
                            <div class="grid gap-2">
                                {samplePrompts.map((prompt, index) => (
                                    <div
                                        key={index}
                                        class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left cursor-pointer hover:bg-[var(--vscode-button-background)] hover:bg-opacity-10 hover:shadow-md transition-all duration-200 text-sm"
                                        onClick={() => handlePromptSelect(prompt)}
                                    >
                                        <div class="flex items-center">
                                            <div class="w-8 h-8 rounded-full bg-[var(--vscode-button-background)] bg-opacity-10 flex items-center justify-center flex-shrink-0 mr-3">
                                                <span class="i-carbon-code h-4 w-4 text-[var(--vscode-button-background)]"></span>
                                            </div>
                                            <span class="text-[var(--vscode-foreground)]">{prompt}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* More engaging call to action */}
                        <div class="bg-[var(--vscode-button-background)] bg-opacity-10 rounded-lg p-4 text-center mb-4">
                            <p class="text-sm font-medium text-[var(--vscode-button-background)] mb-2">Ready to start coding together?</p>
                            <div class="text-xs text-[var(--vscode-foreground)] opacity-80 flex items-center justify-center gap-2">
                                <span class="i-carbon-arrow-down animate-bounce h-4 w-4"></span>
                                <span>Type a message below or select a suggestion above</span>
                                <span class="i-carbon-arrow-down animate-bounce h-4 w-4"></span>
                            </div>
                        </div>
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
        <div class="flex items-center space-x-2 text-xs my-1 text-[var(--vscode-foreground)] opacity-70">
            {completed ? (
                <span class="i-carbon-checkmark h-3.5 w-3.5 text-[var(--vscode-notificationsInfoIcon)]"></span>
            ) : failed ? (
                <span class="i-carbon-close h-3.5 w-3.5 text-[var(--vscode-notificationsErrorIcon)]"></span>
            ) : (
                <span class="i-carbon-rotate-clockwise animate-spin h-3 w-3 text-[var(--vscode-button-background)]"></span>
            )}
            
            <div class="flex items-center space-x-1">
                <span class={`${completed ? 'line-through opacity-70' : ''} ${failed ? 'line-through text-[var(--vscode-notificationsErrorIcon)]' : ''}`}>
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
            class="message-container w-full mb-6"
            style={{ 
                animation: `fadeIn 250ms ease-out forwards`, 
                opacity: 0 
            }}
            ref={messageRef}
        >
            {/* Conversation style with avatars */}
            <div class={`flex ${isUser ? 'justify-end' : ''}`}>
                {/* Assistant avatar at left */}
                {!isUser && (
                    <div class="w-10 h-10 rounded-full bg-[var(--vscode-button-background)] bg-opacity-20 flex items-center justify-center flex-shrink-0 mt-1">
                        <span class="i-carbon-chat-bot h-5 w-5 text-[var(--vscode-button-background)]"></span>
                    </div>
                )}
                
                {/* Message bubble */}
                <div
                    class={`relative group max-w-[80%] ${isUser ? 'ml-auto mr-12' : 'ml-3'}`}
                    onMouseEnter={() => setShowActions(true)}
                    onMouseLeave={() => setShowActions(false)}
                >
                    <div 
                        class={`rounded-xl p-4 shadow-sm ${isUser 
                            ? 'bg-[var(--vscode-editor-background)] rounded-tr-none'
                            : 'bg-[var(--vscode-editorWidget-background)] rounded-tl-none'
                        } hover:shadow transition-shadow duration-150`}
                    >
                        {/* Model name badge for assistant / timestamps for both */}
                        <div class="flex items-center justify-between mb-2 text-xs">
                            {isAssistant ? (
                                <span class="bg-[var(--vscode-button-background)] bg-opacity-10 px-2 py-0.5 rounded-full text-[var(--vscode-button-background)]">
                                    {message.modelName || message.providerName || 'ZenCoder'}
                                </span>
                            ) : (
                                <span class="opacity-0">You</span>
                            )}
                            <div class="text-[10px] text-[var(--vscode-descriptionForeground)]">
                                {formatTime(message.timestamp)}
                            </div>
                        </div>

                        {/* Message content */}
                        <div 
                            ref={messageContentRef}
                            class="message-content text-sm text-[var(--vscode-foreground)]"
                        >
                            {message.content.map((part, index) => {
                                if (part.type === 'text') {
                                    // Wrap ReactMarkdown in a div to apply prose styles
                                    return (
                                        <div key={index} className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]} // Enable GitHub Flavored Markdown
                                                rehypePlugins={[rehypeRaw]} // Allow raw HTML (use with caution)
                                                components={{
                                                    // Use node properties to differentiate block vs inline code
                                                    // Correct type annotation using imported JSX and ExtraProps
                                                    code(props: JSX.IntrinsicElements['code'] & ExtraProps) {
                                                        const { children, className, node, ...rest } = props;
                                                        // Ensure className is a string before matching
                                                        const languageClassName = typeof className === 'string' ? className : '';
                                                        const match = /language-(\w+)/.exec(languageClassName);
                                                        const codeText = String(children).replace(/\n$/, ''); // Remove trailing newline

                                                        // Check if it's a block code (parent is <pre>)
                                                        // Safely check node.properties.className
                                                        const nodeProperties = node?.properties || {};
                                                        const nodeClassName = nodeProperties.className;
                                                        const isBlock = Array.isArray(nodeClassName) && nodeClassName.some((cn) => typeof cn === 'string' && cn.startsWith('language-'));


                                                        return isBlock && match ? (
                                                            <div class="code-block relative group/code my-3">
                                                                <SyntaxHighlighter
                                                                    style={oneDark as any} // Cast style to any to bypass potential type issue
                                                                    language={String(match[1])} // Explicitly cast language to string
                                                                    PreTag="div"
                                                                    className="!bg-[var(--vscode-editor-background)] !p-3 !rounded !text-xs !font-mono overflow-x-auto" // Override default style background/padding
                                                                    {...rest} // Pass down other props
                                                                >
                                                                    {codeText}
                                                                </SyntaxHighlighter>
                                                                <button
                                                                    onClick={() => navigator.clipboard.writeText(codeText)}
                                                                    class="absolute top-1.5 right-1.5 p-1 rounded bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] opacity-0 group-hover/code:opacity-100 transition-opacity duration-150"
                                                                    title="Copy code"
                                                                >
                                                                    <CopyIcon className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            // Inline code
                                                            <code className={`bg-[var(--vscode-editorWidget-background)] px-1.5 py-0.5 rounded text-xs font-mono ${className ?? ''}`} {...rest}>
                                                                {children}
                                                            </code>
                                                        );
                                                    },
                                                    // Ensure links open externally
                                                    // Correct type annotation using imported JSX and ExtraProps
                                                    a: ({ node, ...props }: JSX.IntrinsicElements['a'] & ExtraProps) => <a target="_blank" rel="noopener noreferrer" {...props} />,
                                                    // Add basic list styling if prose classes aren't sufficient
                                                    // Correct type annotation using imported JSX and ExtraProps
                                                    ul: ({ node, ...props }: JSX.IntrinsicElements['ul'] & ExtraProps) => <ul class="list-disc list-inside my-2 pl-4" {...props} />,
                                                    ol: ({ node, ...props }: JSX.IntrinsicElements['ol'] & ExtraProps) => <ol class="list-decimal list-inside my-2 pl-4" {...props} />,
                                                    li: ({ node, ...props }: JSX.IntrinsicElements['li'] & ExtraProps) => <li class="mb-1" {...props} />,
                                                } as Options['components']} // Cast components object to satisfy Options type
                                            >
                                                {part.text}
                                            </ReactMarkdown>
                                        </div>
                                    );
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
                            {/* Pending status indicator */}
                            {isAssistant && message.status === 'pending' && (
                                <div class="mt-2 pt-2 border-t border-[var(--vscode-foreground)] border-opacity-10">
                                    <div class="flex items-center text-[var(--vscode-button-background)] opacity-80">
                                        <span class="i-carbon-rotate-clockwise animate-spin h-3 w-3 mr-1.5"></span>
                                        <span class="text-xs" style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>
                                            Working...
                                        </span>
                                    </div>
                                </div>
                            )}
                            
                            {/* Error status indicator */}
                            {isAssistant && message.status === 'error' && (
                                <div class="mt-2 pt-2 border-t border-[var(--vscode-foreground)] border-opacity-10">
                                    <div class="flex items-center text-[var(--vscode-notificationsErrorIcon)]">
                                        <span class="i-carbon-warning-alt h-3.5 w-3.5 mr-1.5"></span>
                                        <span class="text-xs">Error generating response.</span>
                                        {/* TODO: Add retry button? */}
                                    </div>
                                </div>
                            )}

                            {/* Custom tool status display */}
                            {isAssistant && toolCallParts.length > 0 && (
                                <div class="mt-3 pt-3 border-t border-[var(--vscode-foreground)] border-opacity-10 space-y-1">
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
                            <div class="suggested-actions mt-3 flex flex-wrap gap-1.5">
                                {actions.map((action, i) => (
                                    <Button
                                        key={i}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSuggestedActionClick(action)}
                                        className="text-xs py-0.5 h-auto bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-button-background)] hover:bg-opacity-10 transition-colors duration-150"
                                    >
                                        {action.label}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* User avatar for user messages */}
                    {isUser && (
                        <div class="w-10 h-10 rounded-full bg-[var(--vscode-editor-background)] flex items-center justify-center absolute right-[-38px] top-0">
                            <span class="i-carbon-user h-5 w-5 text-[var(--vscode-foreground)] opacity-70"></span>
                        </div>
                    )}

                    {/* Action Buttons - Positioned at the edge of message bubble */}
                    <div 
                        class="message-actions flex space-x-1 z-10 transition-all duration-150 ease-out absolute top-2 right-2"
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
                            className="bg-[var(--vscode-editor-background)] opacity-90 shadow-sm h-6 w-6 rounded-full text-[var(--vscode-foreground)] hover:text-[var(--vscode-button-background)]"
                        >
                            <span class="i-carbon-copy w-3 h-3"></span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDeleteMessage(message.id)}
                            title="Delete"
                            className="bg-[var(--vscode-editor-background)] opacity-90 shadow-sm h-6 w-6 rounded-full text-[var(--vscode-foreground)] hover:text-[var(--vscode-notificationsErrorIcon)]"
                        >
                            <span class="i-carbon-trash-can w-3 h-3"></span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
