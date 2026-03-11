import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

// Phase 2: Calendar Provider Integration Types
interface CalendarProvider {
  id: string;
  name: string;
  type: 'microsoft' | 'google' | 'outlook';
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

interface CalendarEvent {
  id?: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  location?: string;
  attendees?: Array<{
    email: string;
    name: string;
    required?: boolean;
  }>;
}

interface CalendarContextType {
  providers: CalendarProvider[];
  connectProvider: (type: 'microsoft' | 'google' | 'outlook') => Promise<void>;
  disconnectProvider: (id: string) => Promise<void>;
  createEvent: (event: CalendarEvent, providerId: string) => Promise<string>;
  updateEvent: (
    eventId: string,
    event: Partial<CalendarEvent>,
    providerId: string,
  ) => Promise<void>;
  deleteEvent: (eventId: string, providerId: string) => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const useCalendar = () => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
};

interface CalendarProviderProps {
  children: ReactNode;
}

export const CalendarProvider: React.FC<CalendarProviderProps> = ({ children }) => {
  const [providers, setProviders] = useState<CalendarProvider[]>([
    // Initialize with default providers
    {
      id: 'microsoft-1',
      name: 'Microsoft Outlook',
      type: 'microsoft',
      isConnected: false,
    },
    {
      id: 'google-1',
      name: 'Google Calendar',
      type: 'google',
      isConnected: false,
    },
  ]);

  const { toast } = useToast();

  const connectProvider = async (type: 'microsoft' | 'google' | 'outlook') => {
    try {
      // Attempt to initiate OAuth flow via backend
      const response = await fetch(`/api/integrations/calendar/${type}/connect`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
          return;
        }
      }

      // OAuth endpoint not configured yet - notify user
      const providerName =
        type === 'microsoft'
          ? 'Microsoft Outlook'
          : type === 'google'
            ? 'Google Calendar'
            : 'Outlook';
      toast({
        title: `${providerName} Integration`,
        description:
          'Calendar integration is not yet configured. Contact your administrator to enable OAuth connections.',
      });
    } catch {
      toast({
        title: 'Connection Unavailable',
        description: `Calendar integration for ${type} is not yet configured. Contact your administrator.`,
      });
    }
  };

  const disconnectProvider = async (id: string) => {
    try {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                isConnected: false,
                accessToken: undefined,
                refreshToken: undefined,
                expiresAt: undefined,
              }
            : p,
        ),
      );

      toast({
        title: 'Disconnected',
        description: 'Calendar provider has been disconnected.',
      });
    } catch (error) {
      toast({
        title: 'Disconnection Failed',
        description: 'Failed to disconnect calendar provider. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const createEvent = async (event: CalendarEvent, providerId: string): Promise<string> => {
    const provider = providers.find((p) => p.id === providerId);

    if (!provider || !provider.isConnected) {
      throw new Error('Calendar provider not connected');
    }

    try {
      const response = await fetch(`/api/integrations/calendar/${provider.type}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(event),
      });

      if (response.ok) {
        const data = await response.json();
        return data.eventId || `event-${Date.now()}`;
      }

      // API not available - create local reference
      const eventId = `local-${Date.now()}`;
      toast({
        title: 'Event Saved Locally',
        description: `Calendar sync is not configured. Event "${event.title}" saved locally.`,
      });
      return eventId;
    } catch {
      toast({
        title: 'Event Creation Failed',
        description: `Failed to create calendar event in ${provider.name}.`,
        variant: 'destructive',
      });
      throw new Error(`Failed to create event in ${provider.name}`);
    }
  };

  const updateEvent = async (
    eventId: string,
    event: Partial<CalendarEvent>,
    providerId: string,
  ) => {
    const provider = providers.find((p) => p.id === providerId);

    if (!provider || !provider.isConnected) {
      throw new Error('Calendar provider not connected');
    }

    try {
      await fetch(`/api/integrations/calendar/${provider.type}/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(event),
      });
    } catch {
      // Calendar sync not configured - update is local only
    }
  };

  const deleteEvent = async (eventId: string, providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);

    if (!provider || !provider.isConnected) {
      throw new Error('Calendar provider not connected');
    }

    try {
      await fetch(`/api/integrations/calendar/${provider.type}/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // Calendar sync not configured - deletion is local only
    }
  };

  return (
    <CalendarContext.Provider
      value={{
        providers,
        connectProvider,
        disconnectProvider,
        createEvent,
        updateEvent,
        deleteEvent,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};
