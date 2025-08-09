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
  updateEvent: (eventId: string, event: Partial<CalendarEvent>, providerId: string) => Promise<void>;
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
          title: "Microsoft Calendar",
          description: "Microsoft Graph OAuth integration will be available in next update.",
        });
      } else if (type === 'google') {
        // Google Calendar OAuth flow
        // window.location.href = `/api/auth/google?redirect_uri=${encodeURIComponent(window.location.origin)}`
        toast({
          title: "Google Calendar",
          description: "Google Calendar OAuth integration will be available in next update.",
        });
      }
      
      // Simulate connection for demo
      setProviders(prev => prev.map(p => 
        p.type === type 
          ? { ...p, isConnected: true, accessToken: 'demo-token', expiresAt: new Date(Date.now() + 3600000) }
          : p
      ));
      
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: `Failed to connect to ${type} calendar. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const disconnectProvider = async (id: string) => {
    try {
      setProviders(prev => prev.map(p => 
        p.id === id 
          ? { ...p, isConnected: false, accessToken: undefined, refreshToken: undefined, expiresAt: undefined }
          : p
      ));
      
      toast({
        title: "Disconnected",
        description: "Calendar provider has been disconnected.",
      });
    } catch (error) {
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect calendar provider. Please try again.",
        variant: "destructive",
      });
    }
  };

  const createEvent = async (event: CalendarEvent, providerId: string): Promise<string> => {
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider || !provider.isConnected) {
      throw new Error('Calendar provider not connected');
    }

    try {
      // TODO: Implement actual API calls
      if (provider.type === 'microsoft') {
        // Microsoft Graph API call
        // POST https://graph.microsoft.com/v1.0/me/events
        console.log('Microsoft Graph event creation:', {
          subject: event.title,
          start: {
            dateTime: event.startTime.toISOString(),
            timeZone: 'America/New_York'
          },
          end: {
            dateTime: event.endTime.toISOString(),
            timeZone: 'America/New_York'
          },
          body: {
            contentType: 'HTML',
            content: event.description || ''
          },
          location: {
            displayName: event.location || ''
          },
          attendees: event.attendees?.map(a => ({
            emailAddress: {
              address: a.email,
              name: a.name
            },
            type: a.required ? 'required' : 'optional'
          })) || []
        });
      } else if (provider.type === 'google') {
        // Google Calendar API call
        // POST https://www.googleapis.com/calendar/v3/calendars/primary/events
        console.log('Google Calendar event creation:', {
          summary: event.title,
          start: {
            dateTime: event.startTime.toISOString(),
            timeZone: 'America/New_York'
          },
          end: {
            dateTime: event.endTime.toISOString(),
            timeZone: 'America/New_York'
          },
          description: event.description || '',
          location: event.location || '',
          attendees: event.attendees?.map(a => ({
            email: a.email,
            displayName: a.name,
            responseStatus: 'needsAction'
          })) || []
        });
      }

      // Return mock event ID
      const eventId = `event-${Date.now()}`;
      
      toast({
        title: "Event Created",
        description: `Calendar event has been created in ${provider.name}.`,
      });
      
      return eventId;
      
    } catch (error) {
      toast({
        title: "Event Creation Failed",
        description: `Failed to create calendar event in ${provider.name}.`,
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateEvent = async (eventId: string, event: Partial<CalendarEvent>, providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider || !provider.isConnected) {
      throw new Error('Calendar provider not connected');
    }

    // TODO: Implement actual API calls for updating events
    toast({
      title: "Event Updated",
      description: `Calendar event has been updated in ${provider.name}.`,
    });
  };

  const deleteEvent = async (eventId: string, providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider || !provider.isConnected) {
      throw new Error('Calendar provider not connected');
    }

    // TODO: Implement actual API calls for deleting events
    toast({
      title: "Event Deleted",
      description: `Calendar event has been deleted from ${provider.name}.`,
    });
  };

  return (
    <CalendarContext.Provider value={{
      providers,
      connectProvider,
      disconnectProvider,
      createEvent,
      updateEvent,
      deleteEvent
    }}>
      {children}
    </CalendarContext.Provider>
  );
};