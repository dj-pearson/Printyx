import { useState, useEffect } from 'react';
import { Settings, Monitor, Search, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import SettingsPage from './pages/SettingsPage';
import DiscoveryPage from './pages/DiscoveryPage';
import PrintersPage from './pages/PrintersPage';
import MonitoringPage from './pages/MonitoringPage';

type Page = 'settings' | 'discovery' | 'printers' | 'monitoring';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('settings');
  const [isConfigured, setIsConfigured] = useState(false);
  const [monitoringStatus, setMonitoringStatus] = useState({
    enabled: false,
    running: false,
  });
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check if settings are configured
    window.electronAPI.getSettings().then((settings) => {
      setIsConfigured(!!(settings.apiKey && settings.serverUrl));
    });

    // Get monitoring status
    window.electronAPI.getMonitoringStatus().then(setMonitoringStatus);

    // Listen for updates
    window.electronAPI.onUpdateAvailable(() => {
      setUpdateAvailable(true);
    });

    window.electronAPI.onUpdateDownloaded(() => {
      if (window.confirm('An update has been downloaded. Restart now to install?')) {
        window.electronAPI.installUpdate();
      }
    });
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'settings':
        return <SettingsPage onConfigured={() => setIsConfigured(true)} />;
      case 'discovery':
        return <DiscoveryPage />;
      case 'printers':
        return <PrintersPage />;
      case 'monitoring':
        return <MonitoringPage status={monitoringStatus} onStatusChange={setMonitoringStatus} />;
      default:
        return <SettingsPage onConfigured={() => setIsConfigured(true)} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">Printyx Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">Printer Management</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton
            icon={Settings}
            label="Settings"
            active={currentPage === 'settings'}
            onClick={() => setCurrentPage('settings')}
          />
          <NavButton
            icon={Search}
            label="Discover Printers"
            active={currentPage === 'discovery'}
            onClick={() => setCurrentPage('discovery')}
            disabled={!isConfigured}
          />
          <NavButton
            icon={Monitor}
            label="Manage Printers"
            active={currentPage === 'printers'}
            onClick={() => setCurrentPage('printers')}
            disabled={!isConfigured}
          />
          <NavButton
            icon={Activity}
            label="Monitoring"
            active={currentPage === 'monitoring'}
            onClick={() => setCurrentPage('monitoring')}
            disabled={!isConfigured}
            badge={
              monitoringStatus.running ? <CheckCircle className="w-4 h-4 text-green-500" /> : null
            }
          />
        </nav>

        {/* Status Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          {updateAvailable && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
              <AlertCircle className="w-4 h-4" />
              Update available
            </div>
          )}
          <div className="text-xs text-gray-500">
            {monitoringStatus.running ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Monitoring active
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                Monitoring inactive
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">{renderPage()}</div>
    </div>
  );
}

interface NavButtonProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}

function NavButton({ icon: Icon, label, active, onClick, disabled, badge }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left
        transition-colors duration-150
        ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="flex-1 font-medium">{label}</span>
      {badge}
    </button>
  );
}

export default App;
