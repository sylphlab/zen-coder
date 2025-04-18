import { useCallback, useRef, useState } from 'preact/hooks';
// Removed: import { useLocation } from "wouter";
// Removed: import { useSetAtom } from 'jotai';
import { JSX } from 'preact/jsx-runtime';
// Correct import name, file rename pending
import { DefaultAssistantSettings } from '../components/settings/DefaultModelSettings';
import { CustomInstructionsSettings } from '../components/settings/CustomInstructionsSettings';
import { ProviderSettings } from '../components/settings/ProviderSettings';
import { ToolSettings } from '../components/settings/ToolSettings';
import { AssistantSettings } from '../components/settings/AssistantSettings'; // Import AssistantSettings
// Removed: import { McpServerSettings } from '../components/settings/McpServerSettings';
import { router } from '../stores/router'; // Import Nanostores router
// Removed: import { updateLocationAtom } from '../store/atoms';

export function SettingPage(): JSX.Element {
   // Removed wouter/jotai hooks
   const isSubscribedRef = useRef(false); // Keep this for now, might relate to old subscription logic to be removed later

   // Removed local state and handlers (Assuming they are fully moved to sub-components)
   // These are now handled within their respective components.

   // Removed central subscription useEffect. Subscriptions are now handled in individual setting components.

   // Handler for the back button (Use Nanostores router)
   const handleBackClick = useCallback(() => {
       console.log('[SettingPage] Navigating back to /');
       router.open('/'); // Use Nanostores router
   }, []); // No dependencies needed

   // State for active tab
   const [activeTab, setActiveTab] = useState('general');
   // Removed animation-related state and refs
   
   // Handle tab change - simplified
   const handleTabChange = (tab: string) => {
       setActiveTab(tab);
   };
   
   return (
       <div class="h-full flex flex-col bg-[var(--vscode-editor-background)]">
           {/* Header with back button and title */}
           {/* Removed border, border-opacity, bg-opacity */}
           <header class="sticky top-0 z-10 bg-[var(--vscode-editor-background)] backdrop-blur-md px-4 py-3 flex items-center justify-between">
               <div class="flex items-center">
                   <button
                       onClick={handleBackClick}
                       class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--vscode-button-background)] hover:bg-opacity-10 active:bg-opacity-20 transition-all duration-150 transform active:scale-95"
                       aria-label="Back to chats"
                   >
                       <span class="i-carbon-arrow-left h-5 w-5 text-[var(--vscode-foreground)]"></span>
                   </button>
                   <h1 class="ml-3 text-lg font-medium text-[var(--vscode-foreground)]">Settings</h1>
               </div>
               <div class="text-xs bg-[var(--vscode-activityBarBadge-background)] bg-opacity-10 text-[var(--vscode-foreground)] opacity-70 rounded-full px-3 py-1 flex items-center">
                   <span class="i-carbon-checkmark h-3 w-3 mr-1 text-[var(--vscode-activityBarBadge-background)]"></span>
                   Auto-saved
               </div>
           </header>

           {/* Segmented Control Navigation */}
           <div class="px-4 py-3 border-b border-[var(--vscode-panel-border)] border-opacity-50">
               <div class="flex space-x-1 bg-[var(--vscode-input-background)] p-1 rounded-lg">
                   <button
                       onClick={() => handleTabChange('general')}
                       class={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                           activeTab === 'general'
                           ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' /* Removed shadow-sm */
                           : 'text-[var(--vscode-foreground)] opacity-70 hover:bg-[var(--vscode-button-background)] hover:opacity-100' /* Removed hover:bg-opacity-10 */
                       }`}
                   >
                       <span class="i-carbon-settings h-4 w-4"></span>
                       <span>General</span>
                   </button>
                   <button
                       onClick={() => handleTabChange('providers')}
                       class={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                           activeTab === 'providers'
                           ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' /* Removed shadow-sm */
                           : 'text-[var(--vscode-foreground)] opacity-70 hover:bg-[var(--vscode-button-background)] hover:opacity-100' /* Removed hover:bg-opacity-10 */
                       }`}
                   >
                       <span class="i-carbon-api h-4 w-4"></span>
                       <span>Providers</span>
                   </button>
                   <button
                       onClick={() => handleTabChange('tools')}
                       class={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                           activeTab === 'tools'
                           ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' /* Removed shadow-sm */
                           : 'text-[var(--vscode-foreground)] opacity-70 hover:bg-[var(--vscode-button-background)] hover:opacity-100' /* Removed hover:bg-opacity-10 */
                       }`}
                   >
                       <span class="i-carbon-tools-alt h-4 w-4"></span>
                       <span>Tools</span>
                   </button>
                   <button
                       onClick={() => handleTabChange('about')}
                       class={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                           activeTab === 'about'
                           ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]' /* Removed shadow-sm */
                           : 'text-[var(--vscode-foreground)] opacity-70 hover:bg-[var(--vscode-button-background)] hover:opacity-100' /* Removed hover:bg-opacity-10 */
                       }`}
                   >
                       <span class="i-carbon-information h-4 w-4"></span>
                       <span>About</span>
                   </button>
                   {/* Assistants Tab Button */}
                   <button
                       onClick={() => handleTabChange('assistants')}
                       class={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                           activeTab === 'assistants'
                           ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]'
                           : 'text-[var(--vscode-foreground)] opacity-70 hover:bg-[var(--vscode-button-background)] hover:opacity-100'
                       }`}
                   >
                       <span class="i-carbon-user-avatar-filled-alt h-4 w-4"></span>
                       <span>Assistants</span>
                   </button>
               </div>
           </div>

           {/* Main Content Area - Full Width */}
           <main class="flex-1 overflow-y-auto p-6"> {/* Removed relative positioning */}
               {/* General Settings Tab - Conditionally render */}
               {activeTab === 'general' && (
                   <div> {/* Simple div wrapper */}
                   <div class="flex items-start gap-3 mb-5">
                       {/* Removed bg-opacity-10 */}
                       <div class="bg-[var(--vscode-button-background)] p-2 rounded-lg">
                           <span class="i-carbon-settings h-6 w-6 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                       </div>
                       <div>
                           <h2 class="text-xl font-semibold text-[var(--vscode-foreground)]">General Settings</h2>
                           <p class="text-sm text-[var(--vscode-foreground)] opacity-70">
                               Configure your ZenCoder experience
                           </p>
                       </div>
                   </div>
                   
                   {/* Setting Cards - Full Width */}
                   <div class="space-y-6">
                       {/* Default Model Card */}
                       {/* Removed shadow-sm, border, hover:shadow-md */}
                       <div class="bg-[var(--vscode-editorWidget-background)] rounded-xl overflow-hidden transition-shadow duration-300">
                           <div class="p-4 border-b border-[var(--vscode-panel-border)] border-opacity-20">
                               <div class="flex items-center gap-3">
                                   {/* Removed bg-opacity-10 */}
                                   <div class="h-10 w-10 bg-[var(--vscode-button-background)] rounded-lg flex items-center justify-center">
                                       {/* Updated Icon */}
                                       <span class="i-carbon-user-avatar h-5 w-5 text-[var(--vscode-button-foreground)]"></span>
                                   </div>
                                   <div>
                                       {/* Updated Title */}
                                       <h3 class="text-base font-medium text-[var(--vscode-foreground)]">Default Assistant</h3>
                                       <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                           Select which Assistant to use by default
                                       </p>
                                   </div>
                               </div>
                           </div>
                           <div class="p-4">
                               {/* Corrected Component Usage */}
                               <DefaultAssistantSettings />
                           </div>
                       </div>
                       
                       {/* Custom Instructions Card */}
                       {/* Removed shadow-sm, border, hover:shadow-md */}
                       <div class="bg-[var(--vscode-editorWidget-background)] rounded-xl overflow-hidden transition-shadow duration-300">
                           <div class="p-4 border-b border-[var(--vscode-panel-border)] border-opacity-20">
                               <div class="flex items-center gap-3">
                                   {/* Removed bg-opacity-10 */}
                                   <div class="h-10 w-10 bg-[var(--vscode-button-background)] rounded-lg flex items-center justify-center">
                                       <span class="i-carbon-user-profile h-5 w-5 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                                   </div>
                                   <div>
                                       <h3 class="text-base font-medium text-[var(--vscode-foreground)]">Custom Instructions</h3>
                                       <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                           Tell ZenCoder about your preferences
                                       </p>
                                   </div>
                               </div>
                           </div>
                           <div class="p-4">
                               <CustomInstructionsSettings />
                           </div>
                       </div>
                       
                       {/* Context Settings Card (placeholder) */}
                       {/* Removed shadow-sm, border, hover:shadow-md */}
                       <div class="bg-[var(--vscode-editorWidget-background)] rounded-xl overflow-hidden transition-shadow duration-300 opacity-60">
                           <div class="p-4 border-b border-[var(--vscode-panel-border)] border-opacity-20">
                               <div class="flex items-center gap-3">
                                   {/* Removed bg-opacity-10 */}
                                   <div class="h-10 w-10 bg-[var(--vscode-button-background)] rounded-lg flex items-center justify-center">
                                       <span class="i-carbon-folder h-5 w-5 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                                   </div>
                                   <div>
                                       <h3 class="text-base font-medium text-[var(--vscode-foreground)]">Context Settings</h3>
                                       <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                           Configure how ZenCoder accesses your workspace
                                       </p>
                                   </div>
                                   <div class="ml-auto">
                                       <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--vscode-button-background)] bg-opacity-20 text-[var(--vscode-button-background)]">Coming Soon</span>
                                   </div>
                               </div>
                           </div>
                           <div class="p-4 opacity-60">
                               <div class="flex items-center justify-between py-2">
                                   <span class="text-sm text-[var(--vscode-foreground)]">Include workspace files</span>
                                   <span class="i-carbon-checkmark h-4 w-4 text-[var(--vscode-button-background)]"></span>
                               </div>
                               <div class="flex items-center justify-between py-2 border-t border-[var(--vscode-panel-border)] border-opacity-20">
                                   <span class="text-sm text-[var(--vscode-foreground)]">Include git history</span>
                                   <span class="i-carbon-close h-4 w-4 text-[var(--vscode-foreground)] opacity-40"></span>
                               </div>
                           </div>
                       </div>
                       
                       {/* Theme Settings Card (placeholder) */}
                       {/* Removed shadow-sm, border, hover:shadow-md */}
                       <div class="bg-[var(--vscode-editorWidget-background)] rounded-xl overflow-hidden transition-shadow duration-300 opacity-60">
                           <div class="p-4 border-b border-[var(--vscode-panel-border)] border-opacity-20">
                               <div class="flex items-center gap-3">
                                   {/* Removed bg-opacity-10 */}
                                   <div class="h-10 w-10 bg-[var(--vscode-button-background)] rounded-lg flex items-center justify-center">
                                       <span class="i-carbon-color-palette h-5 w-5 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                                   </div>
                                   <div>
                                       <h3 class="text-base font-medium text-[var(--vscode-foreground)]">Theme Overrides</h3>
                                       <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                           Customize ZenCoder interface
                                       </p>
                                   </div>
                                   <div class="ml-auto">
                                       <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--vscode-button-background)] bg-opacity-20 text-[var(--vscode-button-background)]">Coming Soon</span>
                                   </div>
                               </div>
                           </div>
                           <div class="p-4 opacity-60 flex gap-2">
                               <div class="h-8 w-8 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                               <div class="h-8 w-8 rounded-full bg-violet-500 border-2 border-transparent"></div>
                               <div class="h-8 w-8 rounded-full bg-green-500 border-2 border-transparent"></div>
                               <div class="h-8 w-8 rounded-full bg-amber-500 border-2 border-transparent"></div>
                               <div class="h-8 w-8 rounded-full bg-rose-500 border-2 border-transparent"></div>
                               <div class="h-8 w-8 rounded-full bg-gray-500 border-2 border-transparent flex items-center justify-center">
                                   <span class="i-carbon-add h-4 w-4 text-[var(--vscode-button-foreground)]"></span>
                               </div>
                           </div>
                       </div>
                   </div>
                   </div>
               )}
               
               {/* Providers Tab - Conditionally render */}
               {activeTab === 'providers' && (
                   <div> {/* Simple div wrapper */}
                   <div class="flex items-start gap-3 mb-5">
                       {/* Removed bg-opacity-10 */}
                       <div class="bg-[var(--vscode-button-background)] p-2 rounded-lg">
                           <span class="i-carbon-api h-6 w-6 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                       </div>
                       <div>
                           <h2 class="text-xl font-semibold text-[var(--vscode-foreground)]">AI Providers</h2>
                           <p class="text-sm text-[var(--vscode-foreground)] opacity-70">
                               Configure AI services and models
                           </p>
                       </div>
                   </div>
                   
                   {/* Removed shadow-sm, border, hover:shadow-md */}
                   <div class="bg-[var(--vscode-editorWidget-background)] rounded-xl overflow-hidden transition-shadow duration-300">
                       <div class="p-4 border-b border-[var(--vscode-panel-border)] border-opacity-20">
                           <div class="flex items-center gap-3">
                               {/* Removed bg-opacity-10 */}
                               <div class="h-10 w-10 bg-[var(--vscode-button-background)] rounded-lg flex items-center justify-center">
                                   <span class="i-carbon-api h-5 w-5 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                               </div>
                               <div>
                                   <h3 class="text-base font-medium text-[var(--vscode-foreground)]">AI Service Providers</h3>
                                   <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                       Configure your API keys and models
                                   </p>
                               </div>
                           </div>
                       </div>
                       <div class="p-4">
                           <ProviderSettings />
                       </div>
                   </div>
                   </div>
               )}
               
               {/* Tools Tab - Conditionally render */}
               {activeTab === 'tools' && (
                   <div> {/* Simple div wrapper */}
                   <div class="flex items-start gap-3 mb-5">
                       {/* Removed bg-opacity-10 */}
                       <div class="bg-[var(--vscode-button-background)] p-2 rounded-lg">
                           <span class="i-carbon-tools-alt h-6 w-6 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                       </div>
                       <div>
                           <h2 class="text-xl font-semibold text-[var(--vscode-foreground)]">Tools & Capabilities</h2>
                           <p class="text-sm text-[var(--vscode-foreground)] opacity-70">
                               Control what ZenCoder can access
                           </p>
                       </div>
                   </div>
                   
                   {/* Removed shadow-sm, border, hover:shadow-md */}
                   <div class="bg-[var(--vscode-editorWidget-background)] rounded-xl overflow-hidden transition-shadow duration-300">
                       <div class="p-4 border-b border-[var(--vscode-panel-border)] border-opacity-20">
                           <div class="flex items-center gap-3">
                               {/* Removed bg-opacity-10 */}
                               <div class="h-10 w-10 bg-[var(--vscode-button-background)] rounded-lg flex items-center justify-center">
                                   <span class="i-carbon-tools-alt h-5 w-5 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                               </div>
                               <div>
                                   <h3 class="text-base font-medium text-[var(--vscode-foreground)]">Tool Permissions</h3>
                                   <p class="text-xs text-[var(--vscode-foreground)] opacity-70">
                                       Control which tools ZenCoder can use
                                   </p>
                               </div>
                           </div>
                       </div>
                       <div class="p-4 bg-[var(--vscode-editorWidget-background)]">
                           <ToolSettings />
                       </div>
                   </div>
                   </div>
               )}
               
               {/* About Tab - Conditionally render */}
               {activeTab === 'about' && (
                   <div> {/* Simple div wrapper */}
                   <div class="h-full flex flex-col items-center justify-center">
                       <div class="relative mb-6">
                           {/* Removed bg-opacity-5 */}
                           <div class="absolute -inset-4 rounded-full bg-[var(--vscode-button-background)] animate-pulse"></div>
                           {/* Removed bg-opacity-10 */}
                           <div class="relative w-32 h-32 rounded-full bg-[var(--vscode-button-background)] flex items-center justify-center">
                               <span class="i-carbon-code h-16 w-16 text-[var(--vscode-button-foreground)]"></span> {/* Adjusted icon color */}
                           </div>
                       </div>
                       <h1 class="text-2xl font-bold text-[var(--vscode-foreground)] mb-2">ZenCoder</h1>
                       <p class="text-lg text-[var(--vscode-foreground)] opacity-70 mb-1">Your AI Coding Partner</p>
                       <p class="text-sm text-[var(--vscode-foreground)] opacity-60 mb-8">Version 1.0.0</p>
                       
                       <div class="flex gap-4 mb-10">
                           {/* Removed hover/active opacities */}
                           <button class="px-4 py-2 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded-lg flex items-center gap-2 transition-all duration-150 transform active:scale-95">
                               <span class="i-carbon-document h-4 w-4"></span>
                               <span>Documentation</span>
                           </button>
                           {/* Removed hover opacity */}
                           <button class="px-4 py-2 bg-[var(--vscode-editorWidget-background)] border border-[var(--vscode-panel-border)] text-[var(--vscode-foreground)] rounded-lg flex items-center gap-2 hover:bg-[var(--vscode-button-background)] transition-all duration-150 transform active:scale-95">
                               <span class="i-carbon-logo-github h-4 w-4"></span>
                               <span>GitHub</span>
                           </button>
                       </div>
                       
                       <div class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full">
                           {/* Removed border, hover:shadow-md */}
                           <div class="bg-[var(--vscode-editorWidget-background)] p-4 rounded-xl flex flex-col items-center text-center transition-shadow duration-300 cursor-pointer">
                               <span class="i-carbon-chat h-10 w-10 text-[var(--vscode-button-background)] mb-2"></span> {/* Changed feedback to chat */}
                               <h3 class="text-sm font-medium text-[var(--vscode-foreground)] mb-1">Feedback</h3>
                               <p class="text-xs text-[var(--vscode-foreground)] opacity-70">Share your thoughts</p>
                           </div>
                           {/* Removed border, hover:shadow-md */}
                           <div class="bg-[var(--vscode-editorWidget-background)] p-4 rounded-xl flex flex-col items-center text-center transition-shadow duration-300 cursor-pointer">
                               <span class="i-carbon-collaborate h-10 w-10 text-[var(--vscode-button-background)] mb-2"></span>
                               <h3 class="text-sm font-medium text-[var(--vscode-foreground)] mb-1">Community</h3>
                               <p class="text-xs text-[var(--vscode-foreground)] opacity-70">Join the discussion</p>
                           </div>
                           {/* Removed border, hover:shadow-md */}
                           <div class="bg-[var(--vscode-editorWidget-background)] p-4 rounded-xl flex flex-col items-center text-center transition-shadow duration-300 cursor-pointer">
                               <span class="i-carbon-help h-10 w-10 text-[var(--vscode-button-background)] mb-2"></span>
                               <h3 class="text-sm font-medium text-[var(--vscode-foreground)] mb-1">Support</h3>
                               <p class="text-xs text-[var(--vscode-foreground)] opacity-70">Get help with issues</p>
                           </div>
                       </div>
                   </div>
                   </div>
               )}
               {/* Assistants Tab - Conditionally render */}
               {activeTab === 'assistants' && (
                   <AssistantSettings />
               )}
           </main>
           {/* Removed animation styles block */}
       </div>
   );
} // Closing brace for SettingPage function
