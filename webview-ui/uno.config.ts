import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(), // Default preset
    presetAttributify(), // Enable attributify mode
    presetIcons({ // Enable icon preset
      scale: 1.2,
      warn: true,
    }),
  ],
  theme: {
    colors: {
      // Define colors using VS Code CSS variables
      'vscode-foreground': 'var(--vscode-editor-foreground)',
      'vscode-background': 'var(--vscode-editor-background)', // Define for potential use, though aiming for transparency
      'vscode-input-background': 'var(--vscode-input-background)',
      'vscode-input-foreground': 'var(--vscode-input-foreground)',
      'vscode-input-border': 'var(--vscode-input-border)',
      'vscode-button-background': 'var(--vscode-button-background)',
      'vscode-button-foreground': 'var(--vscode-button-foreground)',
      'vscode-button-hover-background': 'var(--vscode-button-hoverBackground)',
      'vscode-list-active-background': 'var(--vscode-list-activeSelectionBackground)',
      'vscode-list-active-foreground': 'var(--vscode-list-activeSelectionForeground)',
      'vscode-list-inactive-background': 'var(--vscode-list-inactiveSelectionBackground)',
      'vscode-widget-border': 'var(--vscode-editorWidget-border)',
      'vscode-code-background': 'var(--vscode-textBlockQuote-background)',
      'vscode-code-border': 'var(--vscode-textBlockQuote-border)',
      'vscode-info': 'var(--vscode-editorInfo-foreground)',
      'vscode-success': 'var(--vscode-testing-iconPassed)',
      'vscode-error': 'var(--vscode-errorForeground)',
      'vscode-warning': 'var(--vscode-editorWarning-foreground)',
      'vscode-link': 'var(--vscode-textLink-foreground)',
      'vscode-link-active': 'var(--vscode-textLink-activeForeground)',
      'vscode-description': 'var(--vscode-descriptionForeground)',
      'vscode-toolbar-hover': 'var(--vscode-toolbar-hoverBackground)',
      'vscode-button-secondary-background': 'var(--vscode-button-secondaryBackground)',
      'vscode-button-secondary-foreground': 'var(--vscode-button-secondaryForeground)',
      // Explicitly define transparent if needed, though UnoCSS has bg-transparent
      'transparent': 'transparent',
    },
    fontFamily: {
      // Set default sans font to VS Code font
      sans: 'var(--vscode-font-family, system-ui, sans-serif)',
    },
    fontSize: {
      // Map base font size to VS Code font size
      'vscode': 'var(--vscode-font-size)',
    }
  },
  // Add custom rules or shortcuts here if needed
  // shortcuts: [
  //   // Example: ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
  // ],
})