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

// Removed SVG Icon components - using UnoCSS icons directly

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
                            {/* Removed bg-opacity-5 */}
                            <div class="absolute inset-0 rounded-full bg-[var(--vscode-button-background)] animate-ping"></div>
                            {/* Removed bg-opacity-10 */}
                            <div class="relative w-24 h-24 rounded-full bg-[var(--vscode-button-background)] flex items-center justify-center">
                                <span class="i-carbon-code h-12 w-12 text-[var(--vscode-button-foreground)]"></span> {/* Changed icon color for contrast */}
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
                                {/* Use descriptionForeground for better contrast */}
                                <p class="text-xs text-[var(--vscode-descriptionForeground)]">
                                    I can analyze your code and provide intelligent suggestions.
                                </p>
                            </div>
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left">
                                <div class="flex items-center mb-1.5">
                                    <span class="i-carbon-debug h-5 w-5 text-[var(--vscode-button-background)] mr-2"></span>
                                    <span class="font-medium text-[var(--vscode-foreground)]">Smart Debugging</span>
                                </div>
                                {/* Use descriptionForeground for better contrast */}
                                <p class="text-xs text-[var(--vscode-descriptionForeground)]">
                                    I help identify and fix bugs with practical solutions.
                                </p>
                            </div>
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left">
                                <div class="flex items-center mb-1.5">
                                    <span class="i-carbon-development h-5 w-5 text-[var(--vscode-button-background)] mr-2"></span>
                                    <span class="font-medium text-[var(--vscode-foreground)]">Code Generation</span>
                                </div>
                                {/* Use descriptionForeground for better contrast */}
                                <p class="text-xs text-[var(--vscode-descriptionForeground)]">
                                    I can write efficient, maintainable code based on your requirements.
                                </p>
                            </div>
                            <div class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left">
                                <div class="flex items-center mb-1.5">
                                    <span class="i-carbon-chart-multitype h-5 w-5 text-[var(--vscode-button-background)] mr-2"></span>
                                    <span class="font-medium text-[var(--vscode-foreground)]">Learning Resources</span>
                                </div>
                                {/* Use descriptionForeground for better contrast */}
                                <p class="text-xs text-[var(--vscode-descriptionForeground)]">
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
                                        
                                        class="bg-[var(--vscode-editorWidget-background)] rounded-lg p-3 text-left cursor-pointer hover:bg-[var(--vscode-button-background)] transition-all duration-200 text-sm"
                                        onClick={() => handlePromptSelect(prompt)}
                                    >
                                        <div class="flex items-center">
                                            {/* Removed bg-opacity-10 */}
                                            <div class="w-8 h-8 rounded-full bg-[var(--vscode-button-background)] flex items-center justify-center flex-shrink-0 mr-3">
                                                <span class="i-carbon-code h-4 w-4 text-[var(--vscode-button-foreground)]"></span> {/* Changed icon color for contrast */}
                                            </div>
                                            <span class="text-[var(--vscode-foreground)]">{prompt}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* More engaging call to action */}
                        {/* Removed bg-opacity-10 */}
                        <div class="bg-[var(--vscode-button-background)] rounded-lg p-4 text-center mb-4">
                            <p class="text-sm font-medium text-[var(--vscode-button-foreground)] mb-2">Ready to start coding together?</p> {/* Changed text color */}
                            <div class="text-xs text-[var(--vscode-button-foreground)] opacity-80 flex items-center justify-center gap-2"> {/* Changed text color */}
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
    const [isToolSectionExpanded, setIsToolSectionExpanded] = useState(false); // State for tool section collapse
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
                        class={`rounded-xl p-4 ${isUser
                            ? 'bg-[var(--vscode-editor-background)] rounded-tr-none'
                            : 'bg-[var(--vscode-editorWidget-background)] rounded-tl-none'
                        } transition-colors duration-150`} // Removed shadows
                    >
                        {/* Model name badge for assistant / timestamps for both */}
                        <div class="flex items-center justify-between mb-2 text-xs">
                            {isAssistant ? (
                                /* Removed bg-opacity-10 */
                                <span class="bg-[var(--vscode-button-background)] px-2 py-0.5 rounded-full text-[var(--vscode-button-foreground)]">
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
                            // Apply specific text color for user messages
                            class={`message-content text-sm ${isUser ? 'text-[var(--vscode-list-activeSelectionForeground)]' : 'text-[var(--vscode-foreground)]'}`}
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
                                                                    <span class="i-carbon-copy h-3 w-3"></span>
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
                                        {/* Display specific error details if available */}
                                        <span class="text-xs">{message.errorDetails || 'Error generating response.'}</span>
                                        {/* TODO: Add retry button? */}
                                    </div>
                                </div>
                            )}

                            {/* Custom tool status display - Collapsible */}
                            {isAssistant && toolCallParts.length > 0 && (
                                <div class="mt-3 pt-3 border-t border-[var(--vscode-foreground)] border-opacity-10">
                                    {/* Clickable Header */}
                                    <div
                                        class="flex items-center justify-between cursor-pointer text-xs text-[var(--vscode-foreground)] opacity-80 hover:opacity-100 mb-1"
                                        onClick={() => setIsToolSectionExpanded(!isToolSectionExpanded)}
                                    >
                                        <div class="flex items-center gap-1">
                                            <span class={`transition-transform transform ${isToolSectionExpanded ? 'rotate-90' : ''} i-carbon-chevron-right h-3 w-3`}></span>
                                            <span>Tool Calls ({toolCallParts.length})</span>
                                        </div>
                                        {/* Optional: Add a subtle indicator like ... if collapsed? */}
                                    </div>
                                    {/* Collapsible Content */}
                                    {isToolSectionExpanded && (
                                        <div class="space-y-1 pl-4"> {/* Indent content slightly */}
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
                                        /* Removed hover:bg-opacity-10 */
                                        className="text-xs py-0.5 h-auto bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-button-background)] transition-colors duration-150"
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
                            /* Removed shadow-sm */
                            className="bg-[var(--vscode-editor-background)] opacity-90 h-6 w-6 rounded-full text-[var(--vscode-foreground)] hover:text-[var(--vscode-button-background)]"
                        >
                            <span class="i-carbon-copy w-3 h-3"></span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDeleteMessage(message.id)}
                            title="Delete"
                            /* Removed shadow-sm */
                            className="bg-[var(--vscode-editor-background)] opacity-90 h-6 w-6 rounded-full text-[var(--vscode-foreground)] hover:text-[var(--vscode-notificationsErrorIcon)]"
                        >
                            <span class="i-carbon-trash-can w-3 h-3"></span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
