import { FunctionalComponent } from 'preact';
import { Ref } from 'preact'; // Import Ref from preact
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SuggestedAction } from '../app'; // Keep SuggestedAction if defined there
import { UiMessage, UiMessageContentPart, UiToolCallPart, UiTextMessagePart, UiImagePart } from '../../../src/common/types'; // Import directly from common types
// Define a UI-specific message type that includes the 'thinking' state
interface DisplayMessage extends UiMessage {
    thinking?: string;
}

interface MessagesAreaProps {
    messages: DisplayMessage[]; // Use the local DisplayMessage type
    suggestedActionsMap: Record<string, SuggestedAction[]>;
    handleSuggestedActionClick: (action: SuggestedAction) => void;
    isStreaming: boolean;
    messagesEndRef: Ref<HTMLDivElement>;
}

// Moved renderContentPart logic here
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
                     class="max-w-full h-auto rounded my-2"
                 />
             );
        case 'tool-call':
            let statusText = `[${part.toolName} requested...]`;
            let statusClass = "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300";

            if (part.status === 'pending') {
                statusText = `[${part.toolName} pending...]`;
                statusClass = "bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100";
            } else if (part.status === 'running') {
                 statusText = `[${part.toolName} ${part.progress ?? ''} running...]`;
                 statusClass = "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 animate-pulse";
            } else if (part.status === 'complete') {
                let resultSummary = part.result !== undefined ? JSON.stringify(part.result) : 'Completed';
                if (resultSummary?.length > 100) resultSummary = resultSummary.substring(0, 97) + '...';
                statusText = `[${part.toolName} completed. Result: ${resultSummary}]`;
                statusClass = "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100";
            } else if (part.status === 'error') {
                statusText = `[${part.toolName} failed. Error: ${part.result ?? 'Unknown'}]`;
                statusClass = "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100";
            }
            const argsString = JSON.stringify(part.args, null, 2);

            return (
                 <div key={part.toolCallId || `tool-${index}`} class={`tool-call-summary block my-1 p-2 rounded text-xs font-mono ${statusClass}`}>
                     <div>{statusText}</div>
                     <details class="mt-1">
                         <summary class="cursor-pointer text-gray-500 dark:text-gray-400 text-xs">Arguments</summary>
                         <pre class="mt-1 text-xs whitespace-pre-wrap break-words">{argsString}</pre>
                     </details>
                 </div>
            );
        default:
             console.warn("Encountered unknown content part type:", (part as any)?.type);
            return null;
    }
};


export const MessagesArea: FunctionalComponent<MessagesAreaProps> = ({
    messages,
    suggestedActionsMap,
    handleSuggestedActionClick,
    isStreaming,
    messagesEndRef
}) => {
    return (
        <div class="messages-area flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
                <div key={msg.id} class={`message flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div class={`message-content p-3 rounded-lg max-w-xs md:max-w-md lg:max-w-lg ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
                        {/* Render Thinking Process */}
                        {msg.sender === 'assistant' && msg.thinking && (
                            <div class="thinking-process mb-2 pb-2 border-b border-gray-300 dark:border-gray-600">
                                <div class="prose dark:prose-invert prose-xs max-w-none text-gray-600 dark:text-gray-400 italic">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {`Thinking:\n${msg.thinking}`}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                        {/* Render Main Content Parts */}
                        {Array.isArray(msg.content) ? msg.content.map(renderContentPart) : null}
                        {/* Render Suggested Actions */}
                        {msg.sender === 'assistant' && suggestedActionsMap[msg.id] && (
                            <div class="suggested-actions mt-2 pt-2 border-t border-gray-300 dark:border-gray-600 flex flex-wrap gap-2">
                                {suggestedActionsMap[msg.id].map((action, actionIndex) => (
                                    <button
                                        key={actionIndex}
                                        onClick={() => handleSuggestedActionClick(action)}
                                        disabled={isStreaming}
                                        class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
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