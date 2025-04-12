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
  // Add custom rules or shortcuts here if needed
  // shortcuts: [
  //   // Example: ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
  // ],
})