import { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Activity,
  Loader2,
  CheckCircle,
  AlertCircle,
  Server,
  Clock,
  Database,
} from 'lucide-react';

interface MonitoringStatus {
  enabled: boolean;
  running: boolean;
}

interface MonitoringPageProps {
  status: MonitoringStatus;
  onStatusChange: (status: MonitoringStatus) => void;
}

interface MonitoringData {
  timestamp: string;
  successCount: number;
  errorCount: number;
}

export default function MonitoringPage({ status, onStatusChange }: MonitoringPageProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [recentData, setRecentData] = useState<MonitoringData[]>([]);
  const [serviceStatus, setServiceStatus] = useState<{
    installed: boolean;
    running: boolean;
  }>({ installed: false, running: false });

  useEffect(() => {
    checkServiceStatus();

    // Listen for monitoring data
    window.electronAPI.onMonitoringData((data: MonitoringData) => {
      setRecentData((prev) => [data, ...prev].slice(0, 10));
    });

    // Listen for monitoring errors
    window.electronAPI.onMonitoringError((error: any) => {
      showMessage('error', error.message || 'Monitoring error occurred');
    });
  }, []);

  const checkServiceStatus = async () => {
    const status = await window.electronAPI.getServiceStatus();
    setServiceStatus(status);
  };

  const handleStartMonitoring = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await window.electronAPI.startMonitoring();

      if (result.success) {
        showMessage('success', 'Monitoring started successfully');
        onStatusChange({ enabled: true, running: true });
      } else {
        showMessage('error', result.error || 'Failed to start monitoring');
      }
    } catch (error) {
      showMessage('error', 'Failed to start monitoring');
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitoring = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await window.electronAPI.stopMonitoring();

      if (result.success) {
        showMessage('success', 'Monitoring stopped');
        onStatusChange({ enabled: false, running: false });
      } else {
        showMessage('error', result.error || 'Failed to stop monitoring');
      }
    } catch (error) {
      showMessage('error', 'Failed to stop monitoring');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallService = async () => {
    if (!confirm('This will install Printyx Monitor as a Windows service. Continue?')) {
      return;
    }

    setLoading(true);

    try {
      const result = await window.electronAPI.installService();

      if (result.success) {
        showMessage('success', 'Windows service installed successfully');
        await checkServiceStatus();
      } else {
        showMessage('error', result.error || 'Failed to install service');
      }
    } catch (error) {
      showMessage('error', 'Failed to install service');
    } finally {
      setLoading(false);
    }
  };

  const handleUninstallService = async () => {
    if (!confirm('This will uninstall the Printyx Monitor Windows service. Continue?')) {
      return;
    }

    setLoading(true);

    try {
      const result = await window.electronAPI.uninstallService();

      if (result.success) {
        showMessage('success', 'Windows service uninstalled successfully');
        await checkServiceStatus();
      } else {
        showMessage('error', result.error || 'Failed to uninstall service');
      }
    } catch (error) {
      showMessage('error', 'Failed to uninstall service');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-8 border-b border-gray-200 bg-white">
        <h2 className="text-3xl font-bold text-gray-900">Monitoring</h2>
        <p className="text-gray-600 mt-2">Manage printer monitoring and view collection status</p>

        {message && (
          <div
            className={`mt-4 flex items-center gap-2 p-4 rounded-lg ${
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
      </div>

      <div className="flex-1 overflow-auto p-8 space-y-6">
        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monitoring Status</h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  status.running ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {status.running ? 'Active' : 'Inactive'}
                </p>
                <p className="text-sm text-gray-500">
                  {status.running
                    ? 'Collecting data from printers'
                    : 'Monitoring is currently stopped'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              {!status.running ? (
                <button
                  onClick={handleStartMonitoring}
                  disabled={loading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  Start Monitoring
                </button>
              ) : (
                <button
                  onClick={handleStopMonitoring}
                  disabled={loading}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                  Stop Monitoring
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Windows Service Card */}
        {process.platform === 'win32' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Windows Service</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    serviceStatus.installed && serviceStatus.running
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <Server className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {serviceStatus.installed
                      ? serviceStatus.running
                        ? 'Service Running'
                        : 'Service Stopped'
                      : 'Not Installed'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {serviceStatus.installed
                      ? 'Monitoring runs automatically on system startup'
                      : 'Install as a Windows service for automatic startup'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                {!serviceStatus.installed ? (
                  <button
                    onClick={handleInstallService}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Server className="w-5 h-5" />
                    )}
                    Install Service
                  </button>
                ) : (
                  <button
                    onClick={handleUninstallService}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Server className="w-5 h-5" />
                    )}
                    Uninstall Service
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Data Collections */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Collections</h3>

          {recentData.length > 0 ? (
            <div className="space-y-3">
              {recentData.map((data, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(data.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {data.successCount} successful, {data.errorCount} failed
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      {data.successCount} ✓
                    </span>
                    {data.errorCount > 0 && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                        {data.errorCount} ✗
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No data collected yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Start monitoring to see collection history
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
