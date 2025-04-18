export * from './getActiveTerminals';
export * from './getActiveEditorContext';
export * from './replaceInActiveEditor';
// Removed exports for deleted interaction tools
// Removed formatDocument, saveActiveFile, closeActiveFile, openFile
// Removed goToDefinitionTool, findReferencesTool, renameSymbolTool
export * from './getConfigurationTool';
export * from './startDebuggingTool';
export * from './stopDebuggingTool';
// Removed debugStepOverTool, debugStepIntoTool, debugStepOutTool
export * from './addBreakpointsTool';
export * from './removeBreakpointsTool';
export * from './getDiagnosticsTool';
export * from './getCodeActionsTool';
export * from './findWorkspaceSymbolsTool';
export * from './findDocumentSymbolsTool';
// Add future VSCode specific tools here
// Removed getOpenTabs, runCommand