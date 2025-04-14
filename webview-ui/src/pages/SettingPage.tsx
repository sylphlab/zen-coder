import { useCallback, useRef } from 'preact/hooks';
import { useLocation } from "wouter";
import { useSetAtom } from 'jotai'; // Added useSetAtom
import { JSX } from 'preact/jsx-runtime';
import { DefaultModelSettings } from '../components/settings/DefaultModelSettings';
import { CustomInstructionsSettings } from '../components/settings/CustomInstructionsSettings';
import { ProviderSettings } from '../components/settings/ProviderSettings';
import { McpServerSettings } from '../components/settings/McpServerSettings';
import { updateLocationAtom } from '../store/atoms'; // Import atom setter

export function SettingPage(): JSX.Element {
   const [, setLocation] = useLocation();
   const updateLocation = useSetAtom(updateLocationAtom); // Get atom setter
   const isSubscribedRef = useRef(false);

   // Removed local state and handlers
   // These are now handled within their respective components.

   // Removed central subscription useEffect. Subscriptions are now handled in individual setting components.

   // Removed the useEffect hook for custom instructions state sync.
   // Handler for the back button (with backend sync)
   const handleBackClick = useCallback(() => {
       const newPath = '/'; // Navigate to root (ChatListPage)
       setLocation(newPath);
       updateLocation(newPath); // Sync backend
   }, [setLocation, updateLocation]);
   // Removed duplicate handleBackClick definition

   return (
       <div class="p-6 relative h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
           {/* Back Button */}
           <button
               onClick={handleBackClick}
               class="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 z-10"
               title="Back to Chat"
           >
               <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                   <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
               </svg>
           </button>

           <h1 class="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200 text-center">Zen Coder 設定</h1>

           {/* Render the separated components */}
           <DefaultModelSettings />
           <CustomInstructionsSettings />
           <ProviderSettings />
           {/* <ToolSettings /> */}
           <McpServerSettings />

       </div>
       // Removed duplicate closing div tag - This comment is now incorrect, removing it.
  ); // Closing parenthesis for the main return
} // Closing brace for SettingPage function
