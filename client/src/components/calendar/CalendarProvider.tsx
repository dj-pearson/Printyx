import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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

// PA-052: this component called /api/integrations/calendar/{type}/connect,
// /events and /events/:id. Nothing has ever served that prefix on either host,
// while supabase/functions/meetings/ serves the same capability at
// /api/meetings/calendar/* over calendar_connections and calendar_events, with
// the real Google and Microsoft clients in _shared/ and push propagation to the
// provider. This now calls that surface rather than adding a fourth calendar
// implementation.
//
// The old provider list was two hardcoded entries with isConnected:false, and
// nothing ever set it true - so createEvent, updateEvent and deleteEvent all
// threw "Calendar provider not connected" before reaching any endpoint. The
// three paths had no reachable caller at all.
interface CalendarConnectionRow {
  id: string;
  provider: string;
  calendar_name?: string | null;
  calendar_id?: string | null;
  sync_enabled?: boolean | null;
  token_expires_at?: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  microsoft: 'Microsoft Outlook',
  outlook: 'Microsoft Outlook',
  google: 'Google Calendar',
};

export const CalendarProvider: React.FC<CalendarProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();

  const { data: connections = [] } = useQuery<CalendarConnectionRow[]>({
    queryKey: ['/api/meetings/calendar/connections'],
  });

  // A connected provider is one with a row. Nothing else can establish it.
  const providers: CalendarProvider[] = connections.map((c) => ({
    id: c.id,
    name: c.calendar_name || PROVIDER_LABEL[c.provider] || c.provider,
    type: (c.provider === 'outlook' ? 'microsoft' : c.provider) as CalendarProvider['type'],
    isConnected: c.sync_enabled !== false,
  }));

  const { toast } = useToast();

  const connectProvider = async (type: 'microsoft' | 'google' | 'outlook') => {
    // Connecting needs an OAuth authorize round trip for CALENDAR scopes, and
    // there is no production implementation of one: the only authorize flow in
    // the edge tree is supabase/functions/oauth-proxy, which requests
    // openid/email/profile for sign-in, and the calendar OAuth init in
    // server/integrations/routes.ts is Express-only, which the browser cannot
    // reach in production. /api/meetings/calendar/connections takes tokens; it
    // does not obtain them. PA-056 carries that gap.
    const providerName = PROVIDER_LABEL[type] ?? type;
    toast({
      title: `${providerName} not connected`,
      description:
        'Calendar sign-in is not available yet. An administrator can add a connection once OAuth is configured.',
    });
  };

  const disconnectProvider = async (id: string) => {
    try {
      await apiRequest(`/api/meetings/calendar/connections/${id}`, 'DELETE');
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/calendar/connections'] });
      toast({
        title: 'Disconnected',
        description: 'Calendar provider has been disconnected.',
      });
    } catch {
      // The old version only mutated local state, so it always reported success
      // and the provider came back on the next render.
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

    const data = await apiRequest('/api/meetings/calendar/events', 'POST', {
      calendarConnectionId: provider.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      attendees: event.attendees ?? [],
    });
    return data?.id;
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

    // The events handler is PUT, not PATCH. A silent catch used to swallow the
    // difference along with everything else.
    await apiRequest(`/api/meetings/calendar/events/${eventId}`, 'PUT', event);
  };

  const deleteEvent = async (eventId: string, providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider || !provider.isConnected) {
      throw new Error('Calendar provider not connected');
    }

    await apiRequest(`/api/meetings/calendar/events/${eventId}`, 'DELETE');
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
