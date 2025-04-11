// @ts-check

// This script runs in the context of the webview panel
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const messageList = document.getElementById('message-list');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    if (!messageList || !userInput || !sendButton) {
        console.error('Required UI elements not found!');
        return;
    }

    // Function to add a message to the chat display
    function addMessage(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender === 'user' ? 'user-message' : 'assistant-message');

        // Basic Markdown rendering for code blocks (can be improved)
        // This is a very simple approach; a library like 'marked' would be better for full Markdown.
        const formattedText = text.replace(/```([\s\S]*?)```/g, (match, code) => {
            // Naive code block handling
            const codeContent = code.trim();
            // Escape HTML within the code block to prevent rendering issues
            const escapedCode = codeContent.replace(/</g, '<').replace(/>/g, '>');
            return `<pre><code>${escapedCode}</code></pre>`;
        });

        messageElement.innerHTML = formattedText; // Use innerHTML carefully
        if (messageList) {
            messageList.appendChild(messageElement);
            // Scroll to the bottom
            messageList.scrollTop = messageList.scrollHeight;
        }
    }

    let lastAssistantMessageElement = null; // Keep track of the last message element for streaming

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The JSON data sent from the extension

        switch (message.type) {
            case 'addMessage':
                // Create a new message container
                const messageElement = document.createElement('div');
                messageElement.classList.add('message', message.sender === 'user' ? 'user-message' : 'assistant-message');

                // If it's an assistant message and text is initially empty, store it for streaming
                if (message.sender === 'assistant' && message.text === '') {
                     lastAssistantMessageElement = messageElement;
                } else {
                    // For user messages or complete assistant messages, render directly
                    // Basic Markdown rendering (same as before)
                    const formattedText = message.text.replace(/```([\s\S]*?)```/g, (match, code) => {
                        const codeContent = code.trim();
                        const escapedCode = codeContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        return `<pre><code>${escapedCode}</code></pre>`;
                    });
                    messageElement.innerHTML = formattedText;
                    lastAssistantMessageElement = null; // Reset tracker if it's not an empty assistant message
                }

                if (messageList) {
                    messageList.appendChild(messageElement);
                    messageList.scrollTop = messageList.scrollHeight;
                }
                break;

            case 'appendMessageChunk':
                // Append text chunk to the last assistant message element
                if (lastAssistantMessageElement && message.sender === 'assistant') {
                    // Append raw text delta. Avoid re-applying markdown on chunks.
                    // We might need a more sophisticated rendering approach later.
                    // For now, just append and let browser handle potential partial HTML.
                    // Escape the delta before appending to prevent accidental HTML injection from the delta itself
                    const escapedDelta = message.textDelta.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    lastAssistantMessageElement.innerHTML += escapedDelta; // Append escaped chunk

                    if (messageList) {
                         messageList.scrollTop = messageList.scrollHeight; // Keep scrolled to bottom
                    }
                } else if (message.sender === 'assistant') {
                    // Fallback: If we lost track of the last element, add as a new message
                    console.warn("Could not find last assistant message element to append chunk to. Adding as new message.");
                    addMessage(message.sender, message.textDelta);
                    // Attempt to re-assign lastAssistantMessageElement (might be fragile)
                    if(messageList) lastAssistantMessageElement = messageList.lastElementChild;

                }
                break;

            // Add more message types as needed (e.g., 'setApiKey', 'showError')
        }
    });

    // Handle user input
    function sendMessage() {
        const text = /** @type {HTMLTextAreaElement} */ (userInput).value.trim();
        if (text) {
            // Add user message to UI immediately
             const userMessageElement = document.createElement('div');
             userMessageElement.classList.add('message', 'user-message');
             userMessageElement.textContent = text; // Use textContent for user input safety
             if (messageList) {
                 messageList.appendChild(userMessageElement);
                 messageList.scrollTop = messageList.scrollHeight;
             }
             lastAssistantMessageElement = null; // User sent a message, reset assistant tracker
            // Send message to the extension
            vscode.postMessage({
                type: 'sendMessage',
                text: text
            });
            /** @type {HTMLTextAreaElement} */ (userInput).value = ''; // Clear input
        }
    }

    sendButton.addEventListener('click', sendMessage);

    // Allow sending with Enter key (Shift+Enter for newline)
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent newline in textarea
            sendMessage();
        }
    });

    // Optional: Inform the extension that the webview is ready
    vscode.postMessage({ type: 'webviewReady' });

}());