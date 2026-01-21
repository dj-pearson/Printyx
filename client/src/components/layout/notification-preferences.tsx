import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail, MessageSquare, Smartphone, Moon, Volume2, Clock, Filter } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export interface NotificationChannel {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface NotificationTypePreference {
  type: string;
  label: string;
  description: string;
  channels: NotificationChannel;
  priority: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
}

export interface NotificationPreferences {
  types: NotificationTypePreference[];
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;
  };
  digestMode: {
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time?: string; // HH:MM for daily/weekly
  };
  soundEnabled: boolean;
  desktopNotifications: boolean;
}

interface NotificationPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_NOTIFICATION_TYPES: NotificationTypePreference[] = [
  {
    type: 'equipment_down',
    label: 'Equipment Down',
    description: 'Critical equipment failures requiring immediate attention',
    channels: { inApp: true, email: true, sms: true, push: true },
    priority: 'critical',
    enabled: true,
  },
  {
    type: 'payment_failed',
    label: 'Payment Failed',
    description: 'Failed payment attempts from customers',
    channels: { inApp: true, email: true, sms: false, push: true },
    priority: 'high',
    enabled: true,
  },
  {
    type: 'service_due',
    label: 'Service Due',
    description: 'Upcoming scheduled service appointments',
    channels: { inApp: true, email: true, sms: false, push: false },
    priority: 'medium',
    enabled: true,
  },
  {
    type: 'contract_expiring',
    label: 'Contract Expiring',
    description: 'Customer contracts nearing expiration',
    channels: { inApp: true, email: true, sms: false, push: false },
    priority: 'high',
    enabled: true,
  },
  {
    type: 'meter_reading_due',
    label: 'Meter Reading Due',
    description: 'Meter readings that need to be submitted',
    channels: { inApp: true, email: false, sms: false, push: false },
    priority: 'medium',
    enabled: true,
  },
  {
    type: 'low_supplies',
    label: 'Low Supplies',
    description: 'Inventory items below threshold',
    channels: { inApp: true, email: false, sms: false, push: false },
    priority: 'low',
    enabled: true,
  },
  {
    type: 'new_customer_message',
    label: 'Customer Messages',
    description: 'New messages from customers via portal',
    channels: { inApp: true, email: true, sms: false, push: true },
    priority: 'medium',
    enabled: true,
  },
  {
    type: 'team_mention',
    label: 'Team Mentions',
    description: 'When someone mentions you in a note or comment',
    channels: { inApp: true, email: false, sms: false, push: true },
    priority: 'medium',
    enabled: true,
  },
];

