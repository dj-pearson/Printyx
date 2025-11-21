/**
 * Calendar Routes
 * API endpoints for calendar integration and event management
 */

import express from 'express';
import CalendarService from '../services/calendar-service';

const router = express.Router();

// Mock authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'mock-user-id', tenantId: 'mock-tenant-id' };
  next();
};

/**
 * GET /api/calendar/connections
 * Get user's calendar connections
 */
router.get('/connections', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const userId = req.user.id;

    // Mock response for now - would query calendar_connections table
    const connections = [
      {
        id: '1',
        provider: 'google',
        calendarName: 'Primary Calendar',
        isConnected: true,
        lastSync: new Date(),
      },
    ];

    res.json(connections);
  } catch (error) {
    console.error('Error fetching calendar connections:', error);
    res.status(500).json({ error: 'Failed to fetch calendar connections' });
  }
});

/**
 * POST /api/calendar/connections
 * Add a new calendar connection
 */
router.post('/connections', requireAuth, async (req, res) => {
  try {
    const { provider, accessToken, refreshToken, calendarId } = req.body;
    const { tenantId } = req.user;
    const userId = req.user.id;

    if (!provider || !accessToken) {
      return res.status(400).json({ error: 'Provider and access token are required' });
    }

    // Mock response - would create in calendar_connections table
    const connection = {
      id: `conn-${Date.now()}`,
      provider,
      calendarId: calendarId || 'primary',
      isConnected: true,
      createdAt: new Date(),
    };

    res.json(connection);
  } catch (error) {
    console.error('Error creating calendar connection:', error);
    res.status(500).json({ error: 'Failed to create calendar connection' });
  }
});

/**
 * POST /api/calendar/sync/:connectionId
 * Sync events from external calendar
 */
router.post('/sync/:connectionId', requireAuth, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Mock sync process
    const syncResult = {
      connectionId,
      status: 'success',
      eventsSynced: 15,
      eventsCreated: 3,
      eventsUpdated: 12,
      eventsDeleted: 0,
      lastSync: new Date(),
    };

    res.json(syncResult);
  } catch (error) {
    console.error('Error syncing calendar:', error);
    res.status(500).json({ error: 'Failed to sync calendar' });
  }
});

/**
 * GET /api/calendar/events
 * Get calendar events for a date range
 */
router.get('/events', requireAuth, async (req, res) => {
  try {
    const { start, end, calendarIds } = req.query;
    const { tenantId } = req.user;
    const userId = req.user.id;

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    // Mock events for now
    const events = [
      {
        id: 'event-1',
        title: 'Team Meeting',
        description: 'Weekly team sync',
        startTime: '2025-09-26T10:00:00Z',
        endTime: '2025-09-26T11:00:00Z',
        isAllDay: false,
        location: 'Conference Room A',
        attendees: ['user1@company.com', 'user2@company.com'],
        status: 'confirmed',
        eventType: 'meeting',
        isAiGenerated: false,
      },
      {
        id: 'event-2',
        title: 'Follow up with ABC Corp',
        description: 'AI-scheduled follow-up call',
        startTime: '2025-09-26T14:00:00Z',
        endTime: '2025-09-26T14:30:00Z',
        isAllDay: false,
        eventType: 'task',
        isAiGenerated: true,
        aiConfidence: 0.85,
        relatedEntityType: 'lead',
        relatedEntityId: 'lead-123',
      },
      {
        id: 'event-3',
        title: 'Focus Time: Proposal Writing',
        description: 'AI-blocked time for deep work',
        startTime: '2025-09-26T15:00:00Z',
        endTime: '2025-09-26T17:00:00Z',
        isAllDay: false,
        eventType: 'focus_time',
        isAiGenerated: true,
        aiConfidence: 0.92,
      },
    ];

    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

/**
 * POST /api/calendar/events
 * Create a new calendar event
 */
router.post('/events', requireAuth, async (req, res) => {
  try {
    const eventData = req.body;
    const { tenantId } = req.user;
    const userId = req.user.id;

    // Validate required fields
    if (!eventData.title || !eventData.startTime || !eventData.endTime) {
      return res.status(400).json({ error: 'Title, start time, and end time are required' });
    }

    // Mock event creation
    const event = {
      id: `event-${Date.now()}`,
      ...eventData,
      userId,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    res.json(event);
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

/**
 * PUT /api/calendar/events/:eventId
 * Update a calendar event
 */
router.put('/events/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;
    const eventData = req.body;

    // Mock event update
    const updatedEvent = {
      id: eventId,
      ...eventData,
      updatedAt: new Date(),
    };

    res.json(updatedEvent);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

/**
 * DELETE /api/calendar/events/:eventId
 * Delete a calendar event
 */
router.delete('/events/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Mock event deletion
    res.json({ success: true, deletedEventId: eventId });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

/**
 * GET /api/calendar/availability/:userId
 * Get user availability for scheduling
 */
router.get('/availability/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;
    const { tenantId } = req.user;

    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end times are required' });
    }

    const availability = await CalendarService.getUserAvailability(
      tenantId,
      userId,
      new Date(start as string),
      new Date(end as string)
    );

    res.json(availability);
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

/**
 * POST /api/calendar/find-meeting-time
 * Find optimal meeting time for multiple attendees
 */
router.post('/find-meeting-time', requireAuth, async (req, res) => {
  try {
    const { attendeeIds, duration, preferredStart, preferredEnd } = req.body;
    const { tenantId } = req.user;

    if (!attendeeIds || !duration || !preferredStart || !preferredEnd) {
      return res.status(400).json({ 
        error: 'Attendee IDs, duration, preferred start, and preferred end are required' 
      });
    }

    const suggestions = await CalendarService.findOptimalMeetingTime(
      tenantId,
      attendeeIds,
      duration,
      new Date(preferredStart),
      new Date(preferredEnd)
    );

    res.json({ suggestions });
  } catch (error) {
    console.error('Error finding meeting time:', error);
    res.status(500).json({ error: 'Failed to find meeting time' });
  }
});

export default router;
