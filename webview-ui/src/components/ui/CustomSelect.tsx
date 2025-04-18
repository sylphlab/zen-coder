import { useState, useRef, useEffect, useMemo } from 'preact/hooks';
import { JSX } from 'preact/jsx-runtime';

interface Option {
    id: string;
    name: string;
}

interface OptionGroup {
    label: string;
    options: Option[];
}

interface CustomSelectProps {
    groupedOptions: Record<string, Option[]>;
    value: string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
    ariaLabel?: string;
    allowCustomValue?: boolean;
    showId?: boolean;
    openDirection?: 'up' | 'down';
}

export function CustomSelect({
    groupedOptions,
    value,
    onChange,
    placeholder = '-- Select --',
    disabled = false,
    ariaLabel,
    allowCustomValue = false,
    showId = true,
    openDirection = 'down'
}: CustomSelectProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [filter, setFilter] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const selectRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selectedOption = useMemo(() => {
        for (const groupLabel in groupedOptions) {
            const found = groupedOptions[groupLabel].find(opt => opt.id === value);
            if (found) return found;
        }
        return null;
    }, [value, groupedOptions]);

    useEffect(() => {
        const currentSelectedOption = Object.values(groupedOptions).flat().find(opt => opt.id === value);
        const targetDisplayValue = currentSelectedOption ? currentSelectedOption.name : (value || '');
        if (!isOpen) {
            setInputValue(targetDisplayValue);
        }
    }, [value, groupedOptions, isOpen]);

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen && allowCustomValue && inputRef.current) {
                 inputRef.current.focus();
            }
             setFilter('');
             setHighlightedIndex(-1);
         }
    };

    const handleSelect = (optionId: string) => {
        const option = Object.values(groupedOptions).flat().find(opt => opt.id === optionId);
        onChange(optionId);
        setInputValue(option ? option.name : optionId);
        setFilter('');
        setIsOpen(false);
    };

    const handleInputChange = (e: Event) => {
        const newValue = (e.target as HTMLInputElement).value;
        setInputValue(newValue);
        setFilter(newValue);
        setHighlightedIndex(-1);
        if (!isOpen) {
             setIsOpen(true);
        }
    };

    // Simplified Blur Handler - Primarily closes dropdown and resets input if no valid selection made via click/enter
    const handleInputBlur = () => {
        // Use a short timeout to allow click events on dropdown items to process first
        setTimeout(() => {
            // Check if focus is still within the select component (e.g., user clicked an option)
            if (selectRef.current?.contains(document.activeElement)) {
                return; // Don't close if focus moved to an option
            }

            // If dropdown is open after the timeout, close it and reset input to selected value
            if (isOpen) {
                 setIsOpen(false);
                 // Reset input value to the currently selected option's name or empty if none/invalid
                 const currentSelectedOption = Object.values(groupedOptions).flat().find(opt => opt.id === value);
                 setInputValue(currentSelectedOption ? currentSelectedOption.name : '');
                 setFilter(''); // Clear filter on close
            }
            // Do not automatically select or change value on blur unless allowCustomValue is handled separately if needed
        }, 150); // Keep a short delay
    };

     const handleInputKeyDown = (e: KeyboardEvent) => {
        const flatFilteredOptions = Object.values(filteredAndGroupedOptions).flat();
        const totalOptions = flatFilteredOptions.length;
        switch (e.key) {
            case 'Enter': {
                e.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < totalOptions) {
                    handleSelect(flatFilteredOptions[highlightedIndex].id);
                } else {
                    const trimmedValue = inputValue.trim();
                    const exactMatchByName = Object.values(groupedOptions).flat().find(opt => opt.name.toLowerCase() === trimmedValue.toLowerCase());
                    if (exactMatchByName) {
                        handleSelect(exactMatchByName.id);
                    } else if (!allowCustomValue && flatFilteredOptions.length === 1 && trimmedValue !== '') {
                        handleSelect(flatFilteredOptions[0].id);
                    } else if (allowCustomValue) {
                        if (trimmedValue !== (selectedOption?.name ?? (value || ''))) {
                             onChange(trimmedValue || null);
                        }
                        setIsOpen(false);
                        if (inputRef.current) inputRef.current.blur();
                    } else {
                        setInputValue(selectedOption ? selectedOption.name : '');
                        setIsOpen(false);
                        if (inputRef.current) inputRef.current.blur();
                    }
                }
                break;
            }
            case 'ArrowDown': {
                e.preventDefault();
                if (!isOpen) setIsOpen(true);
                const nextIndex = (highlightedIndex + 1) % totalOptions;
                setHighlightedIndex(nextIndex);
                scrollToOption(nextIndex);
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                if (!isOpen) setIsOpen(true);
                const prevIndex = (highlightedIndex - 1 + totalOptions) % totalOptions;
                setHighlightedIndex(prevIndex);
                scrollToOption(prevIndex);
                break;
            }
            case 'Escape': {
                setIsOpen(false);
                setInputValue(selectedOption ? selectedOption.name : '');
                if (inputRef.current) inputRef.current.blur();
                break;
            }
            default:
                setHighlightedIndex(-1);
                break;
        }
    };

    const scrollToOption = (index: number) => {
        if (listRef.current && index >= 0) {
            const optionElement = listRef.current.querySelectorAll('[role="option"]')[index] as HTMLLIElement;
            if (optionElement) {
                optionElement.scrollIntoView({ block: 'nearest' });
            }
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const filteredAndGroupedOptions = useMemo(() => {
        if (!filter) return groupedOptions;
        const lowerCaseFilter = filter.toLowerCase();
        const result: Record<string, Option[]> = {};
        for (const groupLabel in groupedOptions) {
            const filtered = groupedOptions[groupLabel].filter(
                opt => opt.id.toLowerCase().includes(lowerCaseFilter) || opt.name.toLowerCase().includes(lowerCaseFilter)
            );
            if (filtered.length > 0) result[groupLabel] = filtered;
        }
        return result;
    }, [filter, groupedOptions]);

    const sortedGroupLabels = useMemo(() => Object.keys(filteredAndGroupedOptions).sort(), [filteredAndGroupedOptions]);
    const hasFilteredOptions = useMemo(() => sortedGroupLabels.length > 0, [sortedGroupLabels]);

    // Dynamic classes for input - No rounding or background
    const inputClasses = useMemo(() => {
        return "w-full p-1.5 text-xs focus:outline-none pr-6 bg-transparent transition-colors duration-150 ease-in-out";
    }, []);

     // Dynamic classes for dropdown list - Handles shadow, rounding, width, positioning
    const dropdownClasses = useMemo(() => {
        // Removed shadow-lg rounded-md, added border for structure
        let base = `absolute z-10 min-w-full min-w-max bg-[var(--vscode-dropdown-background)] text-[var(--vscode-dropdown-foreground)] max-h-60 overflow-y-auto border border-[var(--vscode-dropdown-border)]`; // Use dropdown border
        if (openDirection === 'up') {
            base += " bottom-full"; // Position above
        } else {
            base += " top-full"; // Position below
        }
        return base;
    }, [openDirection]);

    // Dynamic classes for the main container - Just relative positioning
    const containerClasses = useMemo(() => {
        let base = `relative`;
        if (disabled) base += ' opacity-50 cursor-not-allowed';
        // No shadow or rounding here
        return base;
    }, [disabled]);

    // Dynamic classes for the input wrapper div (handles hover when closed, bg and NO rounding/border when open)
     const inputWrapperClasses = useMemo(() => {
        let base = `relative flex items-center`; // Removed border
        if (!isOpen) {
            // Apply rounding and hover only when closed
            base += ' rounded-md hover:bg-[var(--vscode-list-hoverBackground)]';
        } else {
             // When open, match dropdown background, NO rounding
             base += ` bg-[var(--vscode-dropdown-background)]`;
        }
        return base;
     }, [isOpen]);


    return (
        <div class={containerClasses} ref={selectRef} aria-label={ariaLabel}>
            {/* Input container */}
            <div class={inputWrapperClasses}>
                <input
                    ref={inputRef}
                    type="text"
                    class={`w-full p-1.5 text-xs bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--vscode-focusBorder)] pr-6`} // Changed focus:border to focus:ring
                    value={inputValue}
                    placeholder={placeholder}
                    disabled={disabled}
                    onInput={handleInputChange}
                    onFocus={() => { setIsOpen(true); setFilter(''); }}
                    onBlur={handleInputBlur}
                    onKeyDown={handleInputKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-autocomplete="list"
                    aria-activedescendant={highlightedIndex >= 0 ? `option-${Object.values(filteredAndGroupedOptions).flat()[highlightedIndex]?.id}` : undefined}
                />
                {/* Arrow inside input - Replaced SVG with UnoCSS icon */}
                <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                     <span class={`i-carbon-chevron-down w-3 h-3 text-[var(--vscode-foreground)] opacity-60 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}></span>
                </div>
            </div>

            {/* Dropdown List */}
            {isOpen && (
                <div class={dropdownClasses}> {/* Dropdown handles shadow and rounding */}
                    <ul role="listbox" ref={listRef}>
                        {(() => {
                            let flatIndex = -1;
                            return sortedGroupLabels.map(groupLabel => (
                                <li key={groupLabel}>
                                    <div class="px-3 py-1 text-xs font-semibold text-[var(--vscode-foreground)] opacity-60 sticky top-0 bg-[var(--vscode-dropdown-background)]">{groupLabel}</div>
                                    <ul>
                                        {filteredAndGroupedOptions[groupLabel]
                                            .sort((a, b) => a.id.localeCompare(b.id))
                                            .map(option => {
                                                flatIndex++;
                                                const isHighlighted = flatIndex === highlightedIndex;
                                                return (
                                                    <li
                                                        key={option.id}
                                                        id={`option-${option.id}`}
                                                        class={`px-3 py-1.5 text-xs cursor-pointer
                                                            ${isHighlighted ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]' : 'hover:bg-[var(--vscode-list-hoverBackground)]'}
                                                            ${value === option.id ? 'bg-[var(--vscode-list-focusBackground)] font-semibold' : ''}`}
                                                            onMouseDown={() => handleSelect(option.id)} // Use onMouseDown instead of onClick
                                                            onMouseEnter={() => setHighlightedIndex(flatIndex)}
                                                        role="option"
                                                        aria-selected={value === option.id || isHighlighted}
                                                    >
                                                        <div class="flex justify-between items-center gap-2">
                                                            <span class="flex-grow text-[var(--vscode-dropdown-foreground)]">{option.name}</span>
                                                            {showId && (
                                                                <span class="flex-shrink-0 text-xxs text-[var(--vscode-foreground)] opacity-40">{option.id}</span>
                                                            )}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                    </ul>
                                </li>
                            ));
                        })()}
                         {!hasFilteredOptions && (
                            <li class="px-3 py-1.5 text-xs text-[var(--vscode-foreground)] opacity-60 italic">
                                {filter ? 'No matching options' : 'No options available'}
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}