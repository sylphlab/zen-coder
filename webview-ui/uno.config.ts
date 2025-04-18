import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(), // Default preset
    presetAttributify(), // Enable attributify mode
    presetIcons({ // Enable icon preset
      scale: 1.2,
      warn: true,
      collections: {
        // Explicitly define the 'carbon' collection
        carbon: () => import('@iconify-json/carbon/icons.json').then(i => i.default),
      }
    }),
  ],
  theme: {
    colors: {
      // Define colors using VS Code CSS variables

      // Core UI
      foreground: 'var(--vscode-foreground)', // Default text
      background: 'var(--vscode-editor-background)', // Default background

      // Primary Button (maps to standard button)
      primary: 'var(--vscode-button-background)',
      'primary-foreground': 'var(--vscode-button-foreground)',

      // Secondary Button
      secondary: 'var(--vscode-button-secondaryBackground)',
      'secondary-foreground': 'var(--vscode-button-secondaryForeground)',

      // Input fields
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
      'vscode-button-secondary-foreground': 'var(--vscode-button-secondaryForeground)', // Keep original mapping for direct use if needed

      // Explicitly define transparent if needed, though UnoCSS has bg-transparent
      'transparent': 'transparent',

      // Accent color for hover/active states on outline/ghost buttons
      accent: 'var(--vscode-list-hoverBackground)', // Using list hover as a subtle accent

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