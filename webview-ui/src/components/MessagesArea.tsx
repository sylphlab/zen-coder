import { FunctionalComponent } from 'preact';
import { Ref } from 'preact';
// Restore markdown/syntax highlighting imports
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SuggestedAction, UiMessage, UiMessageContentPart, UiToolCallPart, UiTextMessagePart, UiImagePart } from '../../../src/common/types';

interface MessagesAreaProps {
    messages: UiMessage[];
    suggestedActionsMap: Record<string, SuggestedAction[]>;
    isStreaming: boolean;
    handleSuggestedActionClick: (action: SuggestedAction) => void;
    messagesEndRef: Ref<HTMLDivElement>;
    onCopyMessage: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
    className?: string;
}

// Restore original renderContentPart
const renderContentPart = (part: UiMessageContentPart, index: number) => {
    switch (part.type) {
        case 'text':
            return (
                <div key={`text-${index}`} className="prose dark:prose-invert prose-sm max-w-none">
                     <ReactMarkdown
                         remarkPlugins={[remarkGfm]}
                         components={{
                             code({ node, className, children, ...props }) {
                                 const match = /language-(\w+)/.exec(String(className || ''));
                                 const language = match ? match[1] : undefined;
                                 const codeText = String(children).replace(/\n$/, '');

                                 return language ? (
                                     <SyntaxHighlighter
                                         style={vscDarkPlus as any}
                                         language={language}
                                         PreTag="div"
                                         // @ts-ignore
                                         {...props}
                                     >
                                         {codeText}
                                     </SyntaxHighlighter>
                                 ) : (
                                     <code className={className} {...props}>
                                         {children}
                                     </code>
                                 );
                             }
                         }}
                     >
                         {part.text}
                     </ReactMarkdown>
                </div>
            );
        case 'image':
             return (
                 <img
                     key={`image-${index}`}
                     src={`data:${part.mediaType};base64,${part.data}`}
                     alt="User uploaded content"
                     class="max-w-full h-auto rounded my-2" // Restored original size
                 />
             );
        case 'tool-call':
             let statusText = `[${part.toolName} requested...]`;
             let statusClass = "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300";
             if (part.status === 'pending') { statusText = `[${part.toolName} pending...]`; statusClass = "bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100"; }
             else if (part.status === 'running') { statusText = `[${part.toolName} ${part.progress ?? ''} running...]`; statusClass = "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 animate-pulse"; }
             else if (part.status === 'complete') { let res = part.result !== undefined ? JSON.stringify(part.result) : 'Completed'; if (res?.length > 100) res = res.substring(0, 97) + '...'; statusText = `[${part.toolName} completed. Result: ${res}]`; statusClass = "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100"; }
             else if (part.status === 'error') { statusText = `[${part.toolName} failed. Error: ${part.result ?? 'Unknown'}]`; statusClass = "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100"; }
             const argsString = JSON.stringify(part.args, null, 2);
             return ( <div key={part.toolCallId || `tool-${index}`} class={`tool-call-summary block my-1 p-2 rounded text-xs font-mono ${statusClass}`}> <div>{statusText}</div> <details class="mt-1"> <summary class="cursor-pointer text-gray-500 dark:text-gray-400 text-xs">Arguments</summary> <pre class="mt-1 text-xs whitespace-pre-wrap break-words">{argsString}</pre> </details> </div> );
        default:
             console.warn("Encountered unknown content part type:", (part as any)?.type);
            return null;
    }
};


export const MessagesArea: FunctionalComponent<MessagesAreaProps> = ({
    handleSuggestedActionClick,
    messagesEndRef,
    onCopyMessage,
    onDeleteMessage,
    messages,
    suggestedActionsMap,
    isStreaming,
    className
}) => {
    console.log(`[MessagesArea Original Render] Rendering ${messages.length} messages.`);

    return (
        <div class={`messages-area flex-1 overflow-y-auto p-4 space-y-4 ${className ?? ''}`}>
            {messages.map((msg) => (
                <div key={msg.id} class={`message group relative flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {/* Action buttons */}
                    <div class={`message-actions absolute top-0 mx-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${msg.role === 'user' ? 'right-full mr-1' : 'left-full ml-1'}`}>
                        <button onClick={() => onCopyMessage(msg.id)} title="Copy Message" class="p-1 rounded bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"> <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /> </svg> </button>
                        <button onClick={() => onDeleteMessage(msg.id)} title="Delete Message" class="p-1 rounded bg-red-200 dark:bg-red-800 hover:bg-red-300 dark:hover:bg-red-700 text-red-700 dark:text-red-200"> <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"> <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> </svg> </button>
                    </div>
                    {/* Message content */}
                    <div class={`message-content p-3 rounded-lg max-w-xs md:max-w-md lg:max-w-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                        {Array.isArray(msg.content) ? msg.content.map(renderContentPart) : null}
                        {/* Suggested Actions */}
                        {msg.role === 'assistant' && suggestedActionsMap[msg.id] && (
                            <div class="suggested-actions mt-2 pt-2 border-t border-gray-300 dark:border-gray-600 flex flex-wrap gap-2">
                                {suggestedActionsMap[msg.id].map((action, actionIndex) => (
                                    <button key={actionIndex} onClick={() => handleSuggestedActionClick(action)} disabled={isStreaming} class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
    );
};
