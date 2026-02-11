/**
 * Shared date utility helpers for CRM pages.
 */

/** Returns a human-readable relative date string (e.g. "Today", "3d ago", "2w ago"). */
export function relativeDate(value: string | Date | null | undefined): string {
  if (!value) return '--';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '--';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays < 0) {
    // Future date
    const absDays = Math.abs(diffDays);
    if (absDays === 0) return 'Today';
    if (absDays === 1) return 'Tomorrow';
    if (absDays < 7) return `In ${absDays}d`;
    if (absDays < 30) return `In ${Math.floor(absDays / 7)}w`;
    return date.toLocaleDateString();
  }

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return date.toLocaleDateString();
}

/** Returns a relative future time string for upcoming events (e.g. "Tomorrow at 2pm", "In 3 days"). */
export function relativeFuture(value: string | Date | null | undefined, time?: string): string {
  if (!value) return '--';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '--';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  const timeSuffix = time ? ` at ${time}` : '';

  if (diffDays === 0) return `Today${timeSuffix}`;
  if (diffDays === 1) return `Tomorrow${timeSuffix}`;
  if (diffDays < 7) return `In ${diffDays} days${timeSuffix}`;
  if (diffDays < 30) return `In ${Math.floor(diffDays / 7)}w${timeSuffix}`;
  return date.toLocaleDateString();
}

/** Returns "Expires in X days" for near-expiry, or formatted date otherwise. */
export function expiryDisplay(value: string | Date | null | undefined): {
  text: string;
  urgent: boolean;
} {
  if (!value) return { text: '--', urgent: false };
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return { text: '--', urgent: false };

  const diffDays = Math.ceil((date.getTime() - Date.now()) / 86_400_000);

  if (diffDays < 0) return { text: 'Expired', urgent: true };
  if (diffDays === 0) return { text: 'Expires today', urgent: true };
  if (diffDays <= 7) return { text: `Expires in ${diffDays}d`, urgent: true };
  if (diffDays <= 30) return { text: `Expires in ${diffDays}d`, urgent: false };
  return { text: date.toLocaleDateString(), urgent: false };
}
