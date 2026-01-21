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
      // TODO: Implement OAuth flow for calendar providers
      // This would normally initiate OAuth 2.0 flow

      if (type === 'microsoft') {
        // Microsoft Graph OAuth flow
        // window.location.href = `/api/auth/microsoft?redirect_uri=${encodeURIComponent(window.location.origin)}`
        toast({
          title: 'Preview Mode - Microsoft Calendar',
          description:
            '🚧 OAuth integration coming soon. This is a demo connection for testing the UI.',
        });
      } else if (type === 'google') {
        // Google Calendar OAuth flow
        // window.location.href = `/api/auth/google?redirect_uri=${encodeURIComponent(window.location.origin)}`
        toast({
          title: 'Preview Mode - Google Calendar',
          description:
            '🚧 OAuth integration coming soon. This is a demo connection for testing the UI.',
        });
      }

      // Simulate connection for demo
      setProviders((prev) =>
        prev.map((p) =>
          p.type === type
            ? {
                ...p,
                isConnected: true,
                accessToken: 'demo-token',
                expiresAt: new Date(Date.now() + 3600000),
              }
            : p,
        ),
      );
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: `Failed to connect to ${type} calendar. Please try again.`,
        variant: 'destructive',
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
      // TODO: Implement actual API calls
      // When OAuth is implemented, make actual API calls here:
      // - Microsoft Graph: POST https://graph.microsoft.com/v1.0/me/events
      // - Google Calendar: POST https://www.googleapis.com/calendar/v3/calendars/primary/events

      // Return mock event ID for preview mode
      const eventId = `event-${Date.now()}`;

      toast({
        title: 'Preview Mode - Event Created',
        description: `📅 Event "${event.title}" simulated in ${provider.name}. Real calendar sync coming soon.`,
      });

      return eventId;
    } catch (error) {
      toast({
        title: 'Event Creation Failed',
        description: `Failed to create calendar event in ${provider.name}.`,
        variant: 'destructive',
      });
      throw error;
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

    // TODO: Implement actual API calls for updating events
    toast({
      title: 'Preview Mode - Event Updated',
      description: `📝 Event changes simulated in ${provider.name}. Real calendar sync coming soon.`,
    });
  };

  const deleteEvent = async (eventId: string, providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);

    if (!provider || !provider.isConnected) {
      throw new Error('Calendar provider not connected');
    }

    // TODO: Implement actual API calls for deleting events
    toast({
      title: 'Preview Mode - Event Deleted',
      description: `🗑️ Event deletion simulated in ${provider.name}. Real calendar sync coming soon.`,
    });
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
