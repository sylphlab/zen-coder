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
    groupedOptions: Record<string, Option[]>; // Expect grouped data { region: [locations] }
    value: string | null; // Can be an option ID or a custom string
    onChange: (value: string | null) => void;
    placeholder?: string;
    disabled?: boolean;
    ariaLabel?: string;
    allowCustomValue?: boolean; // Allow entering values not in the list
    showId?: boolean; // Show the secondary ID in the dropdown list items
}

export function CustomSelect({
    groupedOptions,
    value,
    onChange,
    placeholder = '-- Select --',
    disabled = false,
    ariaLabel,
    allowCustomValue = false, // Default to false
    showId = true // Default to true
}: CustomSelectProps): JSX.Element {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(''); // For custom input
    const [filter, setFilter] = useState(''); // For filtering options
    const [highlightedIndex, setHighlightedIndex] = useState(-1); // For keyboard navigation
    const selectRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null); // Ref for input
    const listRef = useRef<HTMLUListElement>(null); // Ref for dropdown list

    // Find the option corresponding to the current value (if it exists)
    const selectedOption = useMemo(() => {
        for (const groupLabel in groupedOptions) {
            const found = groupedOptions[groupLabel].find(opt => opt.id === value);
            if (found) return found;
        }
        return null;
    }, [value, groupedOptions]);

    // Update inputValue to display the NAME corresponding to the external VALUE (ID)
    // This effect ensures the input displays the correct name when the external value changes.
    useEffect(() => {
        const currentSelectedOption = Object.values(groupedOptions).flat().find(opt => opt.id === value);
        const targetDisplayValue = currentSelectedOption ? currentSelectedOption.name : (value || '');
        // Update inputValue based on external value, but avoid overriding user input if dropdown is open
        if (!isOpen) {
             console.log(`[Sync Effect] Dropdown closed. Setting inputValue to "${targetDisplayValue}" based on external value "${value}"`);
             setInputValue(targetDisplayValue);
        } else {
             // If dropdown is open, maybe only sync if the value actually changed?
             // Or perhaps don't sync at all while open to prioritize user input? Let's not sync while open.
             console.log(`[Sync Effect] Dropdown open. Input: "${inputValue}", Target: "${targetDisplayValue}". Not syncing.`);
        }
        // Don't reset filter here
    }, [value, groupedOptions, isOpen]); // Depend on isOpen now

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen && allowCustomValue && inputRef.current) {
                 // Focus input when opening if custom values allowed
                 inputRef.current.focus();
            }
             // Reset filter and highlighted index when opening/closing
             setFilter('');
             setHighlightedIndex(-1);
         }
    };

    const handleSelect = (optionId: string) => {
        const option = Object.values(groupedOptions).flat().find(opt => opt.id === optionId);
        onChange(optionId); // Update external state
        setInputValue(option ? option.name : optionId); // Update internal input display to NAME or fallback to ID
        setFilter(''); // Clear filter
        setIsOpen(false);
    };

    const handleInputChange = (e: Event) => {
        const newValue = (e.target as HTMLInputElement).value;
        setInputValue(newValue);
        setFilter(newValue); // Update filter based on input
        setHighlightedIndex(-1); // Reset highlight on input change
        if (!isOpen) {
             setIsOpen(true); // Open dropdown if it wasn't already open
        }
    };

    const handleInputBlur = () => {
        // Use a small timeout to allow click event on dropdown item to register first
        setTimeout(() => {
            // Check if the dropdown is still open (e.g., user clicked an item)
            // We access isOpen state *inside* the timeout to get the latest value after the click event might have occurred.
            if (selectRef.current?.contains(document.activeElement)) {
                 // If focus is still within the component (e.g., on a list item), don't process blur yet.
                 // The click handler will close the dropdown.
                 return;
            }

            // If dropdown is closed or focus moved outside, proceed with blur logic.
            const trimmedValue = inputValue.trim();

            if (allowCustomValue) {
                // If custom values allowed, accept the input value if it changed
                if (trimmedValue !== (selectedOption?.name ?? (value || ''))) {
                    console.log(`[Blur] Custom allowed. Input "${trimmedValue}" differs from current value name "${selectedOption?.name ?? value}". Updating.`);
                    onChange(trimmedValue || null); // Update external state with the custom value (or null if empty)
                } else {
                    console.log(`[Blur] Custom allowed. Input "${trimmedValue}" matches current value name or is same. No change.`);
                }
                setIsOpen(false); // Ensure dropdown is closed
            } else {
                // If custom values NOT allowed, try to autocomplete or revert
                const flatFilteredOptions = Object.values(filteredAndGroupedOptions).flat();
                const exactMatchByName = Object.values(groupedOptions).flat().find(opt => opt.name.toLowerCase() === trimmedValue.toLowerCase());

                if (exactMatchByName) {
                    // Exact name match found - select it
                    console.log(`[Blur] Selecting exact name match: ${exactMatchByName.id}`);
                    handleSelect(exactMatchByName.id); // handleSelect updates value, input, and closes
                } else if (flatFilteredOptions.length === 1 && trimmedValue !== '') {
                    // Single option left after filtering - select it
                    const singleOption = flatFilteredOptions[0];
                    console.log(`[Blur] Autocompleting to single filtered option: ${singleOption.id}`);
                    handleSelect(singleOption.id); // handleSelect updates value, input, and closes
                } else {
                    // No exact match, not single filter, or input empty - REVERT input display
                    console.log("[Blur] No valid selection or input empty, reverting input display.");
                    setInputValue(selectedOption ? selectedOption.name : ''); // Revert to selected option's name or empty
                    setIsOpen(false); // Ensure dropdown is closed
                }
            }
        }, 150); // Timeout allows click on option to register before blur logic runs
    };

     const handleInputKeyDown = (e: KeyboardEvent) => {
        const flatFilteredOptions = Object.values(filteredAndGroupedOptions).flat();
        const totalOptions = flatFilteredOptions.length;

        switch (e.key) {
            case 'Enter': {
                e.preventDefault(); // Prevent form submission if any
                if (highlightedIndex >= 0 && highlightedIndex < totalOptions) {
                    // If an item is highlighted via keyboard nav, select it
                    console.log(`[Enter] Selecting highlighted option: ${flatFilteredOptions[highlightedIndex].id}`);
                    handleSelect(flatFilteredOptions[highlightedIndex].id);
                } else {
                    // Otherwise, use the existing logic based on input value
                    const trimmedValue = inputValue.trim();
                    const exactMatchByName = Object.values(groupedOptions).flat().find(opt => opt.name.toLowerCase() === trimmedValue.toLowerCase());

                    if (exactMatchByName) {
                        console.log(`[Enter] Selecting exact name match: ${exactMatchByName.id}`);
                        handleSelect(exactMatchByName.id);
                    } else if (!allowCustomValue && flatFilteredOptions.length === 1 && trimmedValue !== '') {
                        // Only autocomplete single filter if custom values are NOT allowed
                        console.log(`[Enter] Autocompleting to single filtered option: ${flatFilteredOptions[0].id}`);
                        handleSelect(flatFilteredOptions[0].id);
                    } else if (allowCustomValue) {
                        // If no match and custom values allowed, accept the input
                        console.log(`[Enter] Accepting custom value: ${trimmedValue}`);
                        if (trimmedValue !== (selectedOption?.name ?? (value || ''))) { // Only call onChange if value actually changes
                             onChange(trimmedValue || null);
                        }
                        setIsOpen(false);
                        if (inputRef.current) inputRef.current.blur(); // Blur after accepting
                    } else {
                        // Revert if not allowing custom, and no exact/single match
                        console.log("[Enter] Custom value not allowed or ambiguous, reverting input display.");
                        setInputValue(selectedOption ? selectedOption.name : '');
                        setIsOpen(false);
                        if (inputRef.current) inputRef.current.blur(); // Blur after reverting
                    }
                }
                break;
            }
            case 'ArrowDown': {
                e.preventDefault();
                if (!isOpen) setIsOpen(true); // Open if closed
                const nextIndex = (highlightedIndex + 1) % totalOptions;
                setHighlightedIndex(nextIndex);
                scrollToOption(nextIndex);
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                if (!isOpen) setIsOpen(true); // Open if closed
                const prevIndex = (highlightedIndex - 1 + totalOptions) % totalOptions;
                setHighlightedIndex(prevIndex);
                scrollToOption(prevIndex);
                break;
            }
            case 'Escape': {
                setIsOpen(false);
                setInputValue(selectedOption ? selectedOption.name : ''); // Revert input on escape
                if (inputRef.current) inputRef.current.blur();
                break;
            }
            default:
                // Reset highlight if typing other keys
                setHighlightedIndex(-1);
                break;
        }
    };

    // Helper to scroll the highlighted option into view
    const scrollToOption = (index: number) => {
        if (listRef.current && index >= 0) {
            const optionElement = listRef.current.querySelectorAll('[role="option"]')[index] as HTMLLIElement;
            if (optionElement) {
                optionElement.scrollIntoView({ block: 'nearest' });
            }
        }
    };

    // Close dropdown when clicking outside
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

    // Filtered and sorted options based on input filter
    const filteredAndGroupedOptions = useMemo(() => {
        if (!filter) {
            return groupedOptions; // Return all if no filter
        }
        const lowerCaseFilter = filter.toLowerCase();
        const result: Record<string, Option[]> = {};
        for (const groupLabel in groupedOptions) {
            const filtered = groupedOptions[groupLabel].filter(
                opt => opt.id.toLowerCase().includes(lowerCaseFilter) || opt.name.toLowerCase().includes(lowerCaseFilter)
            );
            if (filtered.length > 0) {
                result[groupLabel] = filtered;
            }
        }
        return result;
    }, [filter, groupedOptions]);

    // Sort group labels alphabetically based on filtered results
    const sortedGroupLabels = useMemo(() => Object.keys(filteredAndGroupedOptions).sort(), [filteredAndGroupedOptions]);
    const hasFilteredOptions = useMemo(() => sortedGroupLabels.length > 0, [sortedGroupLabels]);


    return (
        <div class={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} ref={selectRef} aria-label={ariaLabel}>
            {/* Always render the input element */}
            <div class="relative">
                <input
                    ref={inputRef}
                    type="text"
                    class="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none pr-6" // Add padding for arrow
                    // Always bind input value to the inputValue state for free typing
                    value={inputValue}
                    placeholder={placeholder}
                    disabled={disabled}
                    onInput={handleInputChange}
                    onFocus={() => { setIsOpen(true); setFilter(''); }} // Open and clear filter on focus
                    onBlur={handleInputBlur}
                    onKeyDown={handleInputKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-autocomplete="list"
                    // Add aria-activedescendant for keyboard navigation accessibility
                    aria-activedescendant={highlightedIndex >= 0 ? `option-${Object.values(filteredAndGroupedOptions).flat()[highlightedIndex]?.id}` : undefined}
                />
                {/* Arrow inside input */}
                <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                     <svg class={`w-3 h-3 fill-current text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
            {/* Removed conditional rendering and button */}

            {/* Dropdown List */}
            {isOpen && (
                <div class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
                    <ul role="listbox" ref={listRef}> {/* Add ref to list */}
                        {(() => {
                            let flatIndex = -1; // Keep track of the overall index for highlighting
                            return sortedGroupLabels.map(groupLabel => (
                                <li key={groupLabel}>
                                    <div class="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 sticky top-0 bg-gray-100 dark:bg-gray-800">{groupLabel}</div>
                                    <ul>
                                        {filteredAndGroupedOptions[groupLabel] // Use filtered options
                                            .sort((a, b) => a.id.localeCompare(b.id)) // Sort within group
                                            .map(option => {
                                                flatIndex++;
                                                const isHighlighted = flatIndex === highlightedIndex;
                                                return (
                                                    <li
                                                        key={option.id}
                                                        id={`option-${option.id}`} // Add ID for aria-activedescendant
                                                        class={`px-3 py-1.5 text-xs cursor-pointer ${isHighlighted ? 'bg-blue-100 dark:bg-blue-800' : 'hover:bg-blue-100 dark:hover:bg-blue-800'} ${value === option.id ? 'bg-blue-200 dark:bg-blue-700 font-semibold' : ''}`}
                                                        onClick={() => handleSelect(option.id)}
                                                        onMouseEnter={() => setHighlightedIndex(flatIndex)} // Highlight on mouse enter
                                                        role="option"
                                                        aria-selected={value === option.id || isHighlighted}
                                                    >
                                                        {/* Flex container for Name and ID, ensure Name takes priority */}
                                                        <div class="flex justify-between items-center gap-2">
                                                            {/* Name primary, allow truncation, takes up available space */}
                                                            <span class={`truncate flex-grow ${value === option.id ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>{option.name}</span>
                                                            {/* ID secondary, conditional rendering, prevent shrinking */}
                                                            {showId && (
                                                                <span class={`flex-shrink-0 ${value === option.id ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>{option.id}</span>
                                                            )}
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                    </ul>
                                </li>
                            ));
                        })()}
                         {!hasFilteredOptions && ( // Show message if filter yields no results
                            <li class="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 italic">
                                {filter ? 'No matching options' : 'No options available'}
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}