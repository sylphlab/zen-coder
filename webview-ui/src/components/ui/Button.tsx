import { FunctionalComponent, h, ComponentProps } from 'preact';
import { forwardRef } from 'preact/compat';
import { useMemo, useState, useCallback, useRef, useEffect } from 'preact/hooks';
import 'uno.css';

// Enhanced button variants with texture-oriented design
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'pill';
type ButtonElevation = 'flat' | 'raised' | 'floating';

// Define custom props with enhanced options
interface CustomButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  elevation?: ButtonElevation;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: any;
  iconRight?: any;
  fullWidth?: boolean;
}

// Combine custom props with standard button props
type ButtonProps = CustomButtonProps & Omit<ComponentProps<'button'>, 'size' | 'disabled'>;

// Enhanced ripple effect type with texture properties
interface Ripple {
  key: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  scale: number;
}

// Modern loader with fluid animation
const LoadingSpinner: FunctionalComponent = () => (
  <div class="button-spinner">
    <div class="spinner-ring"></div>
    <div class="spinner-core"></div>
  </div>
);

// Enhanced button component with modern aesthetics
const Button: FunctionalComponent<ButtonProps> = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    elevation = 'flat',
    className,
    children,
    onClick,
    loading = false,
    disabled = false,
    iconLeft,
    iconRight,
    fullWidth = false,
    ...props
  }, ref) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const combinedRef = (node: HTMLButtonElement | null) => {
      // Forward ref while keeping local ref
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
      buttonRef.current = node;
    };

    const [ripples, setRipples] = useState<Ripple[]>([]);
    const [isPressed, setIsPressed] = useState(false);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const isDisabled = loading || disabled;

    // Clean up ripples on unmount
    useEffect(() => {
      return () => setRipples([]);
    }, []);

    // Handle mouse movement for gradient effect
    const handleMouseMove = useCallback((event: h.JSX.TargetedMouseEvent<HTMLButtonElement>) => {
      if (isDisabled || variant === 'link') return;
      
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      
      setHoverPosition({ x, y });
    }, [isDisabled, variant]);

    // Base styles with modern design principles
    const baseStyles = `
      inline-flex items-center justify-center gap-2 whitespace-nowrap
      font-medium transition-all
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
      disabled:pointer-events-none disabled:opacity-50 ${loading ? 'cursor-wait' : ''}
      select-none relative overflow-hidden
      ${fullWidth ? 'w-full' : ''}
      motion-reduce:transition-none
    `;

    // More refined elevation styles
    const elevationStyles = useMemo(() => {
      switch (elevation) {
        case 'raised': return 'shadow-sm hover:shadow transition-shadow duration-200';
        case 'floating': return 'shadow-md hover:shadow-lg transition-shadow duration-200';
        case 'flat': default: return '';
      }
    }, [elevation]);

    // Enhanced variant styles with modern aesthetics
    const variantStyles = useMemo(() => {
      switch (variant) {
        case 'secondary':
          return 'bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/95 ' +
                 'dark:hover:bg-secondary/80 dark:active:bg-secondary/85 button-gradient-secondary';
        case 'outline':
          return 'border border-input/80 bg-transparent hover:bg-accent/10 hover:border-input ' +
                 'active:bg-accent/20 text-foreground backdrop-blur-[2px]';
        case 'ghost':
          return 'hover:bg-accent/10 active:bg-accent/20 text-foreground';
        case 'link':
          return 'text-primary underline-offset-4 hover:underline decoration-2 p-0 h-auto font-normal';
        case 'glass':
          return 'backdrop-blur-md bg-white/10 dark:bg-black/20 border border-white/20 ' +
                 'dark:border-white/10 text-foreground hover:bg-white/20 dark:hover:bg-black/30 ' +
                 'active:bg-white/30 dark:active:bg-black/40 button-gradient-glass';
        case 'primary': default:
          return 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 ' +
                 'dark:hover:bg-primary/85 dark:active:bg-primary/90 button-gradient-primary';
      }
    }, [variant]);

    // Enhanced size styles with modern proportions
    const sizeStyles = useMemo(() => {
      switch (size) {
        case 'sm': return 'text-xs h-8 rounded-lg px-3 py-1';
        case 'lg': return 'text-base h-12 rounded-xl px-6 py-2.5 font-medium';
        case 'icon': return 'h-10 w-10 rounded-full p-2.5';
        case 'pill': return 'text-sm h-10 rounded-full px-5 py-2';
        case 'md': default: return 'text-sm h-10 rounded-lg px-4 py-2';
      }
    }, [size]);

    // Combine styles with better name spacing
    const combinedClassName = `button ${baseStyles} ${elevationStyles} ${variantStyles} ${sizeStyles} ${className || ''}`.trim().replace(/\s+/g, ' ');

    // Enhanced ripple effect
    const createRipple = useCallback((event: h.JSX.TargetedMouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return;
      setIsPressed(true);
      
      // Only create ripple for non-link variants
      if (variant !== 'link') {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        
        // Calculate ripple properties
        const size = Math.max(rect.width, rect.height) * 2;
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        // Generate unique key
        const key = Date.now();
        
        // Create enhanced ripple with additional properties
        const newRipple: Ripple = {
          key,
          x,
          y,
          size,
          opacity: variant === 'outline' || variant === 'ghost' || variant === 'glass' ? 0.1 : 0.2,
          scale: 2.5
        };
        
        setRipples(prevRipples => [...prevRipples, newRipple]);
      }
      
      onClick?.(event);
    }, [onClick, isDisabled, variant]);

    // Handle button release
    const handleButtonRelease = useCallback(() => {
      setIsPressed(false);
    }, []);

    // Handle ripple cleanup
    const handleAnimationEnd = useCallback((key: number) => {
      setRipples(prevRipples => prevRipples.filter(ripple => ripple.key !== key));
    }, []);

    return (
      <button
        className={combinedClassName}
        ref={combinedRef}
        onClick={createRipple}
        onMouseUp={handleButtonRelease}
        onMouseLeave={handleButtonRelease}
        onMouseMove={handleMouseMove}
        disabled={isDisabled}
        style={{
          '--hover-x': `${hoverPosition.x}%`,
          '--hover-y': `${hoverPosition.y}%`
        } as any}
        {...props}
      >
        {/* Enhanced Ripple Container */}
        {ripples.map(ripple => (
          <span
            key={ripple.key}
            className="ripple-element"
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
              width: `${ripple.size}px`,
              height: `${ripple.size}px`,
              opacity: ripple.opacity
            }}
            onAnimationEnd={() => handleAnimationEnd(ripple.key)}
          />
        ))}
        
        {/* Preserve exact layout with a content container that doesn't change size */}
        <span class="content-container inline-flex items-center justify-center relative w-full">
          <span class="content-size-holder opacity-0 invisible absolute whitespace-pre">{children}</span>
          
          {/* Button Content with Icons Support - Use opacity for fade but keep position in layout flow */}
          <span
            class={`button-content flex items-center justify-center gap-2 leading-none transition-opacity duration-150 ${loading ? 'opacity-0' : 'opacity-100'}`}
            aria-hidden={loading}
          >
            {iconLeft && <span class="button-icon-left">{iconLeft}</span>}
            {children}
            {iconRight && <span class="button-icon-right">{iconRight}</span>}
          </span>
          
          {/* Enhanced Loading Indicator - Absolute position on top of content */}
          {loading && (
            <span class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <LoadingSpinner />
            </span>
          )}
        </span>
      </button>
    );
  }
);

