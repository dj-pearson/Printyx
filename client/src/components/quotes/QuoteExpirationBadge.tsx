/**
 * Quote Expiration Badge
 *
 * FN-001: Shows expiration warnings for quotes.
 * Displays a colored badge indicating how close the quote is to expiring.
 */

import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle } from 'lucide-react';

interface QuoteExpirationBadgeProps {
  expiresAt: string | null;
}

export function QuoteExpirationBadge({ expiresAt }: QuoteExpirationBadgeProps) {
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);

  if (daysUntilExpiry < 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Expired {Math.abs(daysUntilExpiry)}d ago
      </Badge>
    );
  }

  if (daysUntilExpiry <= 3) {
    return (
      <Badge variant="destructive" className="gap-1">
        <Clock className="h-3 w-3" />
        Expires in {daysUntilExpiry}d
      </Badge>
    );
  }

  if (daysUntilExpiry <= 7) {
    return (
      <Badge className="gap-1 bg-orange-100 text-orange-800 hover:bg-orange-100">
        <Clock className="h-3 w-3" />
        Expires in {daysUntilExpiry}d
      </Badge>
    );
  }

  if (daysUntilExpiry <= 30) {
    return (
      <Badge className="gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        <Clock className="h-3 w-3" />
        {daysUntilExpiry}d remaining
      </Badge>
    );
  }

  return null;
}
