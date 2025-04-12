import { h } from 'preact';
import { useCallback } from 'preact/hooks';
import { AllProviderStatus, ApiProviderKey } from '../app'; // Import types from app.tsx (adjust path if needed)

// Define props for the SettingPage
interface SettingPageProps {
  providerStatus: AllProviderStatus | null;
  onProviderToggle: (providerKey: ApiProviderKey, enabled: boolean) => void;
}

export function SettingPage({ providerStatus, onProviderToggle }: SettingPageProps) {

  // Re-implement the rendering logic for a single provider setting
  const renderProviderSetting = (key: ApiProviderKey, name: string) => {
    if (!providerStatus) return <li key={key}>{name}: 載入中...</li>;

    const status = providerStatus[key];
    if (!status) return <li key={key}>{name}: 狀態不可用</li>; // Handle case where status might be missing

    const apiKeyText = status.apiKeySet ? '(Key 已設定)' : '(Key 未設定)';
    const apiKeyColor = status.apiKeySet ? 'green' : 'red';

    return (
      <li key={key}>
        <label>
          <input
            type="checkbox"
            checked={status.enabled}
            onChange={(e) => onProviderToggle(key, (e.target as HTMLInputElement).checked)}
          />
          {name} <span style={{ color: apiKeyColor, fontSize: '0.9em' }}>{apiKeyText}</span>
        </label>
      </li>
    );
  };

  return (
    <div>
      <h1>Zen Coder 設定</h1>
      <section>
        <h3>Providers</h3>
        {providerStatus ? (
          <ul>
            {renderProviderSetting('ANTHROPIC', 'Anthropic (Claude)')}
            {renderProviderSetting('GOOGLE', 'Google (Gemini)')}
            {renderProviderSetting('OPENROUTER', 'OpenRouter')}
            {renderProviderSetting('DEEPSEEK', 'DeepSeek')}
          </ul>
        ) : (
          <p>正在載入 Provider 狀態...</p>
        )}
        <p><small>啟用 Provider 並且設定對應嘅 API Key 先可以使用.</small></p>
        <p><small>使用 Ctrl+Shift+P 並輸入 "Set [Provider] API Key" 去設定或更新 Key.</small></p>
      </section>
      {/* Add sections for Model Resolver later */}
    </div>
  );
}