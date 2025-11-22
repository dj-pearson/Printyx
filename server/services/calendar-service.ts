/**
 * Calendar Service
 * Handles external calendar integrations (Google, Outlook, iCloud)
 */

import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string;
  attendees?: string[];
  status: 'confirmed' | 'tentative' | 'cancelled';
}

interface CalendarConnection {
  id: string;
  provider: 'google' | 'outlook' | 'icloud';
  accessToken: string;
  refreshToken?: string;
  calendarId: string;
}

class CalendarService {
  /**
   * Google Calendar Integration
   */
  async syncGoogleCalendar(connection: CalendarConnection): Promise<CalendarEvent[]> {
    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth });

      // Get events from the last 30 days to 30 days in future
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const response = await calendar.events.list({
        calendarId: connection.calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      return events.map((event) => ({
        id: event.id!,
        title: event.summary || 'Untitled Event',
        description: event.description,
        startTime: new Date(event.start?.dateTime || event.start?.date || ''),
        endTime: new Date(event.end?.dateTime || event.end?.date || ''),
        isAllDay: !!event.start?.date,
        location: event.location,
        attendees: event.attendees?.map((attendee) => attendee.email || '') || [],
        status: (event.status as any) || 'confirmed',
      }));
    } catch (error) {
      console.error('Google Calendar sync error:', error);
      throw new Error('Failed to sync Google Calendar');
    }
  }

  /**
   * Outlook Calendar Integration
   */
  async syncOutlookCalendar(connection: CalendarConnection): Promise<CalendarEvent[]> {
    try {
      const graphClient = Client.init({
        authProvider: {
          getAccessToken: async () => connection.accessToken,
        },
      });

      // Get events from the last 30 days to 30 days in future
      const now = new Date();
      const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const events = await graphClient
        .api('/me/events')
        .filter(
          `start/dateTime ge '${timeMin.toISOString()}' and start/dateTime le '${timeMax.toISOString()}'`,
        )
        .select('id,subject,body,start,end,location,attendees,showAs')
        .orderby('start/dateTime')
        .get();

      return events.value.map((event: any) => ({
        id: event.id,
        title: event.subject || 'Untitled Event',
        description: event.body?.content,
        startTime: new Date(event.start.dateTime),
        endTime: new Date(event.end.dateTime),
        isAllDay: event.isAllDay || false,
        location: event.location?.displayName,
        attendees: event.attendees?.map((attendee: any) => attendee.emailAddress?.address) || [],
        status: event.showAs === 'free' ? 'tentative' : 'confirmed',
      }));
    } catch (error) {
      console.error('Outlook Calendar sync error:', error);
      throw new Error('Failed to sync Outlook Calendar');
    }
  }

  /**
   * Create event in external calendar
   */
  async createExternalEvent(
    connection: CalendarConnection,
    event: Partial<CalendarEvent>,
  ): Promise<string> {
    switch (connection.provider) {
      case 'google':
        return this.createGoogleEvent(connection, event);
      case 'outlook':
        return this.createOutlookEvent(connection, event);
      default:
        throw new Error(`Unsupported calendar provider: ${connection.provider}`);
    }
  }

  private async createGoogleEvent(
    connection: CalendarConnection,
    event: Partial<CalendarEvent>,
  ): Promise<string> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const googleEvent = {
      summary: event.title,
      description: event.description,
      start: event.isAllDay
        ? { date: event.startTime?.toISOString().split('T')[0] }
        : { dateTime: event.startTime?.toISOString() },
      end: event.isAllDay
        ? { date: event.endTime?.toISOString().split('T')[0] }
        : { dateTime: event.endTime?.toISOString() },
      location: event.location,
      attendees: event.attendees?.map((email) => ({ email })),
    };

    const response = await calendar.events.insert({
      calendarId: connection.calendarId,
      requestBody: googleEvent,
    });

    return response.data.id!;
  }

  private async createOutlookEvent(
    connection: CalendarConnection,
    event: Partial<CalendarEvent>,
  ): Promise<string> {
    const graphClient = Client.init({
      authProvider: {
        getAccessToken: async () => connection.accessToken,
      },
    });

    const outlookEvent = {
      subject: event.title,
      body: {
        contentType: 'text',
        content: event.description || '',
      },
      start: {
        dateTime: event.startTime?.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: event.endTime?.toISOString(),
        timeZone: 'UTC',
      },
      location: event.location ? { displayName: event.location } : undefined,
      attendees: event.attendees?.map((email) => ({
        emailAddress: { address: email, name: email },
        type: 'required',
      })),
      isAllDay: event.isAllDay,
    };

    const response = await graphClient.api('/me/events').post(outlookEvent);

    return response.id;
  }

  /**
   * Get user's availability for a specific time range
   */
  async getUserAvailability(
    tenantId: string,
    userId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{ busy: Array<{ start: Date; end: Date }> }> {
    // This would integrate with the calendar_events table to find busy times
    // For now, return mock data
    return {
      busy: [
        {
          start: new Date('2025-09-26T10:00:00Z'),
          end: new Date('2025-09-26T11:00:00Z'),
        },
        {
          start: new Date('2025-09-26T14:00:00Z'),
          end: new Date('2025-09-26T15:30:00Z'),
        },
      ],
    };
  }

  /**
   * Find optimal meeting time for multiple attendees
   */
  async findOptimalMeetingTime(
    tenantId: string,
    attendeeIds: string[],
    duration: number, // in minutes
    preferredStart: Date,
    preferredEnd: Date,
  ): Promise<Date[]> {
    // This would analyze availability of all attendees and suggest optimal times
    // For now, return mock suggestions
    const suggestions: Date[] = [];
    const current = new Date(preferredStart);

    while (current < preferredEnd) {
      // Add suggestion every 2 hours during business hours
      if (current.getHours() >= 9 && current.getHours() <= 17) {
        suggestions.push(new Date(current));
      }
      current.setHours(current.getHours() + 2);

      if (suggestions.length >= 5) break; // Limit to 5 suggestions
    }

    return suggestions;
  }
}

export default new CalendarService();
