import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

export const getConfigurationTool = tool({
    description: 'Gets the value of a specific VS Code configuration setting for a given section. Returns the value or undefined if the setting is not found.',
    parameters: z.object({
        section: z.string().describe('The configuration section (e.g., "editor", "files"). Leave empty to get settings from the root.'),
        key: z.string().describe('The specific configuration key within the section (e.g., "fontSize", "autoSave").'),
    }),
    execute: async ({ section, key }) => {
        try {
            const config = vscode.workspace.getConfiguration(section || undefined); // Pass undefined for root section
            const value = config.get(key);

            if (value === undefined) {
                return { success: false, message: `Configuration setting '${section ? section + '.' : ''}${key}' not found.` };
            }

            // We need to serialize the value in case it's an object or array
            let serializedValue: string;
            try {
                serializedValue = JSON.stringify(value, null, 2); // Pretty print for readability
            } catch (stringifyError) {
                 console.error(`Error stringifying configuration value for ${key}:`, stringifyError);
                 // Fallback to simple toString if stringify fails (e.g., for functions, though unlikely in settings)
                 serializedValue = String(value);
            }

            return { success: true, value: serializedValue };

        } catch (error: any) {
            console.error('Error executing getConfigurationTool:', error);
            return { success: false, message: `Failed to get configuration setting: ${error.message}` };
        }
    },
});