export function NotificationPreferencesDialog({
  open,
  onOpenChange,
}: NotificationPreferencesDialogProps) {
  const queryClient = useQueryClient();

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/user/notification-preferences'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/user/notification-preferences');
      } catch (err) {
        // Return defaults if endpoint doesn't exist
        return {
          types: DEFAULT_NOTIFICATION_TYPES,
          quietHours: { enabled: false, start: '22:00', end: '08:00' },
          digestMode: { enabled: false, frequency: 'daily' as const, time: '09:00' },
          soundEnabled: true,
          desktopNotifications: true,
        };
      }
    },
    enabled: open,
  });

  const [localPreferences, setLocalPreferences] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: (prefs: NotificationPreferences) =>
      apiRequest('/api/user/notification-preferences', 'PUT', prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/notification-preferences'] });
      toast({
        title: 'Preferences saved',
        description: 'Your notification preferences have been updated.',
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: 'Failed to save',
        description: 'Could not save notification preferences. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleToggleType = (typeId: string) => {
    if (!localPreferences) return;
    setLocalPreferences({
      ...localPreferences,
      types: localPreferences.types.map((t) =>
        t.type === typeId ? { ...t, enabled: !t.enabled } : t,
      ),
    });
  };

  const handleToggleChannel = (typeId: string, channel: keyof NotificationChannel) => {
    if (!localPreferences) return;
    setLocalPreferences({
      ...localPreferences,
      types: localPreferences.types.map((t) =>
        t.type === typeId
          ? { ...t, channels: { ...t.channels, [channel]: !t.channels[channel] } }
          : t,
      ),
    });
  };

  const handleSave = () => {
    if (localPreferences) {
      saveMutation.mutate(localPreferences);
    }
  };

  const getPriorityColor = (priority: NotificationTypePreference['priority']) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-blue-500';
      case 'low':
        return 'bg-gray-400';
    }
  };

  if (!localPreferences) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </DialogTitle>
          <DialogDescription>Customize how and when you receive notifications</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Global Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Global Settings</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Sound Effects</Label>
                  <p className="text-xs text-muted-foreground">
                    Play sound when notifications arrive
                  </p>
                </div>
              </div>
              <Switch
                checked={localPreferences.soundEnabled}
                onCheckedChange={(checked) =>
                  setLocalPreferences({ ...localPreferences, soundEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Desktop Notifications</Label>
                  <p className="text-xs text-muted-foreground">Show browser push notifications</p>
                </div>
              </div>
              <Switch
                checked={localPreferences.desktopNotifications}
                onCheckedChange={(checked) =>
                  setLocalPreferences({
                    ...localPreferences,
                    desktopNotifications: checked,
                  })
                }
              />
            </div>
          </div>

          <Separator />

          {/* Quiet Hours */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Quiet Hours</Label>
                  <p className="text-xs text-muted-foreground">
                    Pause non-critical notifications during specified hours
                  </p>
                </div>
              </div>
              <Switch
                checked={localPreferences.quietHours.enabled}
                onCheckedChange={(checked) =>
                  setLocalPreferences({
                    ...localPreferences,
                    quietHours: { ...localPreferences.quietHours, enabled: checked },
                  })
                }
              />
            </div>

            {localPreferences.quietHours.enabled && (
              <div className="flex items-center gap-4 ml-6">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">From</Label>
                  <Select
                    value={localPreferences.quietHours.start}
                    onValueChange={(value) =>
                      setLocalPreferences({
                        ...localPreferences,
                        quietHours: { ...localPreferences.quietHours, start: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={hour} value={`${hour}:00`}>
                            {hour}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs">To</Label>
                  <Select
                    value={localPreferences.quietHours.end}
                    onValueChange={(value) =>
                      setLocalPreferences({
                        ...localPreferences,
                        quietHours: { ...localPreferences.quietHours, end: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={hour} value={`${hour}:00`}>
                            {hour}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Digest Mode */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>Digest Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Group low-priority notifications into periodic summaries
                  </p>
                </div>
              </div>
              <Switch
                checked={localPreferences.digestMode.enabled}
                onCheckedChange={(checked) =>
                  setLocalPreferences({
                    ...localPreferences,
                    digestMode: { ...localPreferences.digestMode, enabled: checked },
                  })
                }
              />
            </div>

            {localPreferences.digestMode.enabled && (
              <div className="flex items-center gap-4 ml-6">
                <Label className="text-xs">Frequency</Label>
                <Select
                  value={localPreferences.digestMode.frequency}
                  onValueChange={(value: any) =>
                    setLocalPreferences({
                      ...localPreferences,
                      digestMode: {
                        ...localPreferences.digestMode,
                        frequency: value,
                      },
                    })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>

                {localPreferences.digestMode.frequency !== 'hourly' && (
                  <>
                    <Label className="text-xs">at</Label>
                    <Select
                      value={localPreferences.digestMode.time || '09:00'}
                      onValueChange={(value) =>
                        setLocalPreferences({
                          ...localPreferences,
                          digestMode: { ...localPreferences.digestMode, time: value },
                        })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, '0');
                          return (
                            <SelectItem key={hour} value={`${hour}:00`}>
                              {hour}:00
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Notification Types */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Notification Types</h3>
            </div>

            <div className="space-y-3">
              {localPreferences.types.map((type) => (
                <Card key={type.type} className={!type.enabled ? 'opacity-50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-2 w-2 rounded-full ${getPriorityColor(type.priority)}`}
                        />
                        <div>
                          <CardTitle className="text-sm">{type.label}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={type.enabled}
                        onCheckedChange={() => handleToggleType(type.type)}
                      />
                    </div>
                  </CardHeader>

                  {type.enabled && (
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Channels:</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={type.channels.inApp ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleToggleChannel(type.type, 'inApp')}
                          >
                            <Bell className="h-3 w-3 mr-1" />
                            App
                          </Button>
                          <Button
                            variant={type.channels.email ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleToggleChannel(type.type, 'email')}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            Email
                          </Button>
                          <Button
                            variant={type.channels.sms ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleToggleChannel(type.type, 'sms')}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            SMS
                          </Button>
                          <Button
                            variant={type.channels.push ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleToggleChannel(type.type, 'push')}
                          >
                            <Smartphone className="h-3 w-3 mr-1" />
                            Push
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
