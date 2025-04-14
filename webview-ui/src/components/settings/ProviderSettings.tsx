import { useState, useMemo, useCallback } from 'preact/hooks'; // Consolidated hooks import
// Removed: import { useAtomValue } from 'jotai';
// Removed: import { loadable } from 'jotai/utils';
import { useStore } from '@nanostores/react';
import { JSX } from 'preact/jsx-runtime';
// import { requestData } from '../../utils/communication'; // Removed requestData import
import { ProviderInfoAndStatus } from '../../../../src/common/types';
import {
    $providerStatus,
    $setApiKey,
    $deleteApiKey,
    $setProviderEnabled,
    availableProvidersStore // Keep if still used for filtering/display?
} from '../../stores/providerStores'; // Import stores

export function ProviderSettings(): JSX.Element {
    // --- State from Stores ---
    const providerStatus = useStore($providerStatus);
    const { mutate: setApiKeyMutate, loading: isSettingKey } = useStore($setApiKey);
    const { mutate: deleteApiKeyMutate, loading: isDeletingKey } = useStore($deleteApiKey);
    const { mutate: setProviderEnabledMutate, loading: isTogglingEnabled } = useStore($setProviderEnabled);
    // TODO: Check if availableProvidersStore is still needed or if $providerStatus is sufficient
    const availableProviders = useStore(availableProvidersStore); // Keep for now

    const isLoadingProviders = providerStatus === null; // Loading based on main status store

    // --- Local State ---
    const [apiKeysInput, setApiKeysInput] = useState<{ [providerId: string]: string }>({});
    const [searchQuery, setSearchQuery] = useState('');

    const handleApiKeyInputChange = (providerId: string, value: string) => {
        setApiKeysInput(prev => ({ ...prev, [providerId]: value }));
    };

    const handleSetApiKey = (providerId: string) => {
        const apiKey = apiKeysInput[providerId];
        if (apiKey && apiKey.trim() !== '') {
            console.log(`Setting API Key for ${providerId} via mutation store`);
            setApiKeyMutate({ provider: providerId, apiKey: apiKey.trim() })
                .then(() => {
                    console.log(`API Key set request successful for ${providerId}`);
                    setApiKeysInput(prev => ({ ...prev, [providerId]: '' })); // Clear input on success
                    // Optimistic update handles UI change
                })
                .catch(error => {
                    console.error(`Error setting API Key for ${providerId}:`, error);
                    // TODO: Show error
                });
        } else {
            console.warn(`API Key input for ${providerId} is empty.`);
        }
    };

    const handleDeleteApiKey = (providerId: string) => {
        console.log(`Deleting API Key for ${providerId} via mutation store`);
        deleteApiKeyMutate({ provider: providerId })
            .then(() => {
                console.log(`API Key delete request successful for ${providerId}`);
                // Optimistic update handles UI change
            })
            .catch(error => {
                console.error(`Error deleting API Key for ${providerId}:`, error);
                // TODO: Show error
            });
    };

    const handleSearchChange = (e: Event) => {
        setSearchQuery((e.target as HTMLInputElement).value);
    };

    const onProviderToggle = useCallback((providerId: string, enabled: boolean) => {
        console.log(`Requesting toggle provider ${providerId} to ${enabled} via mutation store`);
        setProviderEnabledMutate({ provider: providerId, enabled: enabled })
            .then(() => console.log(`Provider ${providerId} enabled status request sent.`))
            .catch(error => console.error(`Error setting provider ${providerId} enabled status:`, error));
        // Optimistic update handles UI change
    }, []);

    const filteredProviders = useMemo(() => {
        const currentProviderStatus = providerStatus ?? []; // Use providerStatus from hook, default to empty array
        if (!searchQuery) {
            return currentProviderStatus;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        // Add type annotation for provider parameter in filter
        return currentProviderStatus.filter((provider: ProviderInfoAndStatus) =>
            provider.name.toLowerCase().includes(lowerCaseQuery) ||
            provider.id.toLowerCase().includes(lowerCaseQuery)
        );
    }, [searchQuery, providerStatus]); // Depend on providerStatus directly

    // Add type annotation for providerInfo parameter
    const renderProviderSetting = (providerInfo: ProviderInfoAndStatus) => {
        const { id, name, apiKeyUrl, requiresApiKey, enabled, apiKeySet } = providerInfo;
        const apiKeyText = apiKeySet ? '(Key 已設定)' : '(Key 未設定)';
        const apiKeyColor = apiKeySet ? 'green' : 'red';

        return (
            <li key={id} class="provider-setting-item mb-4 p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <div class="flex items-center justify-between mb-3">
                    <label class="flex items-center font-semibold text-lg">
                        <input
                            type="checkbox"
                            class="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            checked={enabled}
                            onChange={(e) => onProviderToggle(id, (e.target as HTMLInputElement).checked)}
                        />
                        {name}
                    </label>
                    <span class={`text-sm font-medium ${apiKeyColor === 'green' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{apiKeyText}</span>
                </div>
                {requiresApiKey && (
                    <div class="mt-3 space-y-2">
                        <div class="flex items-center space-x-2">
                            <input
                                type="password"
                                class="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder={`輸入 ${name} API Key...`}
                                value={apiKeysInput[id] || ''}
                                onInput={(e) => handleApiKeyInputChange(id, (e.target as HTMLInputElement).value)}
                                aria-label={`${name} API Key Input`}
                                disabled={isSettingKey || isDeletingKey} // Disable input during actions
                            />
                            <button
                                class={`px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSettingKey ? 'animate-pulse' : ''}`}
                                onClick={() => handleSetApiKey(id)}
                                disabled={!apiKeysInput[id]?.trim() || isSettingKey || isDeletingKey}
                                aria-label={`Set ${name} API Key`}
                            >
                                {isSettingKey ? 'Setting...' : 'Set'}
                            </button>
                            {apiKeySet && (
                                <button
                                    class={`px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${isDeletingKey ? 'animate-pulse' : ''}`}
                                    onClick={() => handleDeleteApiKey(id)}
                                    disabled={isSettingKey || isDeletingKey}
                                    aria-label={`Delete ${name} API Key`}
                                >
                                    刪除
                                </button>
                            )}
                        </div>
                        {apiKeyUrl && (
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                喺呢度攞 API Key: <a href={apiKeyUrl} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">{apiKeyUrl}</a>
                            </p>
                        )}
                    </div>
                )}
            </li>
        );
    };

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
            {/* TODO: Add better error display if useProviderStatus provided error state */}
            {!isLoadingProviders && providerStatus && ( // Check providerStatus directly
                providerStatus.length > 0 ? (
                    <ul class="space-y-4">
                        {filteredProviders.length > 0 ? (
                            filteredProviders.map(providerInfo => renderProviderSetting(providerInfo))
                        ) : (
                            <li class="text-gray-500 dark:text-gray-400 italic">未找到匹配嘅 Provider。</li>
                        )}
                    </ul>
                ) : (
                     <p class="text-gray-500 dark:text-gray-400 italic">未找到任何 Provider。</p>
                )
            )}
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-6">啟用 Provider 並且設定對應嘅 API Key 先可以使用。</p>
        </section>
    );
}