// Enhanced component styles with modern aesthetics
const componentStyles = `
  /* Button base styling */
  .button {
    will-change: transform, opacity;
    transform: translateZ(0);
    backface-visibility: hidden;
  }
  
  /* Gradient backgrounds for texture */
  .button-gradient-primary {
    background-image: linear-gradient(
      to bottom right,
      color-mix(in srgb, var(--primary, #3b82f6) 92%, white) 0%,
      var(--primary, #3b82f6) 50%,
      color-mix(in srgb, var(--primary, #3b82f6) 92%, black) 100%
    );
    background-position: calc(var(--hover-x, 50%) * 1%) calc(var(--hover-y, 50%) * 1%);
    background-size: 200% 200%;
    transition: background-position 0.5s ease-out, transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  
  .button-gradient-secondary {
    background-image: linear-gradient(
      to bottom right,
      color-mix(in srgb, var(--secondary, #475569) 92%, white) 0%,
      var(--secondary, #475569) 50%,
      color-mix(in srgb, var(--secondary, #475569) 92%, black) 100%
    );
    background-position: calc(var(--hover-x, 50%) * 1%) calc(var(--hover-y, 50%) * 1%);
    background-size: 200% 200%;
    transition: background-position 0.5s ease-out, transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  
  .button-gradient-glass {
    background-image: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.4) 0%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.05) 100%
    );
    background-position: calc(var(--hover-x, 50%) * 1%) calc(var(--hover-y, 50%) * 1%);
    background-size: 200% 200%;
    transition: background-position 0.5s ease-out, transform 0.15s ease-out, box-shadow 0.15s ease-out;
  }
  
  /* Modern ripple effect with natural physics */
  .ripple-element {
    position: absolute;
    border-radius: 50%;
    transform: scale(0);
    animation: ripple-animation 600ms cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    z-index: 0;
    background-image: radial-gradient(
      circle,
      currentColor 0%,
      currentColor 20%,
      transparent 100%
    );
  }

  @keyframes ripple-animation {
    0% {
      transform: scale(0);
      opacity: var(--ripple-opacity, 0.2);
    }
    80% {
      opacity: 0;
    }
    100% {
      transform: scale(2.5);
      opacity: 0;
    }
  }

  /* Enhanced loading spinner with fluid animation */
  .button-spinner {
    position: relative;
    width: 1.25em;
    height: 1.25em;
    min-width: 16px;
    min-height: 16px;
  }

  /* Content container to maintain size */
  .content-container {
    min-height: 1.5em;
    display: grid;
    grid-template-areas: "content";
  }
  
  .content-container > * {
    grid-area: content;
  }
  
  /* Ensure content keeps its space in the layout */
  .button-content {
    box-sizing: border-box;
    max-width: 100%;
  }

  .spinner-ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    opacity: 0.4;
    animation: spinner-rotate 1s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
  }

  .spinner-core {
    position: absolute;
    top: 25%;
    left: 25%;
    width: 50%;
    height: 50%;
    background-color: currentColor;
    border-radius: 50%;
    opacity: 0.7;
    animation: spinner-pulse 1s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite alternate;
  }

  @keyframes spinner-rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes spinner-pulse {
    0% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    100% {
      transform: scale(1.1);
      opacity: 0.8;
    }
  }
  
  /* Dark mode optimization */
  @media (prefers-color-scheme: dark) {
    .button-gradient-primary {
      background-image: linear-gradient(
        to bottom right,
        color-mix(in srgb, var(--primary, #3b82f6) 90%, white) 0%,
        var(--primary, #3b82f6) 50%,
        color-mix(in srgb, var(--primary, #3b82f6) 90%, black) 100%
      );
    }
    
    .button-gradient-secondary {
      background-image: linear-gradient(
        to bottom right,
        color-mix(in srgb, var(--secondary, #475569) 90%, white) 0%,
        var(--secondary, #475569) 50%,
        color-mix(in srgb, var(--secondary, #475569) 90%, black) 100%
      );
    }
  }
  
  /* Reduce motion when needed */
  @media (prefers-reduced-motion) {
    .button, .ripple-element, .spinner-ring, .spinner-core {
      transition: none !important;
      animation-duration: 0.001ms !important;
    }
  }
`;

// Inject styles once
let stylesInjected = false;
if (typeof document !== 'undefined' && !stylesInjected) {
    try {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = componentStyles;
        document.head.appendChild(styleSheet);
        stylesInjected = true;
    } catch (e) {
        console.error("Failed to inject button component styles:", e);
    }
}

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize, type ButtonElevation };