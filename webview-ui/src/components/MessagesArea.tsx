import { FunctionalComponent } from 'preact';
// Add UiMessageContentPart, remove unused UiTextMessagePart
import { UiMessage, SuggestedAction, UiToolCallPart, UiImagePart, UiMessageContentPart } from '../../../src/common/types'; // Corrected path again
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ClipboardIcon, TrashIcon, ArrowPathIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'; // Use outline icons
import { memo } from 'preact/compat'; // Import memo for optimization
import { useState } from 'preact/hooks'; // Import useState

// --- Component Types ---

interface MessageContentPartProps {
  part: UiMessageContentPart; // Use the imported type
  isStreaming?: boolean; // Indicate if the message part is being streamed
}

interface MessageProps {
  message: UiMessage;
  isStreaming?: boolean; // Added to MessageProps
  suggestedActions: SuggestedAction[] | undefined;
  handleSuggestedActionClick: (action: SuggestedAction) => void;
  onCopy: (messageId: string) => void;
  onDelete: (messageId: string) => void;
}

export interface MessagesAreaProps {
  messages: UiMessage[]; // This now comes from the store (optimistic ?? actual)
  // removed optimisticMessages prop
  suggestedActionsMap: { [messageId: string]: SuggestedAction[] | undefined };
  isStreaming: boolean; // Overall streaming status
  handleSuggestedActionClick: (action: SuggestedAction) => void;
  messagesEndRef: preact.RefObject<HTMLDivElement>;
  onCopyMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  className?: string;
}

// --- Helper Components ---

