/**
 * Quote Version History
 *
 * FN-001: Shows version history for quotes.
 */

import { Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface QuoteVersion {
  version: number;
  createdAt: string;
  createdBy: string;
  totalAmount: number;
  status: string;
  changeNotes?: string;
}

interface QuoteVersionHistoryProps {
  versions: QuoteVersion[];
  currentVersion: number;
  onSelectVersion?: (version: number) => void;
}

export function QuoteVersionHistory({
  versions,
  currentVersion,
  onSelectVersion,
}: QuoteVersionHistoryProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">Version History</h4>
      <div className="space-y-1">
        {versions.map((v) => (
          <button
            key={v.version}
            type="button"
            onClick={() => onSelectVersion?.(v.version)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              v.version === currentVersion
                ? 'bg-blue-50 border border-blue-200'
                : 'hover:bg-gray-50 border border-transparent'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant={v.version === currentVersion ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  v{v.version}
                </Badge>
                <span className="font-medium">${v.totalAmount.toLocaleString()}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {v.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {v.createdBy}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(v.createdAt).toLocaleDateString()}
              </span>
            </div>
            {v.changeNotes && (
              <p className="text-xs text-gray-500 mt-1 truncate">{v.changeNotes}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
