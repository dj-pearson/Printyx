/**
 * Activity Timeline Component
 *
 * FN-008: Unified activity timeline for all entity detail pages.
 *
 * Displays a chronological list of activities/events related to an entity.
 * Supports different activity types with distinct icons and colors.
 */

import React from 'react';
import {
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  FileText,
  Edit,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  ArrowRight,
} from 'lucide-react';

export interface ActivityItem {
  id: string;
  type:
    | 'note'
    | 'call'
    | 'email'
    | 'meeting'
    | 'document'
    | 'edit'
    | 'create'
    | 'delete'
    | 'status_change'
    | 'task'
    | 'system';
  title: string;
  description?: string;
  timestamp: string;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, string>;
}

const typeConfig: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
  note: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-100' },
  call: { icon: Phone, color: 'text-green-600', bg: 'bg-green-100' },
  email: { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-100' },
  meeting: { icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100' },
  document: { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
  edit: { icon: Edit, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  create: { icon: Plus, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  delete: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100' },
  status_change: { icon: ArrowRight, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  task: { icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-100' },
  system: { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-50' },
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  loading?: boolean;
  maxItems?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function ActivityTimeline({
  activities,
  loading = false,
  maxItems,
  onLoadMore,
  hasMore = false,
}: ActivityTimelineProps) {
  const items = maxItems ? activities.slice(0, maxItems) : activities;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

      <div className="space-y-4">
        {items.map((activity) => {
          const config = typeConfig[activity.type] || typeConfig.system;
          const Icon = config.icon;

          return (
            <div key={activity.id} className="relative flex gap-3 pl-0">
              {/* Icon */}
              <div
                className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${config.bg} flex items-center justify-center`}
              >
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatTimestamp(activity.timestamp)}
                  </span>
                </div>
                {activity.description && (
                  <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                )}
                {activity.user && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <User className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-500">{activity.user.name}</span>
                  </div>
                )}
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {Object.entries(activity.metadata).map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && onLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="w-full text-center py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Load more activity
        </button>
      )}
    </div>
  );
}
