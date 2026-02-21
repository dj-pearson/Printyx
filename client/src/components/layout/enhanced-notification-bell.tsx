import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  AlertCircle,
  Clock,
  Settings,
  CheckCheck,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';
export type NotificationType =
  | 'equipment_down'
  | 'payment_failed'
  | 'service_due'
  | 'contract_expiring'
  | 'meter_reading_due'
  | 'low_supplies'
  | 'general';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  category: 'service' | 'billing' | 'inventory' | 'system' | 'customer';
  createdAt: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

interface GroupedNotifications {
  critical: Notification[];
  high: Notification[];
  medium: Notification[];
  low: Notification[];
}

function getPriorityIcon(priority: NotificationPriority) {
  switch (priority) {
    case 'critical':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'medium':
      return <Info className="h-4 w-4 text-blue-600" />;
    case 'low':
      return <CheckCircle className="h-4 w-4 text-gray-600" />;
  }
}

function getPriorityColor(priority: NotificationPriority) {
  switch (priority) {
    case 'critical':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-blue-500';
    case 'low':
      return 'bg-gray-500';
  }
}

function groupNotifications(notifications: Notification[]): GroupedNotifications {
  return notifications.reduce(
    (acc, notification) => {
      acc[notification.priority].push(notification);
      return acc;
    },
    { critical: [], high: [], medium: [], low: [] } as GroupedNotifications,
  );
}

// Smart batching: group similar notifications
function batchSimilarNotifications(notifications: Notification[]): Array<{
  type: string;
  count: number;
  items: Notification[];
  summary: string;
}> {
  const batches = new Map<string, Notification[]>();

  notifications.forEach((notif) => {
    const key = notif.type;
    if (!batches.has(key)) {
      batches.set(key, []);
    }
    batches.get(key)!.push(notif);
  });

  return Array.from(batches.entries())
    .map(([type, items]) => {
      const count = items.length;
      let summary = '';

      switch (type) {
        case 'meter_reading_due':
          summary = `${count} meter reading${count > 1 ? 's' : ''} due this week`;
          break;
        case 'service_due':
          summary = `${count} service${count > 1 ? 's' : ''} scheduled`;
          break;
        case 'contract_expiring':
          summary = `${count} contract${count > 1 ? 's' : ''} expiring soon`;
          break;
        case 'low_supplies':
          summary = `${count} item${count > 1 ? 's' : ''} low in stock`;
          break;
        default:
          summary = `${count} ${type.replace(/_/g, ' ')} notification${count > 1 ? 's' : ''}`;
      }

      return { type, count, items, summary };
    })
    .filter((batch) => batch.count > 1) // Only batch if there are 2+ similar notifications
    .sort((a, b) => b.count - a.count);
}

