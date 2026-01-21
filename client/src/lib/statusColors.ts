/**
 * Centralized color and styling utilities for status badges and indicators
 * Ensures consistent styling across the application
 */

// Status color mappings
export const statusColors = {
  draft: 'bg-gray-100 text-gray-800 border-gray-300',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
  active: 'bg-green-100 text-green-800 border-green-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-300',
  closed: 'bg-gray-100 text-gray-800 border-gray-300',
  won: 'bg-green-100 text-green-800 border-green-300',
  lost: 'bg-red-100 text-red-800 border-red-300',
  on_hold: 'bg-orange-100 text-orange-800 border-orange-300',
} as const;

// Urgency/Priority color mappings
export const urgencyColors = {
  low: 'bg-blue-100 text-blue-800 border-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
  urgent: 'bg-red-100 text-red-800 border-red-300',
} as const;

// Severity/Threat level color mappings
export const severityColors = {
  info: 'bg-blue-100 text-blue-800 border-blue-300',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  error: 'bg-red-100 text-red-800 border-red-300',
  success: 'bg-green-100 text-green-800 border-green-300',
} as const;

// Lead/Deal stage color mappings
export const stageColors = {
  new: 'bg-blue-100 text-blue-800 border-blue-300',
  contacted: 'bg-purple-100 text-purple-800 border-purple-300',
  qualified: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  proposal: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  negotiation: 'bg-orange-100 text-orange-800 border-orange-300',
  closed_won: 'bg-green-100 text-green-800 border-green-300',
  closed_lost: 'bg-red-100 text-red-800 border-red-300',
} as const;

// Payment status color mappings
export const paymentStatusColors = {
  paid: 'bg-green-100 text-green-800 border-green-300',
  unpaid: 'bg-red-100 text-red-800 border-red-300',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  overdue: 'bg-red-100 text-red-800 border-red-300',
  refunded: 'bg-gray-100 text-gray-800 border-gray-300',
} as const;

// Helper functions with fallback to default color
const defaultColor = 'bg-gray-100 text-gray-800 border-gray-300';

export function getStatusColor(status: string | undefined | null): string {
  if (!status) return defaultColor;
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  return statusColors[normalized as keyof typeof statusColors] || defaultColor;
}

export function getUrgencyColor(urgency: string | undefined | null): string {
  if (!urgency) return defaultColor;
  const normalized = urgency.toLowerCase();
  return urgencyColors[normalized as keyof typeof urgencyColors] || defaultColor;
}

export function getSeverityColor(severity: string | undefined | null): string {
  if (!severity) return defaultColor;
  const normalized = severity.toLowerCase();
  return severityColors[normalized as keyof typeof severityColors] || defaultColor;
}

export function getStageColor(stage: string | undefined | null): string {
  if (!stage) return defaultColor;
  const normalized = stage.toLowerCase().replace(/\s+/g, '_');
  return stageColors[normalized as keyof typeof stageColors] || defaultColor;
}

export function getPaymentStatusColor(status: string | undefined | null): string {
  if (!status) return defaultColor;
  const normalized = status.toLowerCase();
  return paymentStatusColors[normalized as keyof typeof paymentStatusColors] || defaultColor;
}

// Generic color getter that tries multiple maps
export function getColor(
  value: string | undefined | null,
  type: 'status' | 'urgency' | 'severity' | 'stage' | 'payment' = 'status',
): string {
  switch (type) {
    case 'urgency':
      return getUrgencyColor(value);
    case 'severity':
      return getSeverityColor(value);
    case 'stage':
      return getStageColor(value);
    case 'payment':
      return getPaymentStatusColor(value);
    default:
      return getStatusColor(value);
  }
}
