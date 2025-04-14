import { useState, useMemo, useCallback } from 'preact/hooks'; // Removed useEffect, useRef
import { useAtomValue } from 'jotai';
import { loadable } from 'jotai/utils';
import { JSX } from 'preact/jsx-runtime';
import { postMessage } from '../../app';
import { ProviderInfoAndStatus } from '../../../../src/common/types';
import { providerStatusAtom } from '../../store/atoms';

export function ProviderSettings(): JSX.Element {
    const providerStatusLoadable = useAtomValue(loadable(providerStatusAtom));
    const [apiKeysInput, setApiKeysInput] = useState<{ [providerId: string]: string }>({});
    // Removed isSubscribedRef
    const [searchQuery, setSearchQuery] = useState('');

    const handleApiKeyInputChange = (providerId: string, value: string) => {
        setApiKeysInput(prev => ({ ...prev, [providerId]: value }));
    };

    const handleSetApiKey = (providerId: string) => {
        const apiKey = apiKeysInput[providerId];
        if (apiKey && apiKey.trim() !== '') {
            console.log(`Setting API Key for ${providerId}`);
            postMessage({
                type: 'setApiKey',
                payload: { provider: providerId, apiKey: apiKey.trim() }
            });
            setApiKeysInput(prev => ({ ...prev, [providerId]: '' }));
        } else {
            console.warn(`API Key input for ${providerId} is empty.`);
        }
    };

    const handleDeleteApiKey = (providerId: string) => {
        console.log(`Deleting API Key for ${providerId}`);
        postMessage({
            type: 'deleteApiKey',
            payload: { provider: providerId }
        });
    };

    const handleSearchChange = (e: Event) => {
        setSearchQuery((e.target as HTMLInputElement).value);
    };

    const onProviderToggle = useCallback((providerId: string, enabled: boolean) => {
        console.log(`Requesting toggle provider ${providerId} to ${enabled}`);
        postMessage({ type: 'setProviderEnabled', payload: { provider: providerId, enabled: enabled } });
    }, []);

    const filteredProviders = useMemo(() => {
        if (providerStatusLoadable.state !== 'hasData' || !providerStatusLoadable.data) return [];
        const currentProviderStatus = providerStatusLoadable.data;
        if (!searchQuery) {
            return currentProviderStatus;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return currentProviderStatus.filter(provider =>
            provider.name.toLowerCase().includes(lowerCaseQuery) ||
            provider.id.toLowerCase().includes(lowerCaseQuery)
        );
    }, [searchQuery, providerStatusLoadable]);

    // Removed subscription useEffect

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
                            />
                            <button
                                class="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                onClick={() => handleSetApiKey(id)}
                                disabled={!apiKeysInput[id]?.trim()}
                                aria-label={`Set ${name} API Key`}
                            >
                                設定
                            </button>
                            {apiKeySet && (
                                <button
                                    class="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    onClick={() => handleDeleteApiKey(id)}
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

            {providerStatusLoadable.state === 'loading' && <p class="text-gray-500 dark:text-gray-400">正在載入 Provider 狀態...</p>}
            {providerStatusLoadable.state === 'hasError' && <p class="text-red-500 dark:text-red-400">載入 Provider 狀態時出錯。</p>}
            {providerStatusLoadable.state === 'hasData' && providerStatusLoadable.data && ( // Add null check
                providerStatusLoadable.data.length > 0 ? (
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