import * as filesystem from './filesystem';
import * as utils from './utils';
import * as system from './system';
import * as vscodeTools from './vscode'; // Renamed to avoid conflict with 'vscode' module

// Combine all tools into a single object for easier import and use
export const allTools = {
  ...filesystem,
  ...utils,
  ...system,
  ...vscodeTools,
};

// Optionally, export individual categories if needed elsewhere
export { filesystem, utils, system, vscodeTools };

// Define the union type of all tool names for stricter typing
export type ToolName = keyof typeof allTools;

// Define the union type of all tool definitions
export type ToolDefinition = typeof allTools[ToolName];