export function EnhancedNotificationBell() {
  const [open, setOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'unread'>('unread');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      // Fallback to alerts endpoint if notifications endpoint doesn't exist
      try {
        return await apiRequest('/api/notifications');
      } catch (err) {
        const alerts = await apiRequest('/api/performance/alerts');
        // Transform alerts to notifications format
        return alerts.map((alert: any) => ({
          id: alert.id,
          type: 'general' as NotificationType,
          priority: alert.severity || 'medium',
          title: alert.category || 'System Alert',
          message: alert.message,
          category: alert.category || 'system',
          createdAt: alert.createdAt || new Date().toISOString(),
          read: false,
        }));
      }
    },
    refetchInterval: 30_000, // Refresh every 30 seconds
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/notifications/${notificationId}/read`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest('/api/notifications/read-all', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: 'All notifications marked as read',
        variant: 'default',
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/notifications/${notificationId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  // Show critical notifications as toasts
  useEffect(() => {
    const critical = notifications.find((n) => n.priority === 'critical' && !n.read);
    if (critical) {
      toast({
        title: critical.title,
        description: critical.message,
        variant: 'destructive',
        action: critical.actionUrl ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = critical.actionUrl!)}
          >
            {critical.actionLabel || 'View'}
          </Button>
        ) : undefined,
      });
    }
  }, [notifications]);

  // WebSocket listener for real-time notification delivery
  useEffect(() => {
    const userId = user?.id;
    const tenantId = (user as any)?.tenantId;
    if (!userId || !tenantId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/reporting?userId=${userId}&tenantId=${tenantId}`;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'notification' && msg.data) {
              // Invalidate the notifications query to refetch from server
              queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          // Reconnect after 10 seconds
          reconnectTimer = setTimeout(connect, 10_000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        // Silently fail - polling fallback is always active
      }
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [user, queryClient]);

  const unreadNotifications = notifications.filter((n) => !n.read);
  const displayNotifications = selectedTab === 'unread' ? unreadNotifications : notifications;

  const grouped = groupNotifications(displayNotifications);
  const batches = batchSimilarNotifications(displayNotifications);

  const unreadCount = unreadNotifications.length;
  const hasCritical = grouped.critical.length > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell
            className={cn('h-5 w-5 transition-all', hasCritical && 'animate-pulse text-red-600')}
          />
          {unreadCount > 0 && (
            <Badge
              className={cn(
                'absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs',
                hasCritical ? 'bg-red-500' : 'bg-blue-500',
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-4 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => markAllAsReadMutation.mutate()}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="unread" className="text-xs">
              Unread ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              All ({notifications.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px]">
            <TabsContent value="all" className="mt-0">
              {renderNotificationsList()}
            </TabsContent>
            <TabsContent value="unread" className="mt-0">
              {renderNotificationsList()}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {displayNotifications.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No {selectedTab === 'unread' ? 'unread' : ''} notifications</p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  function renderNotificationsList() {
    if (displayNotifications.length === 0) return null;

    return (
      <div className="space-y-1 p-1">
        {/* Show batched notifications first if applicable */}
        {batches.length > 0 && (
          <>
            {batches.map((batch) => (
              <div
                key={batch.type}
                className="p-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer"
                onClick={() => {
                  // Could expand to show individual items
                  console.log('Batch clicked', batch);
                }}
              >
                <div className="flex items-start gap-3">
                  {getPriorityIcon(batch.items[0].priority)}
                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-medium">{batch.summary}</div>
                    <div className="text-xs text-muted-foreground">Click to see details</div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {batch.count}
                  </Badge>
                </div>
              </div>
            ))}
            <DropdownMenuSeparator className="my-2" />
          </>
        )}

        {/* Critical priority notifications */}
        {grouped.critical.length > 0 && (
          <>
            <div className="px-3 py-1 text-xs font-semibold text-red-600 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              Critical ({grouped.critical.length})
            </div>
            {grouped.critical.map((notification) => renderNotification(notification))}
            {(grouped.high.length > 0 || grouped.medium.length > 0 || grouped.low.length > 0) && (
              <DropdownMenuSeparator className="my-2" />
            )}
          </>
        )}

        {/* High priority notifications */}
        {grouped.high.length > 0 && (
          <>
            <div className="px-3 py-1 text-xs font-semibold text-orange-600 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              High ({grouped.high.length})
            </div>
            {grouped.high.map((notification) => renderNotification(notification))}
            {(grouped.medium.length > 0 || grouped.low.length > 0) && (
              <DropdownMenuSeparator className="my-2" />
            )}
          </>
        )}

        {/* Medium and Low priority (collapsed by default) */}
        {(grouped.medium.length > 0 || grouped.low.length > 0) && (
          <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">
            Other ({grouped.medium.length + grouped.low.length})
          </div>
        )}
        {grouped.medium.map((notification) => renderNotification(notification))}
        {grouped.low.map((notification) => renderNotification(notification))}
      </div>
    );
  }

  function renderNotification(notification: Notification) {
    return (
      <div
        key={notification.id}
        className={cn(
          'p-3 rounded-md hover:bg-accent cursor-pointer transition-colors',
          !notification.read && 'bg-blue-50/50 dark:bg-blue-950/20',
        )}
        onClick={() => {
          if (!notification.read) {
            markAsReadMutation.mutate(notification.id);
          }
          if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
          }
        }}
      >
        <div className="flex items-start gap-3">
          {getPriorityIcon(notification.priority)}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium truncate">{notification.title}</div>
              {!notification.read && (
                <div
                  className={cn('h-2 w-2 rounded-full', getPriorityColor(notification.priority))}
                />
              )}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">{notification.message}</div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {notification.actionLabel && (
                <span className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                  <ExternalLink className="h-3 w-3" />
                  {notification.actionLabel}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              deleteNotificationMutation.mutate(notification.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }
}
