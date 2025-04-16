import { useState, useMemo, useCallback, useEffect } from 'preact/hooks'; // Added useEffect
import { useStore } from '@nanostores/react';
import { JSX } from 'preact/jsx-runtime';
import { ProviderInfoAndStatus } from '../../../../src/common/types'; // Removed LocationWithRegion import
import { requestData } from '../../utils/communication'; // Added requestData import
import { CustomSelect } from '../ui/CustomSelect'; // Updated import path
import {
    $providerStatus,
    $setApiKey,
    $deleteApiKey,
    $setProviderEnabled,
} from '../../stores/providerStores';

// Define LocationWithRegion interface locally
interface LocationWithRegion {
    id: string;
    name: string;
    region: string;
}

export function ProviderSettings(): JSX.Element {
    // --- State from Stores ---
    const providerStatus = useStore($providerStatus);
    const { mutate: setApiKeyMutate, loading: isSettingKey } = useStore($setApiKey);
    const { mutate: deleteApiKeyMutate, loading: isDeletingKey } = useStore($deleteApiKey);
    const { mutate: setProviderEnabledMutate, loading: isTogglingEnabled } = useStore($setProviderEnabled); // Keep this hook

    // Ensure loading check uses 'loading' state or checks if it's not an array
    const isLoadingProviders = !Array.isArray(providerStatus); // Simpler check: if it's not an array, it's loading or error

    // --- Local State ---
    // Store credentials JSON, project ID, and location separately
    const [credentialsJsonInput, setCredentialsJsonInput] = useState<{ [providerId: string]: string }>({});
    const [projectIdInput, setProjectIdInput] = useState<{ [providerId: string]: string }>({});
    const [locationInput, setLocationInput] = useState<{ [providerId: string]: string }>({});
    const [searchQuery, setSearchQuery] = useState('');
    // State for fetched projects and locations
    const [vertexProjects, setVertexProjects] = useState<{ id: string; name: string }[]>([]);
    // Update state type to use locally defined LocationWithRegion
    const [vertexLocations, setVertexLocations] = useState<LocationWithRegion[]>([]);
    const [isFetchingProjects, setIsFetchingProjects] = useState(false);
    // Removed isFetchingLocations

    const handleCredentialsJsonChange = (providerId: string, value: string) => {
        // Update the JSON input state immediately
        setCredentialsJsonInput(prev => ({ ...prev, [providerId]: value }));

        // Attempt to parse and pre-fill project ID and location
        if (providerId === 'vertex') { // Only do this for Vertex
            try {
                const parsedJson = JSON.parse(value);
                if (parsedJson && typeof parsedJson === 'object') {
                    if (parsedJson.project_id && typeof parsedJson.project_id === 'string') {
                        // Pre-fill project ID only if the input field is currently empty
                        // to avoid overwriting user's manual input during typing.
                        // Alternatively, always update if JSON changes? Let's always update for simplicity.
                        setProjectIdInput(prev => ({ ...prev, [providerId]: parsedJson.project_id }));
                    }
                    if (parsedJson.location && typeof parsedJson.location === 'string') {
                        // Pre-fill location
                        setLocationInput(prev => ({ ...prev, [providerId]: parsedJson.location }));
                    }
                }
            } catch (e) {
                // Ignore parsing errors, don't pre-fill if JSON is invalid
                // console.debug("JSON parsing failed during pre-fill attempt:", e);
            }
        }
    };

    const handleProjectIdChange = (providerId: string, value: string) => {
        setProjectIdInput(prev => ({ ...prev, [providerId]: value }));
    };

    const handleLocationChange = (providerId: string, value: string) => {
        setLocationInput(prev => ({ ...prev, [providerId]: value }));
    };

    const handleSetCredentials = (providerId: string, isComplex: boolean) => {
        const credentialsJson = credentialsJsonInput[providerId]?.trim();
        const projectId = projectIdInput[providerId]?.trim();
        const location = locationInput[providerId]?.trim();

        if (!credentialsJson) {
            console.warn(`Credentials JSON/API Key input for ${providerId} is empty.`);
            // TODO: Show error to user
            return;
        }

        let payloadValue: string; // Backend expects a string (either simple key or stringified object)
        if (isComplex) {
            // Construct the complex object
            const complexCredentials = {
                credentialsJson: credentialsJson,
                ...(projectId && { projectId: projectId }), // Include only if not empty
                ...(location && { location: location }),   // Include only if not empty
            };
            // Stringify the object to send to the backend
            try {
                payloadValue = JSON.stringify(complexCredentials);
            } catch (e) {
                console.error(`Error stringifying complex credentials for ${providerId}:`, e);
                // TODO: Show error to user
                return;
            }
        } else {
            // Simple API key
            payloadValue = credentialsJson;
        }

        console.log(`Setting Credentials for ${providerId} via mutation store`);
        setApiKeyMutate({ provider: providerId, apiKey: payloadValue }) // 'apiKey' holds the stringified object or simple key
            .then(() => {
                console.log(`Credentials set request successful for ${providerId}`);
                // Clear inputs on success
                setCredentialsJsonInput(prev => ({ ...prev, [providerId]: '' }));
                setProjectIdInput(prev => ({ ...prev, [providerId]: '' }));
                setLocationInput(prev => ({ ...prev, [providerId]: '' }));
                // Update relies on backend push
            })
            .catch((error: any) => { // Add type for error
                console.error(`Error setting Credentials for ${providerId}:`, error);
                // TODO: Show error
            });
    }; // Correctly closed handleSetCredentials

    const handleDeleteApiKey = (providerId: string) => {
        console.log(`Deleting Credentials for ${providerId} via mutation store`);
        deleteApiKeyMutate({ provider: providerId })
            .then(() => {
                console.log(`Credentials delete request successful for ${providerId}`);
                // Update relies on backend push
            })
            .catch((error: any) => { // Add type for error
                console.error(`Error deleting Credentials for ${providerId}:`, error);
                // TODO: Show error
            });
    };

    const handleSearchChange = (e: Event) => {
        setSearchQuery((e.target as HTMLInputElement).value);
    };

    const onProviderToggle = useCallback((providerId: string, enabled: boolean) => {
        console.log(`Requesting toggle provider ${providerId} to ${enabled} via mutation store`);
        setProviderEnabledMutate({ provider: providerId, enabled: enabled }) // Use the mutation function
            .then(() => console.log(`Provider ${providerId} enabled status request sent.`))
            .catch((error: any) => console.error(`Error setting provider ${providerId} enabled status:`, error)); // Add type for error
        // Update relies on backend push
    }, [setProviderEnabledMutate]); // Add dependency

    const filteredProviders = useMemo(() => {
        // Ensure providerStatus is an array before filtering
        const currentProviderStatus = Array.isArray(providerStatus) ? providerStatus : [];
        if (!searchQuery) {
            return currentProviderStatus;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return currentProviderStatus.filter((provider) =>
            provider.name.toLowerCase().includes(lowerCaseQuery) ||
            provider.id.toLowerCase().includes(lowerCaseQuery)
        );
    }, [searchQuery, providerStatus]);

    // Effect to fetch projects/locations when Vertex credentials are set
    useEffect(() => {
        const vertexStatus = Array.isArray(providerStatus)
            ? providerStatus.find(p => p.id === 'vertex')
            : undefined;

        if (vertexStatus?.credentialsSet && vertexStatus.enabled) {
            // Fetch projects if not already fetched
            if (vertexProjects.length === 0 && !isFetchingProjects) {
                console.log('[ProviderSettings Effect] Fetching Vertex static data (projects/locations)...');
                // Use a single flag for fetching static data
                setIsFetchingProjects(true); // Re-use existing flag for simplicity
                // Update the expected return type for requestData to include LocationWithRegion
                requestData<{ projects: { id: string; name: string }[], locations: LocationWithRegion[] }>('getVertexStaticData')
                    .then(data => {
                        console.log('[ProviderSettings Effect] Fetched static data:', data);
                        // Set both projects (empty) and locations from the response
                        setVertexProjects(data?.projects || []);
                        setVertexLocations(data?.locations || []);
                    })
                    .catch(error => {
                        console.error('[ProviderSettings Effect] Error fetching Vertex static data:', error);
                        // Optionally show error to user
                        setVertexProjects([]); // Clear on error
                        setVertexLocations([]); // Clear on error
                    })
                    .finally(() => setIsFetchingProjects(false)); // Re-use existing flag for static data fetch
            }
            // Removed the separate location fetching logic as it's now included in getVertexStaticData
        } else {
            // Clear projects/locations if credentials are removed or provider disabled
            if (vertexProjects.length > 0) setVertexProjects([]);
            if (vertexLocations.length > 0) setVertexLocations([]);
        }
    // Depend only on providerStatus to trigger fetching static data when Vertex is enabled/credentials set
    }, [providerStatus]); // Simplified dependencies


    // Helper function to group locations by region - update type hint
    const groupLocationsByRegion = (locations: LocationWithRegion[]) => {
        return locations.reduce((acc, loc) => {
            (acc[loc.region] = acc[loc.region] || []).push(loc);
            return acc;
        }, {} as Record<string, LocationWithRegion[]>);
    };

    const renderProviderSetting = (providerInfo: ProviderInfoAndStatus): JSX.Element => {
        // Destructure all properties including new ones
        const { id, name, apiKeyUrl, apiKeyDescription, requiresApiKey, enabled, credentialsSet, usesComplexCredentials, currentProjectId, currentLocation } = providerInfo;

        // Memoize grouped locations for CustomSelect
        const groupedVertexLocations = useMemo(() => groupLocationsByRegion(vertexLocations), [vertexLocations]);
        const keyLabel = usesComplexCredentials ? '憑證' : 'API Key'; // Simplified label
        const keyStatusText = credentialsSet ? `(${keyLabel} 已設定)` : `(${keyLabel} 未設定)`;
        const keyStatusColor = credentialsSet ? 'green' : 'red';

        // Determine if the set button should be disabled
        const isSetButtonDisabled = !credentialsJsonInput[id]?.trim() || isSettingKey || isDeletingKey;

        return (
            <li key={id} class="provider-setting-item mb-4 p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div class="flex items-center justify-between mb-3">
                    <label class="flex items-center font-semibold text-lg">
                        <input
                            type="checkbox"
                            class="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            checked={enabled}
                            onChange={(e) => onProviderToggle(id, (e.target as HTMLInputElement).checked)}
                            disabled={isTogglingEnabled} // Disable toggle during action
                        />
                        {name}
                    </label>
                    <span class={`text-sm font-medium ${keyStatusColor === 'green' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{keyStatusText}</span>
                </div>
                {requiresApiKey && (
                    <div class="mt-3 space-y-2">
                        <div class="flex flex-col space-y-2"> {/* Main container for inputs + buttons */}
                            {/* Credentials JSON Input (Textarea or Input) */}
                            <div class="flex items-start space-x-2">
                                {usesComplexCredentials ? (
                                    <textarea
                                        class="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-xs"
                                        placeholder={`貼上 ${name} JSON 憑證...`}
                                        value={credentialsJsonInput[id] || ''}
                                        onInput={(e) => handleCredentialsJsonChange(id, (e.target as HTMLTextAreaElement).value)}
                                        aria-label={`${name} JSON Credentials Input`}
                                        disabled={isSettingKey || isDeletingKey}
                                        rows={4}
                                    />
                                ) : (
                                    <input
                                        type="password"
                                        class="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder={`輸入 ${name} API Key...`}
                                        value={credentialsJsonInput[id] || ''} // Still use credentialsJsonInput for simple keys
                                        onInput={(e) => handleCredentialsJsonChange(id, (e.target as HTMLInputElement).value)}
                                        aria-label={`${name} API Key Input`}
                                        disabled={isSettingKey || isDeletingKey}
                                    />
                                )}
                                {/* Buttons (Set/Delete) */}
                                <div class="flex flex-col space-y-1 flex-shrink-0">
                                    <button
                                        class={`px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSettingKey ? 'animate-pulse' : ''}`}
                                        onClick={() => handleSetCredentials(id, !!usesComplexCredentials)} // Pass complex flag
                                        disabled={isSetButtonDisabled}
                                        aria-label={`Set ${name} ${keyLabel}`}
                                    >
                                        {isSettingKey ? '設定中...' : '設定'}
                                    </button>
                                    {credentialsSet && (
                                        <button
                                            class={`px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${isDeletingKey ? 'animate-pulse' : ''}`}
                                            onClick={() => handleDeleteApiKey(id)} // Delete still uses the same logic
                                            disabled={isSettingKey || isDeletingKey}
                                            aria-label={`Delete ${name} ${keyLabel}`}
                                        >
                                            刪除
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Optional Project ID and Location Inputs for Complex Credentials */}
                            {usesComplexCredentials && (
                                <div class="grid grid-cols-2 gap-2 mt-2">
                                    <div>
                                        <label htmlFor={`project-id-${id}`} class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Project ID (選填)</label>
                                        {vertexProjects.length > 0 ? (
                                            <select
                                                id={`project-id-${id}`}
                                                class="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                value={projectIdInput[id] || currentProjectId || ''} // Use currentProjectId from status as initial value
                                                onChange={(e) => handleProjectIdChange(id, (e.target as HTMLSelectElement).value)}
                                                aria-label={`${name} Project ID Select`}
                                                disabled={isSettingKey || isDeletingKey || isFetchingProjects} // Keep disabled while fetching static data
                                            >
                                                {/* Project list is now always empty based on static handler */}
                                                <option value="">{isFetchingProjects ? '載入中...' : '-- Project (手動輸入) --'}</option>
                                                {/* Removed mapping over vertexProjects as it's always empty */}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                id={`project-id-${id}`}
                                                class="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                placeholder={currentProjectId || "你的 GCP Project ID"} // Removed loading text
                                                value={projectIdInput[id] || ''}
                                                onInput={(e) => handleProjectIdChange(id, (e.target as HTMLInputElement).value)}
                                                aria-label={`${name} Project ID Input`}
                                                disabled={isSettingKey || isDeletingKey} // Only disable based on key actions
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <label htmlFor={`location-${id}`} class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Location (選填)</label>
                                        {/* Replace standard select with CustomSelect */}
                                        <CustomSelect
                                            groupedOptions={groupedVertexLocations}
                                            value={locationInput[id] || currentLocation || null} // Pass null if no value
                                            onChange={(value) => handleLocationChange(id, value || '')} // Handle null from onChange
                                            placeholder={isFetchingProjects ? '載入中...' : '-- 選擇或輸入 Location --'} // Update placeholder
                                            disabled={isSettingKey || isDeletingKey || isFetchingProjects}
                                            ariaLabel={`${name} Location Select`}
                                            allowCustomValue={true} // Enable custom value input
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Description and Link */}
                            {(apiKeyUrl || apiKeyDescription) && (
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    {apiKeyDescription || `喺呢度攞 ${keyLabel}:`}
                                    {apiKeyUrl && <a href={apiKeyUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline ml-1">{apiKeyUrl}</a>}
                                </p>
                            )}
                        </div> {/* Close space-y-2 div */}
                    </div> // Close requiresApiKey div
                )}
            </li> // Close li
        ); // Close return for renderProviderSetting
    }; // Close renderProviderSetting function

    return (
        <section class="mb-8">
            <h3 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">AI Providers</h3>
            <div class="mb-4">
                <input
                    type="text"
                    placeholder="搜索 Provider..."
                    value={searchQuery}
                    onInput={handleSearchChange}
                    class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    aria-label="Search Providers"
                />
            </div>

            {isLoadingProviders && <p class="text-gray-500 dark:text-gray-400">正在載入 Provider 狀態...</p>}
            {/* Handle error state - If not loading and not an array, assume error */}
            {!isLoadingProviders && !Array.isArray(providerStatus) && <p class="text-red-500 dark:text-red-400">載入 Provider 狀態時發生錯誤。</p>}
            {!isLoadingProviders && Array.isArray(providerStatus) && ( // Removed providerStatus !== 'error' check
                providerStatus.length > 0 ? (
                    <ul class="space-y-4">
                        {filteredProviders.length > 0 ? (
                            filteredProviders.map((providerInfo: ProviderInfoAndStatus) => renderProviderSetting(providerInfo))
                        ) : (
                            <li class="text-gray-500 dark:text-gray-400 italic">未找到匹配嘅 Provider。</li>
                        )}
                    </ul>
                ) : (
                     <p class="text-gray-500 dark:text-gray-400 italic">未找到任何 Provider。</p>
                )
            )}
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-6">啟用 Provider 並且設定對應嘅憑證先可以使用。</p>
        </section>
    ); // Close return for ProviderSettings
} // Close ProviderSettings function
