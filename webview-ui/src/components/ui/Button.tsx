import { FunctionalComponent, h, ComponentProps } from 'preact';
import { forwardRef } from 'preact/compat';
import { useMemo, useState, useCallback, useRef, useEffect } from 'preact/hooks';
import 'uno.css';

// Enhanced button variants with texture-oriented design
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'glass';
// Added 'icon-sm' size
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'pill';
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

// Removed custom LoadingSpinner component

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
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
      buttonRef.current = node;
    };

    const [ripples, setRipples] = useState<Ripple[]>([]);
    const [isPressed, setIsPressed] = useState(false);
    const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
    const isDisabled = loading || disabled;

    useEffect(() => {
      return () => setRipples([]);
    }, []);

    const handleMouseMove = useCallback((event: h.JSX.TargetedMouseEvent<HTMLButtonElement>) => {
      if (isDisabled || variant === 'link') return;
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setHoverPosition({ x, y });
    }, [isDisabled, variant]);

    const baseStyles = `
      inline-flex items-center justify-center gap-2 whitespace-nowrap
      font-medium transition-all
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
      disabled:pointer-events-none disabled:opacity-50 ${loading ? 'cursor-wait' : ''}
      select-none relative overflow-hidden
      ${fullWidth ? 'w-full' : ''}
      motion-reduce:transition-none
    `;

    const elevationStyles = useMemo(() => {
      // Removed shadow styles for 'raised' and 'floating' - defaulting to 'flat'
      switch (elevation) {
        case 'raised':
        case 'floating':
        case 'flat':
        default: return '';
      }
    }, [elevation]);

    const variantStyles = useMemo(() => {
      switch (variant) {
        case 'secondary':
          // Removed button-gradient-secondary
          return 'bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/95 ' +
                 'dark:hover:bg-secondary/80 dark:active:bg-secondary/85';
        case 'outline':
          // Removed border classes, using background change for hover/active
          return 'bg-transparent hover:bg-accent/10 active:bg-accent/20 text-foreground';
        case 'ghost':
          return 'hover:bg-accent/10 active:bg-accent/20 text-foreground';
        case 'link':
          return 'text-primary underline-offset-4 hover:underline decoration-2 p-0 h-auto font-normal';
        case 'glass':
          // Removed border classes and button-gradient-glass
          return 'backdrop-blur-md bg-white/10 dark:bg-black/20 text-foreground hover:bg-white/20 dark:hover:bg-black/30 ' +
                 'active:bg-white/30 dark:active:bg-black/40';
        case 'primary': default:
          // Removed button-gradient-primary
          return 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 ' +
                 'dark:hover:bg-primary/85 dark:active:bg-primary/90';
      }
    }, [variant]);

    const sizeStyles = useMemo(() => {
      switch (size) {
        case 'sm': return 'text-xs h-8 rounded-lg px-3 py-1';
        case 'lg': return 'text-base h-12 rounded-xl px-6 py-2.5 font-medium';
        case 'icon': return 'h-10 w-10 rounded-full p-2.5';
        case 'icon-sm': return 'h-6 w-6 rounded-full p-1'; // Added icon-sm styles
        case 'pill': return 'text-sm h-10 rounded-full px-5 py-2';
        case 'md': default: return 'text-sm h-10 rounded-lg px-4 py-2';
      }
    }, [size]);

    const combinedClassName = `button ${baseStyles} ${elevationStyles} ${variantStyles} ${sizeStyles} ${className || ''}`.trim().replace(/\s+/g, ' ');

    const createRipple = useCallback((event: h.JSX.TargetedMouseEvent<HTMLButtonElement>) => {
      if (isDisabled) return;
      setIsPressed(true);
      if (variant !== 'link') {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        const key = Date.now();
        const newRipple: Ripple = {
          key, x, y, size,
          opacity: variant === 'outline' || variant === 'ghost' || variant === 'glass' ? 0.1 : 0.2,
          scale: 2.5
        };
        setRipples(prevRipples => [...prevRipples, newRipple]);
      }
      onClick?.(event);
    }, [onClick, isDisabled, variant]);

    const handleButtonRelease = useCallback(() => { setIsPressed(false); }, []);
    const handleAnimationEnd = useCallback((key: number) => { setRipples(prevRipples => prevRipples.filter(ripple => ripple.key !== key)); }, []);

    return (
      <button
        className={combinedClassName}
        ref={combinedRef}
        onClick={createRipple}
        onMouseUp={handleButtonRelease}
        onMouseLeave={handleButtonRelease}
        onMouseMove={handleMouseMove}
        disabled={isDisabled}
        style={{ '--hover-x': `${hoverPosition.x}%`, '--hover-y': `${hoverPosition.y}%` } as any}
        {...props}
      >
        {ripples.map(ripple => (
          <span
            key={ripple.key}
            className="ripple-element"
            style={{ left: `${ripple.x}px`, top: `${ripple.y}px`, width: `${ripple.size}px`, height: `${ripple.size}px`, opacity: ripple.opacity }}
            onAnimationEnd={() => handleAnimationEnd(ripple.key)}
          />
        ))}
        <span class="content-container inline-flex items-center justify-center relative w-full">
          <span class="content-size-holder opacity-0 invisible absolute whitespace-pre">{children}</span>
          <span
            class={`button-content flex items-center justify-center gap-2 leading-none transition-opacity duration-150 ${loading ? 'opacity-0' : 'opacity-100'}`}
            aria-hidden={loading}
          >
            {iconLeft && <span class="button-icon-left">{iconLeft}</span>}
            {children}
            {iconRight && <span class="button-icon-right">{iconRight}</span>}
          </span>
          {loading && (
            <span class="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Replaced custom spinner with UnoCSS icon (corrected name) */}
              <span class="i-carbon-circle-dash animate-spin h-4 w-4"></span>
            </span>
          )}
        </span>
      </button>
    );
  }
);

const componentStyles = `
  .button { will-change: transform, opacity; transform: translateZ(0); backface-visibility: hidden; }
  /* Removed button-gradient-* styles */
  .ripple-element { position: absolute; border-radius: 50%; transform: scale(0); animation: ripple-animation 600ms cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; z-index: 0; background-image: radial-gradient(circle, currentColor 0%, currentColor 20%, transparent 100%); }
  @keyframes ripple-animation { 0% { transform: scale(0); opacity: var(--ripple-opacity, 0.2); } 80% { opacity: 0; } 100% { transform: scale(2.5); opacity: 0; } }
  /* Removed .button-spinner, .spinner-ring, .spinner-core styles */
  .content-container { min-height: 1.5em; display: grid; grid-template-areas: "content"; }
  .content-container > * { grid-area: content; }
  .button-content { box-sizing: border-box; max-width: 100%; }
  /* Removed spinner animations */
  /* Removed dark mode gradient overrides */
  @media (prefers-reduced-motion) { .button, .ripple-element { transition: none !important; animation-duration: 0.001ms !important; } } /* Removed spinner refs */
`;

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