/**
 * Meeting Scheduling Routes
 * API endpoints for intelligent meeting coordination and scheduling
 */

import express from 'express';
import { z } from 'zod';
import MeetingSchedulingService from '../services/meeting-scheduling-service';
import { createModuleLogger } from '../lib/logger';
import { getTenantId, getUserId } from '../utils/auth-helpers';
const log = createModuleLogger('meeting-scheduling-routes');

// CR-008: whitelist the scheduling-request body (tenantId/requesterId injected).
const createSchedulingRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  meetingTypeId: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive(),
  earliestStartTime: z.coerce.date().optional(),
  latestEndTime: z.coerce.date().optional(),
  preferredTimeSlots: z
    .array(z.object({ start: z.coerce.date(), end: z.coerce.date() }))
    .optional()
    .default([]),
  requiredParticipants: z.array(z.string()).optional().default([]),
  optionalParticipants: z.array(z.string()).optional().default([]),
  deadline: z.coerce.date().optional(),
});

const router = express.Router();

/**
 * POST /api/meetings/schedule-request
 * Create an intelligent scheduling request
 */
router.post('/schedule-request', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

    const parsed = createSchedulingRequestSchema.parse(req.body ?? {});
    const requestData = {
      ...parsed,
      tenantId,
      requesterId: getUserId(req),
    };

    const result = await MeetingSchedulingService.createSchedulingRequest(requestData);
    res.status(201).json(result);
  } catch (error) {
    log.error('Error creating scheduling request:', error);
    res.status(500).json({ error: 'Failed to create scheduling request' });
  }
});

/**
 * POST /api/meetings/schedule/:requestId
 * Schedule a meeting from a scheduling request
 */
router.post('/schedule/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { selectedSuggestion, roomId } = req.body;

    if (!selectedSuggestion) {
      return res.status(400).json({ error: 'Selected suggestion is required' });
    }

    const meeting = await MeetingSchedulingService.scheduleMeeting(
      requestId,
      selectedSuggestion,
      roomId,
    );

    res.json(meeting);
  } catch (error) {
    log.error('Error scheduling meeting:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

/**
 * The four read endpoints below have no implementation, and say so.
 *
 * They used to answer with hardcoded data: GET /meetings returned a "Q4 Planning
 * Session" organised by John Smith with Sarah Johnson and Mike Chen as
 * participants, each carrying an aiAttendanceProbability and an
 * aiEngagementScore; /meetings/:id returned the same meeting whatever id was
 * asked for; /types returned four invented meeting types and /rooms four
 * invented rooms with capacities and equipment lists. None of them touched
 * MeetingSchedulingService or the database.
 *
 * WHERE THE PREVIOUS CLEANUP LANDED. AUDIT-021 removed the invented fatigue risk
 * and flexibility score from meeting-scheduling-service.ts and locked it with
 * server/tests/unit/random-metrics-retired.test.ts. That service is real and
 * db-backed, and the four OTHER handlers in this router - schedule-request,
 * schedule/:requestId, analytics and optimize-schedule - genuinely call it. The
 * fabrication was one layer above, in the reads, which never called the service
 * at all, so the fix went in under the defect.
 *
 * 501, not an empty array: there is no listing code here to degrade from, and no
 * caller in any of the eight client trees to break - the only /api/meetings
 * traffic is /calendar/*, which the proxy sends to supabase/functions/meetings/.
 * An empty 200 would say "you have no meetings", which is a different claim.
 * MEETINGS-READS-001 is the story that implements them.
 */
function notImplemented(res: express.Response, what: string) {
  return res.status(501).json({
    message: `${what} is not implemented.`,
    code: 'NOT_IMPLEMENTED',
    detail: 'This endpoint previously returned hardcoded sample data. See MEETINGS-READS-001.',
  });
}

/**
 * GET /api/meetings
 * Not implemented - see the note above.
 */
router.get('/meetings', async (_req, res) => notImplemented(res, 'Listing meetings'));

/**
 * GET /api/meetings/:meetingId
 * Not implemented - see the note above.
 */
router.get('/meetings/:meetingId', async (_req, res) => notImplemented(res, 'Fetching a meeting'));

/**
 * GET /api/meetings/types
 * Not implemented - see the note above.
 */
router.get('/types', async (_req, res) => notImplemented(res, 'Listing meeting types'));

/**
 * GET /api/meetings/rooms
 * Not implemented - see the note above.
 */
router.get('/rooms', async (_req, res) => notImplemented(res, 'Listing meeting rooms'));

/**
 * GET /api/meetings/analytics
 * Real: reads through MeetingSchedulingService.
 */
router.get('/analytics', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

    const analytics = await MeetingSchedulingService.getMeetingAnalytics(tenantId, {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date(),
    });

    res.json(analytics);
  } catch (error) {
    log.error('Error fetching meeting analytics:', error);
    res.status(500).json({ error: 'Failed to fetch meeting analytics' });
  }
});

/**
 * POST /api/meetings/optimize-schedule
 * Optimize existing meeting schedule
 */
router.post('/optimize-schedule', async (req, res) => {
  try {
    const {
      timeRange = {
        start: new Date(),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      optimizationGoals = {
        minimizeMeetingFatigue: 0.8,
        maximizeProductivity: 0.9,
        improveAttendance: 0.7,
        optimizeRoomUsage: 0.6,
      },
    } = req.body;

    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

    const optimization = await MeetingSchedulingService.optimizeExistingSchedule(
      tenantId,
      timeRange,
      optimizationGoals,
    );

    res.json(optimization);
  } catch (error) {
    log.error('Error optimizing schedule:', error);
    res.status(500).json({ error: 'Failed to optimize schedule' });
  }
});

export default router;
