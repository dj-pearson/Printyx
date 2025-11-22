import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';

interface Settings {
  apiKey: string;
  serverUrl: string;
  companyId: string;
  locationId: string;
}

interface SettingsPageProps {
  onConfigured: () => void;
}

export default function SettingsPage({ onConfigured }: SettingsPageProps) {
  const [settings, setSettings] = useState<Settings>({
    apiKey: '',
    serverUrl: 'https://app.printyx.net',
    companyId: '',
    locationId: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await window.electronAPI.getSettings();
      setSettings({
        apiKey: data.apiKey || '',
        serverUrl: data.serverUrl || 'https://app.printyx.net',
        companyId: data.companyId || '',
        locationId: data.locationId || '',
      });
    } catch (error) {
      showMessage('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.apiKey || !settings.serverUrl) {
      showMessage('error', 'API Key and Server URL are required');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await window.electronAPI.saveSettings(settings);

      if (result.success) {
        showMessage('success', 'Settings saved successfully');
        onConfigured();
      } else {
        showMessage('error', result.error || 'Failed to save settings');
      }
    } catch (error) {
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-600 mt-2">
          Configure your Printyx API connection and monitoring settings
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How to get your API key:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Log in to your Printyx account</li>
            <li>Navigate to Settings → API Keys</li>
            <li>Create a new API key with "Monitoring" permissions</li>
            <li>Copy the key and paste it below</li>
          </ol>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">API Key *</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your Printyx API key"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Server URL *</label>
          <input
            type="url"
            value={settings.serverUrl}
            onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="https://app.printyx.net"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company ID (Optional)
          </label>
          <input
            type="text"
            value={settings.companyId}
            onChange={(e) => setSettings({ ...settings, companyId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your company ID"
          />
          <p className="text-sm text-gray-500 mt-1">Leave blank if you only have one company</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location ID (Optional)
          </label>
          <input
            type="text"
            value={settings.locationId}
            onChange={(e) => setSettings({ ...settings, locationId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your location ID"
          />
          <p className="text-sm text-gray-500 mt-1">Leave blank if you only have one location</p>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
