import * as filesystem from './filesystem';
import * as utils from './utils';
// Removed import for non-existent 'system' module
import * as vscodeTools from './vscode'; // Renamed to avoid conflict with 'vscode' module

// Combine all tools into a single object for easier import and use
export const allTools = {
  ...filesystem,
  ...utils,
  // Removed spread for non-existent 'system' module
  ...vscodeTools,
};

// Optionally, export individual categories if needed elsewhere
export { filesystem, utils, vscodeTools }; // Removed 'system' from export

// Define the union type of all tool names for stricter typing
export type ToolName = keyof typeof allTools;

// Define the union type of all tool definitions
export type ToolDefinition = typeof allTools[ToolName];