import { FunctionalComponent } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { UiMessage, UiToolCallPart } from '../../../src/common/types';

// Animation duration constants
const FADE_IN_DURATION = 300;
const TYPING_SPEED = 30; // ms per character

// SVG Icons
const LoadingIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
  <svg class={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const SuccessIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
  <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ErrorIcon: FunctionalComponent<{ className?: string }> = ({ className = "h-3.5 w-3.5" }) => (
  <svg class={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

// Typing animation component
interface TypewriterTextProps {
  text: string;
  delay?: number;
  className?: string;
}

const TypewriterText: FunctionalComponent<TypewriterTextProps> = ({ text, delay = 0, className = "" }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) return;
    
    let currentIndex = 0;
    const animateTyping = () => {
      setTimeout(() => {
        const timer = setInterval(() => {
          if (currentIndex < text.length) {
            setDisplayedText(text.slice(0, currentIndex + 1));
            currentIndex++;
          } else {
            clearInterval(timer);
            setIsComplete(true);
          }
        }, TYPING_SPEED);
        
        return () => clearInterval(timer);
      }, delay);
    };
    
    animateTyping();
  }, [text, delay]);

  return <span class={className}>{isComplete ? text : displayedText}</span>;
};

// Duration timer component
interface DurationTimerProps {
  startTime: number;
  endTime?: number;
  className?: string;
  format?: 'short' | 'long';
}

const DurationTimer: FunctionalComponent<DurationTimerProps> = ({ startTime, endTime, className = "", format = 'short' }) => {
  const [duration, setDuration] = useState("0s");
  const intervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    const updateDuration = () => {
      const now = endTime || Date.now();
      const durationMs = now - startTime;
      
      if (format === 'short') {
        if (durationMs < 1000) {
          setDuration("<1s");
        } else {
          setDuration(`${Math.floor(durationMs / 1000)}s`);
        }
      } else {
        if (durationMs < 1000) {
          setDuration(`${durationMs}ms`);
        } else if (durationMs < 60000) {
          setDuration(`${(durationMs / 1000).toFixed(1)}s`);
        } else {
          const minutes = Math.floor(durationMs / 60000);
          const seconds = Math.floor((durationMs % 60000) / 1000);
          setDuration(`${minutes}m ${seconds}s`);
        }
      }
    };
    
    updateDuration(); // Initial update
    
    if (!endTime) {
      // Only set interval if still running
      intervalRef.current = window.setInterval(updateDuration, 1000) as unknown as number;
    }
    
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startTime, endTime, format]);
  
  return <span class={className}>{duration}</span>;
};

// Progress indicator component
interface ProgressIndicatorProps {
  progress?: number | string; // 0-100 or string percentage
  className?: string;
}

const ProgressIndicator: FunctionalComponent<ProgressIndicatorProps> = ({ progress, className = "" }) => {
  if (progress === undefined) return null;
  
  // Convert string percentage to number if needed
  const progressValue = typeof progress === 'string' 
    ? parseInt(progress, 10) 
    : progress;
  
  if (isNaN(progressValue)) return null;
  
  return (
    <div class={`w-16 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden ${className}`}>
      <div 
        class="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all duration-300 ease-out" 
        style={{ width: `${progressValue}%` }}
      />
    </div>
  );
};

// The main ToolStatusDisplay component
interface ToolStatusDisplayProps {
  message: UiMessage;
}

export const ToolStatusDisplay: FunctionalComponent<ToolStatusDisplayProps> = ({ message }) => {
  // Extract tool call parts from message content
  const toolCallParts = message.content.filter((part): part is UiToolCallPart => part.type === 'tool-call');
  
  if (toolCallParts.length === 0) return null;
  
  return (
    <div class="tool-status-display mt-3 space-y-1 text-xs">
      {toolCallParts.map((toolCall: UiToolCallPart, index: number) => {
        const isLoading = toolCall.status === 'pending' || toolCall.status === 'running';
        const isSuccess = toolCall.status === 'complete';
        const isError = toolCall.status === 'error';
        
        // Calculate progress for appropriate tool types
        let progress;
        if (toolCall.progress !== undefined) {
          progress = typeof toolCall.progress === 'number' ? toolCall.progress : 
            (typeof toolCall.progress === 'string' ? parseInt(toolCall.progress, 10) : undefined);
        }
        
        // Format display text based on tool name and state
        const getDisplayText = () => {
          const name = toolCall.toolName || 'Unknown tool';
          const formattedName = name.startsWith('browser_') ? name.replace('browser_', '') : name;
          const displayName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1).replace(/_/g, ' ');
          
          const args = toolCall.args ? toolCall.args : {};
          let mainArg = '';
          
          // Extract the most relevant argument based on the tool name
          if (args) {
            if ('filePath' in args) mainArg = args.filePath;
            else if ('query' in args) mainArg = args.query;
            else if ('path' in args) mainArg = args.path;
            else if ('command' in args) mainArg = args.command.split(' ')[0];
          }
          
          const suffix = mainArg ? ` ${isLoading ? '' : ''}${mainArg}` : '';
          return isLoading ? `${displayName}${suffix}` : `${displayName}${suffix}`;
        };
        
        // Build the appropriate status indicator
        const getStatusIndicator = () => {
          if (isLoading) {
            return <LoadingIcon className="text-indigo-500 dark:text-indigo-400" />;
          } else if (isSuccess) {
            return <SuccessIcon className="text-emerald-500 dark:text-emerald-400" />;
          } else if (isError) {
            return <ErrorIcon className="text-rose-500 dark:text-rose-400" />;
          }
          return null;
        };
        
        return (
          <div 
            key={toolCall.toolCallId || index} 
            class={`flex items-center space-x-1.5 rounded-lg py-0.5 px-1 
              ${isLoading ? 'text-black/70 dark:text-white/70' : 
                isSuccess ? 'text-black/80 dark:text-white/80' : 
                'text-black/70 dark:text-white/70'}`}
            style={{ 
              animation: `fadeIn ${FADE_IN_DURATION}ms ease-out forwards`,
              opacity: 0
            }}
          >
            <div class="flex-shrink-0">
              {getStatusIndicator()}
            </div>
            
            <div class="flex flex-1 items-center justify-between min-w-0">
              <div class="truncate font-medium">
                {isLoading ? (
                  <TypewriterText text={getDisplayText()} className="font-medium" />
                ) : (
                  <span>{getDisplayText()}</span>
                )}
              </div>
              
              <div class="flex items-center gap-2 ml-2">
                {progress !== undefined && isLoading && (
                  <ProgressIndicator progress={progress} />
                )}
                
                <div class="text-black/60 dark:text-white/60 text-[10px]">
                  <DurationTimer
                    startTime={message.timestamp}
                    endTime={isSuccess || isError ? Date.now() : undefined}
                    format="short"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};