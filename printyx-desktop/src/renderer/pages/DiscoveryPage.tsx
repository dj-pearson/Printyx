import { useState } from 'react';
import { Search, Loader2, Monitor, Plus, CheckCircle, AlertCircle } from 'lucide-react';

interface Printer {
  ip: string;
  hostname?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  contact?: string;
  name?: string;
  selected?: boolean;
}

export default function DiscoveryPage() {
  const [discovering, setDiscovering] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<Printer[]>([]);
  const [subnet, setSubnet] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [liveDiscovery, setLiveDiscovery] = useState(false);

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoveredPrinters([]);
    setMessage(null);
    setLiveDiscovery(true);

    try {
      // Listen for live printer discoveries
      window.electronAPI.onPrinterDiscovered((device: Printer) => {
        setDiscoveredPrinters((prev) => [...prev, { ...device, selected: false }]);
      });

      const result = await window.electronAPI.discoverPrinters(subnet || undefined);

      if (result.success) {
        if (result.printers && result.printers.length === 0) {
          showMessage('error', 'No printers found on the network');
        } else {
          showMessage('success', `Found ${result.printers?.length || 0} printer(s)`);
        }
      } else {
        showMessage('error', result.error || 'Discovery failed');
      }
    } catch (error) {
      showMessage('error', 'Failed to discover printers');
    } finally {
      setDiscovering(false);
      setLiveDiscovery(false);
    }
  };

  const handleAddSelected = async () => {
    const selectedPrinters = discoveredPrinters.filter((p) => p.selected);

    if (selectedPrinters.length === 0) {
      showMessage('error', 'Please select at least one printer');
      return;
    }

    try {
      // Fetch OID presets for each printer
      const printersWithOids = await Promise.all(
        selectedPrinters.map(async (printer) => {
          const result = await window.electronAPI.fetchOidPresets();

          if (result.success && result.presets) {
            const preset = result.presets.find(
              (p: any) =>
                p.manufacturer.toLowerCase() === (printer.manufacturer || '').toLowerCase(),
            );

            return {
              ...printer,
              oids: preset?.oids || [],
            };
          }

          return {
            ...printer,
            oids: [],
          };
        }),
      );

      // Get existing printers
      const existingPrinters = await window.electronAPI.getPrinters();

      // Merge with new printers
      const updatedPrinters = [...existingPrinters, ...printersWithOids];

      // Save
      const result = await window.electronAPI.savePrinters(updatedPrinters);

      if (result.success) {
        showMessage('success', `Added ${selectedPrinters.length} printer(s) successfully`);
        // Clear selected printers
        setDiscoveredPrinters((prev) => prev.map((p) => ({ ...p, selected: false })));
      } else {
        showMessage('error', result.error || 'Failed to add printers');
      }
    } catch (error) {
      showMessage('error', 'Failed to add printers');
    }
  };

  const toggleSelection = (ip: string) => {
    setDiscoveredPrinters((prev) =>
      prev.map((p) => (p.ip === ip ? { ...p, selected: !p.selected } : p)),
    );
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const selectedCount = discoveredPrinters.filter((p) => p.selected).length;

  return (
    <div className="h-full flex flex-col">
      <div className="p-8 border-b border-gray-200 bg-white">
        <h2 className="text-3xl font-bold text-gray-900">Discover Printers</h2>
        <p className="text-gray-600 mt-2">
          Scan your network to find SNMP-enabled printers and copiers
        </p>

        <div className="mt-6 flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subnet (Optional)
            </label>
            <input
              type="text"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="e.g., 192.168.1.0/24"
              disabled={discovering}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="text-sm text-gray-500 mt-1">
              Leave blank to auto-detect your local network
            </p>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-fit"
            >
              {discovering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Start Discovery
                </>
              )}
            </button>
          </div>
        </div>

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

      <div className="flex-1 overflow-auto p-8">
        {liveDiscovery && discoveredPrinters.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Scanning network for printers...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few minutes</p>
          </div>
        ) : discoveredPrinters.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Found {discoveredPrinters.length} Printer(s)
              </h3>
              {selectedCount > 0 && (
                <button
                  onClick={handleAddSelected}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add {selectedCount} Selected
                </button>
              )}
            </div>

            <div className="grid gap-4">
              {discoveredPrinters.map((printer) => (
                <div
                  key={printer.ip}
                  onClick={() => toggleSelection(printer.ip)}
                  className={`
                    bg-white border-2 rounded-lg p-6 cursor-pointer transition-all
                    ${
                      printer.selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }
                  `}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`
                      w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
                      ${printer.selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}
                    `}
                    >
                      <Monitor className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">
                          {printer.model || 'Unknown Model'}
                        </h4>
                        {printer.manufacturer && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {printer.manufacturer}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div>
                          <span className="text-gray-500">IP Address:</span>{' '}
                          <span className="text-gray-900 font-mono">{printer.ip}</span>
                        </div>
                        {printer.hostname && (
                          <div>
                            <span className="text-gray-500">Hostname:</span>{' '}
                            <span className="text-gray-900">{printer.hostname}</span>
                          </div>
                        )}
                        {printer.serialNumber && (
                          <div>
                            <span className="text-gray-500">Serial:</span>{' '}
                            <span className="text-gray-900">{printer.serialNumber}</span>
                          </div>
                        )}
                        {printer.location && (
                          <div>
                            <span className="text-gray-500">Location:</span>{' '}
                            <span className="text-gray-900">{printer.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {printer.selected && (
                      <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No printers discovered yet</p>
            <p className="text-sm text-gray-500">Click "Start Discovery" to scan your network</p>
          </div>
        )}
      </div>
    </div>
  );
}
