import { render } from 'preact'
import 'virtual:uno.css' // Import UnoCSS generated styles
import '@unocss/reset/tailwind.css' // Import UnoCSS reset (Tailwind flavor)
import './index.css' // Keep your custom global styles if any
import { App } from './app.tsx'

render(<App />, document.getElementById('root')!)