// Memoized component for rendering code blocks
const CodeBlock: FunctionalComponent<{ language: string | undefined; children: string }> = memo(({ language, children }) => {
    return (
        <SyntaxHighlighter
            style={oneDark as any} // Cast needed due to potential style type mismatch
            language={language || 'text'}
            PreTag="div"
        >
            {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
    );
});

// Component for rendering Tool Calls (Collapsible)
// Component for rendering Tool Calls (Collapsible)
const ToolCallPart: FunctionalComponent<{ part: UiToolCallPart }> = ({ part }) => {
    const [isExpanded, setIsExpanded] = useState(false); // Default to collapsed

    let statusIcon = <ArrowPathIcon class="inline-block w-4 h-4 mr-1 animate-spin" />;
    let statusText = 'Running...';
    let statusColor = 'text-gray-600 dark:text-gray-300'; // Default/Running color

    if (part.status === 'error') {
        // Use ChevronRightIcon when collapsed, ChevronDownIcon when expanded for error state
        statusIcon = isExpanded
            ? <ChevronDownIcon class="inline-block w-4 h-4 mr-1 text-red-500" />
            : <ChevronRightIcon class="inline-block w-4 h-4 mr-1 text-red-500" />;
        statusText = 'Error';
        statusColor = 'text-red-600 dark:text-red-400';
    } else if (part.status === 'complete') {
         // Use ChevronRightIcon when collapsed, ChevronDownIcon when expanded for complete state
        statusIcon = isExpanded
            ? <ChevronDownIcon class="inline-block w-4 h-4 mr-1 text-green-500" />
            : <ChevronRightIcon class="inline-block w-4 h-4 mr-1 text-green-500" />;
        statusText = 'Completed';
        statusColor = 'text-green-600 dark:text-green-400';
    }
    // Keep spinner only for pending/running, otherwise use state-dependent icon
    const displayIcon = (part.status === 'pending' || part.status === 'running') ? statusIcon : statusIcon;


    const toggleExpand = () => setIsExpanded(!isExpanded);

    return (
        <div class="my-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 overflow-hidden">
            {/* Clickable Header */}
            <div
                class="p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
                onClick={toggleExpand}
                role="button"
                aria-expanded={isExpanded}
            >
                <p class={`font-semibold text-sm ${statusColor}`}>
                    {displayIcon} Tool Call: {part.toolName}
                    {/* Show status text only if not pending/running */}
                    {(part.status !== 'pending' && part.status !== 'running') && ` (${statusText})`}
                </p>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div class="p-3 border-t border-gray-200 dark:border-gray-500">
                    <p class="text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">Arguments:</p>
                    <pre class="text-xs whitespace-pre-wrap bg-white dark:bg-gray-800 p-2 rounded"><code>{JSON.stringify(part.args, null, 2)}</code></pre>

                    {part.result && part.status === 'complete' && (
                        <>
                            <p class="text-xs font-medium mt-2 mb-1 text-gray-500 dark:text-gray-400">Result:</p>
                            <pre class="text-xs whitespace-pre-wrap bg-white dark:bg-gray-800 p-2 rounded"><code>{JSON.stringify(part.result, null, 2)}</code></pre>
                        </>
                    )}
                    {part.result && part.status === 'error' && (
                         <>
                            <p class="text-xs font-medium mt-2 mb-1 text-red-500 dark:text-red-400">Error:</p>
                            <pre class="text-xs whitespace-pre-wrap bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-700 dark:text-red-300"><code>{JSON.stringify(part.result, null, 2)}</code></pre>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// Component for rendering Images
const ImagePart: FunctionalComponent<{ part: UiImagePart }> = ({ part }) => {
     // Check if data is Base64 or Data URI
     const src = part.data.startsWith('data:') ? part.data : `data:${part.mediaType};base64,${part.data}`;
    return (
        <div class="my-2">
             <img src={src} alt="Uploaded content" class="max-w-xs max-h-64 rounded" />
        </div>
    );
};

// Component to render individual content parts
const MessageContentPart: FunctionalComponent<MessageContentPartProps> = ({ part }) => {
    switch (part.type) {
        case 'text':
            return (
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]} // Allows rendering HTML within Markdown
                    components={{
                        code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                                <CodeBlock language={match[1]} {...props}>
                                    {String(children)}
                                </CodeBlock>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            );
                        },
                        // Add custom renderers if needed (e.g., for tables, links)
                    }}
                >
                    {part.text}
                </ReactMarkdown>
            );
        case 'tool-call':
            return <ToolCallPart part={part} />;
        case 'image':
            return <ImagePart part={part} />;
        default:
            console.warn("Unknown message part type:", part);
            return null;
    }
};

// --- Main Message Component ---

const Message: FunctionalComponent<MessageProps> = memo(({ message, isStreaming, suggestedActions, handleSuggestedActionClick, onCopy, onDelete }) => {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const isPending = isAssistant && message.status === 'pending'; // Check for pending status

    const handleCopy = () => onCopy(message.id);
    const handleDelete = () => onDelete(message.id);

    console.log(`[Message Render] ID: ${message.id}, Role: ${message.role}, Status: ${message.status}, isStreaming: ${isStreaming}, isPending: ${isPending}, Content Parts: ${message.content?.length ?? 0}`);


    return (
        <div class={`flex mb-4 ${isUser ? 'justify-end' : ''}`}>
            <div class={`p-3 rounded-lg max-w-xl lg:max-w-2xl xl:max-w-3xl ${isUser ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                {/* Model/Provider Info - Moved ABOVE content */}
                {isAssistant && !isPending && (message.modelName || message.providerName) && (
                    // Log before returning the JSX
                    (console.log(`[Message Render - Model Info] ID: ${message.id}, ModelName: ${message.modelName}, ModelId: ${message.modelId}, ProviderName: ${message.providerName}`),
                    <div class="mb-1 text-xs"> {/* Add margin-bottom */}
                        {/* Add title attribute for tooltip */}
                        <span class="text-gray-900 dark:text-gray-100" title={message.modelId || 'Unknown Model ID'}>
                            {message.modelName || message.modelId} {/* Display modelName, fallback to modelId */}
                        </span>
                        {message.providerName && (
                            <span class="text-gray-400 dark:text-gray-500"> via {message.providerName}</span>
                        )}
                    </div>
                    )
                )}

                 {/* Display Loading Indicator if pending */}
                 {isPending ? (
                     <div class="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                          <ArrowPathIcon class="animate-spin h-4 w-4" />
                          <span>Thinking...</span>
                     </div>
                 ) : (
                      /* Render actual content if not pending */
                      Array.isArray(message.content) && message.content.map((part: UiMessageContentPart, index: number) => (
                           <MessageContentPart key={index} part={part} isStreaming={isStreaming && index === message.content.length - 1} />
                      ))
                 )}


                {/* Actions (Copy/Delete) - Show only for non-pending messages */}
                {!isPending && (
                     <div class="flex justify-end space-x-2 mt-1 opacity-50 group-hover:opacity-100 transition-opacity duration-150"> {/* Adjusted margin-top */}
                         <button onClick={handleCopy} class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="Copy">
                             <ClipboardIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
                         </button>
                         <button onClick={handleDelete} class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="Delete">
                             <TrashIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
                         </button>
                     </div>
                )}
                {/* Suggested Actions - Show only for the last assistant message when not streaming and not pending */}
                 {!isUser && !isStreaming && !isPending && suggestedActions && suggestedActions.length > 0 && (
                     <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex flex-wrap gap-2">
                         {suggestedActions.map((action, index) => (
                             <button
                                 key={index}
                                 onClick={() => handleSuggestedActionClick(action)}
                                 class="text-xs bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 py-1 px-2 rounded"
                             >
                                 {action.label}
                             </button>
                         ))}
                     </div>
                 )}
            </div>
        </div>
    );
});

// --- Messages Area Component ---

export const MessagesArea: FunctionalComponent<MessagesAreaProps> = memo(({ // Wrap with memo
    messages, // This is the combined list from the store
    // removed optimisticMessages prop
    suggestedActionsMap,
    isStreaming,
    handleSuggestedActionClick,
    messagesEndRef,
    onCopyMessage,
    onDeleteMessage,
    className
}) => {
    console.log(`[MessagesArea Render] Rendering. Messages count: ${messages.length}.`);
    const lastMessage = messages[messages.length - 1];
    console.log(`[MessagesArea Render] Last message ID: ${lastMessage?.id}, Role: ${lastMessage?.role}`);

    return (
        <div class={`p-4 ${className || ''}`}>
            {messages.map((msg: UiMessage) => { // Add type to msg
                 const isLastMessage = msg.id === lastMessage?.id;
                // Only pass suggested actions to the last assistant message
                 const actionsForThisMessage = (isLastMessage && msg.role === 'assistant') ? suggestedActionsMap[msg.id] : undefined;

                return (
                     <Message
                         key={msg.id}
                         message={msg}
                         // Pass overall streaming status only if it's the last message
                         isStreaming={isStreaming && isLastMessage}
                         suggestedActions={actionsForThisMessage}
                         handleSuggestedActionClick={handleSuggestedActionClick}
                         onCopy={onCopyMessage}
                         onDelete={onDeleteMessage}
                     />
                 );
            })}
            <div ref={messagesEndRef} />
        </div>
    );
}); // Close memo wrapper
