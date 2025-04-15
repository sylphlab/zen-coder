import { FunctionalComponent } from 'preact';
// Add UiMessageContentPart, remove unused UiTextMessagePart
import { UiMessage, SuggestedAction, UiToolCallPart, UiImagePart, UiMessageContentPart } from '../../../src/common/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ClipboardIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'; // Use outline icons
import { memo } from 'preact/compat'; // Import memo for optimization

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
  messages: UiMessage[];
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

// Component for rendering Tool Calls
const ToolCallPart: FunctionalComponent<{ part: UiToolCallPart }> = ({ part }) => {
    let statusIndicator = '';
    if (part.status === 'pending' || part.status === 'running') {
        statusIndicator = ' (Running...)';
    } else if (part.status === 'error') {
        statusIndicator = ' (Error)';
    } else if (part.status === 'complete') {
        statusIndicator = ' (Completed)';
    }

    return (
        <div class="my-2 p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">
            <p class="font-semibold text-sm text-gray-600 dark:text-gray-300">
                <ArrowPathIcon class="inline-block w-4 h-4 mr-1 animate-spin" /> Tool Call: {part.toolName}{statusIndicator}
            </p>
            <pre class="text-xs mt-1 whitespace-pre-wrap"><code>{JSON.stringify(part.args, null, 2)}</code></pre>
            {part.result && part.status === 'complete' && (
                 <pre class="text-xs mt-1 pt-1 border-t border-gray-200 dark:border-gray-500 whitespace-pre-wrap"><code>Result: {JSON.stringify(part.result, null, 2)}</code></pre>
            )}
             {part.result && part.status === 'error' && (
                 <pre class="text-xs mt-1 pt-1 border-t border-red-200 dark:border-red-500 text-red-600 dark:text-red-400 whitespace-pre-wrap"><code>Error: {JSON.stringify(part.result, null, 2)}</code></pre>
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
                 {/* Display Loading Indicator if pending */}
                 {isPending ? (
                     <div class="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                          <ArrowPathIcon class="animate-spin h-4 w-4" />
                          <span>Thinking...</span>
                     </div>
                 ) : (
                      /* Render actual content if not pending */
                      Array.isArray(message.content) && message.content.map((part, index) => (
                           <MessageContentPart key={index} part={part} isStreaming={isStreaming && index === message.content.length - 1} />
                      ))
                 )}

                {/* Actions (Copy/Delete) - Show only for non-pending messages */}
                {!isPending && (
                     <div class="flex justify-end space-x-2 mt-2 opacity-50 group-hover:opacity-100 transition-opacity duration-150">
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
    console.log(`[MessagesArea Render] Rendering. Messages count: ${messages.length}.`);
    const lastMessage = messages[messages.length - 1];
    console.log(`[MessagesArea Render] Last message ID: ${lastMessage?.id}, Role: ${lastMessage?.role}`);

    return (
        <div class={`p-4 ${className || ''}`}>
            {messages.map((msg) => {
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
};
