import { useState, useEffect } from 'react';
import { Monitor, Trash2, Edit2, Save, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Printer {
  id?: string;
  ip: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  location?: string;
  oids: OidConfig[];
  snmpCommunity?: string;
  snmpVersion?: 'v1' | 'v2c' | 'v3';
}

interface OidConfig {
  name: string;
  oid: string;
  description: string;
  category: string;
}

export default function PrintersPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    try {
      const data = await window.electronAPI.getPrinters();
      setPrinters(data);
    } catch (error) {
      showMessage('error', 'Failed to load printers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (index: number) => {
    if (!confirm('Are you sure you want to remove this printer?')) {
      return;
    }

    const updatedPrinters = printers.filter((_, i) => i !== index);

    try {
      const result = await window.electronAPI.savePrinters(updatedPrinters);

      if (result.success) {
        setPrinters(updatedPrinters);
        showMessage('success', 'Printer removed successfully');
      } else {
        showMessage('error', result.error || 'Failed to remove printer');
      }
    } catch (error) {
      showMessage('error', 'Failed to remove printer');
    }
  };

  const handleUpdate = async (index: number, updatedPrinter: Printer) => {
    const updatedPrinters = [...printers];
    updatedPrinters[index] = updatedPrinter;

    try {
      const result = await window.electronAPI.savePrinters(updatedPrinters);

      if (result.success) {
        setPrinters(updatedPrinters);
        setEditingId(null);
        showMessage('success', 'Printer updated successfully');
      } else {
        showMessage('error', result.error || 'Failed to update printer');
      }
    } catch (error) {
      showMessage('error', 'Failed to update printer');
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
    <div className="h-full flex flex-col">
      <div className="p-8 border-b border-gray-200 bg-white">
        <h2 className="text-3xl font-bold text-gray-900">Manage Printers</h2>
        <p className="text-gray-600 mt-2">View and manage your configured printers</p>

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
        {printers.length > 0 ? (
          <div className="grid gap-4">
            {printers.map((printer, index) => (
              <PrinterCard
                key={`${printer.ip}-${index}`}
                printer={printer}
                isEditing={editingId === printer.ip}
                onEdit={() => setEditingId(printer.ip)}
                onCancel={() => setEditingId(null)}
                onSave={(updated) => handleUpdate(index, updated)}
                onDelete={() => handleDelete(index)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No printers configured</p>
            <p className="text-sm text-gray-500">
              Use the "Discover Printers" page to find and add printers
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface PrinterCardProps {
  printer: Printer;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (printer: Printer) => void;
  onDelete: () => void;
}

function PrinterCard({ printer, isEditing, onEdit, onCancel, onSave, onDelete }: PrinterCardProps) {
  const [editedPrinter, setEditedPrinter] = useState(printer);

  useEffect(() => {
    setEditedPrinter(printer);
  }, [printer]);

  if (isEditing) {
    return (
      <div className="bg-white border-2 border-blue-500 rounded-lg p-6">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
              <input
                type="text"
                value={editedPrinter.ip}
                onChange={(e) => setEditedPrinter({ ...editedPrinter, ip: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SNMP Community</label>
              <input
                type="text"
                value={editedPrinter.snmpCommunity || 'public'}
                onChange={(e) =>
                  setEditedPrinter({
                    ...editedPrinter,
                    snmpCommunity: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={editedPrinter.location || ''}
                onChange={(e) => setEditedPrinter({ ...editedPrinter, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SNMP Version</label>
              <select
                value={editedPrinter.snmpVersion || 'v2c'}
                onChange={(e) =>
                  setEditedPrinter({
                    ...editedPrinter,
                    snmpVersion: e.target.value as 'v1' | 'v2c' | 'v3',
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="v1">SNMP v1</option>
                <option value="v2c">SNMP v2c</option>
                <option value="v3">SNMP v3</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={() => onSave(editedPrinter)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
          <Monitor className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-gray-900">{printer.model}</h4>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
              {printer.manufacturer}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-gray-500">IP Address:</span>{' '}
              <span className="text-gray-900 font-mono">{printer.ip}</span>
            </div>
            <div>
              <span className="text-gray-500">SNMP:</span>{' '}
              <span className="text-gray-900">
                {printer.snmpVersion || 'v2c'} / {printer.snmpCommunity || 'public'}
              </span>
            </div>
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
            <div>
              <span className="text-gray-500">OIDs:</span>{' '}
              <span className="text-gray-900">{printer.oids.length} configured</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
