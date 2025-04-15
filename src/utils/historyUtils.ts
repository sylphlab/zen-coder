import { CoreMessage, ToolCallPart as CoreToolCallPart, ToolResultPart as CoreToolResultPart, AssistantContent, UserContent } from 'ai';
import { UiMessage, UiMessageContentPart, UiToolCallPart, UiTextMessagePart, UiImagePart, structuredAiResponseSchema } from '../common/types';

/**
 * Parses the trailing JSON block for suggested actions from the accumulated text.
 * Returns the parsed actions and the text with the block removed, or null/original text if parsing/validation fails.
 */
export function parseAndValidateSuggestedActions(accumulatedText: string): { actions: any[] | null, textWithoutBlock: string } {
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```$/;
    const match = accumulatedText.match(jsonBlockRegex);
    let parsedActions: any[] | null = null;
    let textToSave = accumulatedText;

    if (match && match[1]) {
        const jsonString = match[1].trim();
        // console.log("[HistoryUtils] Found potential JSON block:", jsonString); // Optional debug
        try {
            const parsedJson = JSON.parse(jsonString);
            const validationResult = structuredAiResponseSchema.safeParse(parsedJson);

            if (validationResult.success && validationResult.data.suggested_actions && validationResult.data.suggested_actions.length > 0) {
                // console.log("[HistoryUtils] Successfully parsed and validated suggested actions:", validationResult.data.suggested_actions); // Optional debug
                parsedActions = validationResult.data.suggested_actions;
                textToSave = accumulatedText.substring(0, match.index).trimEnd();
                // console.log("[HistoryUtils] JSON block will be removed from saved history."); // Optional debug
            } else {
                // console.warn("[HistoryUtils] Parsed JSON block failed validation or missing suggested_actions:", validationResult.success ? 'Missing/empty actions' : validationResult.error); // Optional debug
            }
        } catch (parseError) {
            console.error("[HistoryUtils] Error parsing JSON block:", parseError);
        }
    } else {
        // console.log("[HistoryUtils] No JSON block found at the end of the message."); // Optional debug
    }
    return { actions: parsedActions, textWithoutBlock: textToSave };
}

/**
 * Reconstructs the final UI content array based on final tool calls and processed text.
 */
export function reconstructUiContent(
    finalCoreToolCalls: CoreToolCallPart[],
    existingUiContent: UiMessageContentPart[],
    finalText: string
): UiMessageContentPart[] {
    const reconstructedUiContent: UiMessageContentPart[] = [];

    // Add tool calls first, preserving their last known status/result from the UI history
    finalCoreToolCalls.forEach(coreToolCall => {
        const existingUiToolCall = existingUiContent.find(p => p.type === 'tool-call' && p.toolCallId === coreToolCall.toolCallId) as UiToolCallPart | undefined;
        reconstructedUiContent.push({
            type: 'tool-call',
            toolCallId: coreToolCall.toolCallId,
            toolName: coreToolCall.toolName,
            args: coreToolCall.args,
            status: existingUiToolCall?.status ?? 'complete', // Preserve status/result if available
            result: existingUiToolCall?.result,
            progress: undefined // Clear progress
        });
    });

    // Add the final text content
    if (finalText) {
        reconstructedUiContent.push({ type: 'text', text: finalText });
    }
    // else {
    //     console.warn(`[HistoryUtils] No final text content provided during UI content reconstruction.`); // Optional debug
    // }

    return reconstructedUiContent;
}

/**
 * Translates a single user UiMessage to a CoreMessage.
 * Returns null if the message has no AI-relevant content.
 */
export function translateUserMessageToCore(uiMsg: UiMessage): CoreMessage | null {
    const userContent: UserContent = [];
    let hasContentForAi = false;
    for (const part of uiMsg.content) {
        if (part.type === 'text') {
            if (part.text) {
                userContent.push({ type: 'text', text: part.text });
                hasContentForAi = true;
            }
        } else if (part.type === 'image') {
            userContent.push({
                type: 'image',
                image: Buffer.from(part.data, 'base64'),
                mimeType: part.mediaType
            });
            hasContentForAi = true;
        }
    }
    if (hasContentForAi && userContent.length > 0) {
        return { role: 'user', content: userContent };
    } else {
        // console.log(`[HistoryUtils] Skipping user message (ID: ${uiMsg.id}) with no AI-relevant content during translation.`); // Optional debug
        return null;
    }
}

/**
 * Translates a single assistant UiMessage to CoreMessages (assistant message + optional tool results).
 * Returns an empty array if the message has no AI-relevant content.
 */
export function translateAssistantMessageToCore(uiMsg: UiMessage): CoreMessage[] {
    const assistantContent: AssistantContent = [];
    const toolResultsForThisMsg: CoreToolResultPart[] = [];
    let hasContentForAi = false;

    for (const part of uiMsg.content) {
        if (part.type === 'text') {
            if (part.text) {
                assistantContent.push({ type: 'text', text: part.text });
                hasContentForAi = true;
            }
        } else if (part.type === 'tool-call') {
            assistantContent.push({
                type: 'tool-call',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                args: part.args
            });
            hasContentForAi = true;
            if (part.status === 'complete' || part.status === 'error') {
                toolResultsForThisMsg.push({
                    type: 'tool-result',
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    result: part.result ?? (part.status === 'complete' ? 'Completed' : 'Error')
                });
            }
        }
    }

    const resultingCoreMessages: CoreMessage[] = [];
    if (hasContentForAi && assistantContent.length > 0) {
        resultingCoreMessages.push({ role: 'assistant', content: assistantContent });
        if (toolResultsForThisMsg.length > 0) {
            resultingCoreMessages.push({ role: 'tool', content: toolResultsForThisMsg });
        }
    }
    // else if (!hasContentForAi) { // Optional debug
    //      console.log(`[HistoryUtils] Skipping assistant message (ID: ${uiMsg.id}) with no AI-relevant content during translation.`);
    // }
    return resultingCoreMessages;
}

/**
 * Translates the entire UI history (array of UiMessage) into the format
 * required by the Vercel AI SDK (CoreMessage[]).
 * @param chatHistory - The array of UiMessage objects.
 * @returns An array of CoreMessage objects.
 */
export function translateUiHistoryToCoreMessages(chatHistory: UiMessage[]): CoreMessage[] {
    if (!chatHistory) return [];

    const coreMessages: CoreMessage[] = [];
    for (const uiMsg of chatHistory) {
        if (uiMsg.role === 'user') {
            const coreMsg = translateUserMessageToCore(uiMsg);
            if (coreMsg) { coreMessages.push(coreMsg); }
        } else if (uiMsg.role === 'assistant') {
            const coreMsgs = translateAssistantMessageToCore(uiMsg);
            coreMessages.push(...coreMsgs);
        }
        // Ignore system/tool messages during this top-level translation
    }
    return coreMessages;
}
