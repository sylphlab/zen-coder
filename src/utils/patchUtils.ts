import { compare, Operation } from 'fast-json-patch';

/**
 * Generates a JSON Patch (RFC 6902) array by comparing two states.
 *
 * @param oldState The previous state object.
 * @param newState The current state object.
 * @returns An array of patch operations, or an empty array if states are identical.
 */
export function generatePatch<T>(oldState: T, newState: T): Operation[] {
    try {
        // Ensure states are not undefined or null, treat them as empty objects if they are
        const effectiveOldState = oldState ?? {};
        const effectiveNewState = newState ?? {};
        return compare(effectiveOldState, effectiveNewState);
    } catch (error) {
        console.error('[generatePatch] Error generating patch:', error);
        // In case of error during comparison, return an empty patch array
        // to avoid breaking the update flow. Consider logging the states for debugging.
        return [];
    }
}