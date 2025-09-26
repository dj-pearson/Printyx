/**
 * Meeting Scheduling Routes
 * API endpoints for intelligent meeting coordination and scheduling
 */

import express from 'express';
import MeetingSchedulingService from '../services/meeting-scheduling-service';

const router = express.Router();

// Mock authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'mock-user-id', tenantId: 'mock-tenant-id' };
  next();
};

/**
 * POST /api/meetings/schedule-request
 * Create an intelligent scheduling request
 */
router.post('/schedule-request', requireAuth, async (req, res) => {
  try {
    const requestData = {
      ...req.body,
      tenantId: req.user.tenantId,
      requesterId: req.user.id
    };

    const result = await MeetingSchedulingService.createSchedulingRequest(requestData);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating scheduling request:', error);
    res.status(500).json({ error: 'Failed to create scheduling request' });
  }
});

/**
 * POST /api/meetings/schedule/:requestId
 * Schedule a meeting from a scheduling request
 */
router.post('/schedule/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { selectedSuggestion, roomId } = req.body;

    if (!selectedSuggestion) {
      return res.status(400).json({ error: 'Selected suggestion is required' });
    }

    const meeting = await MeetingSchedulingService.scheduleMeeting(
      requestId,
      selectedSuggestion,
      roomId
    );

    res.json(meeting);
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

/**
 * GET /api/meetings
 * Get meetings for current tenant
 */
router.get('/meetings', requireAuth, async (req, res) => {
  try {
    const { 
      start, 
      end, 
      status, 
      participant, 
      room,
      type 
    } = req.query;

    // Mock meetings data
    const meetings = [
      {
        id: 'meeting-1',
        tenantId: req.user.tenantId,
        title: 'Q4 Planning Session',
        description: 'Strategic planning for Q4 initiatives and goals',
        startTime: new Date('2025-09-27T10:00:00Z'),
        endTime: new Date('2025-09-27T11:30:00Z'),
        timezone: 'America/New_York',
        status: 'scheduled',
        priority: 'high',
        location: 'Conference Room A',
        meetingUrl: 'https://meet.company.com/q4-planning',
        isRecurring: false,
        
        // AI insights
        aiSchedulingScore: 0.92,
        aiParticipantCompatibility: 0.88,
        aiOptimalDurationMinutes: 90,
        aiPreparationTimeMinutes: 15,
        
        // Organization
        organizerId: 'user-manager-1',
        organizerName: 'John Smith',
        meetingType: {
          id: 'type-planning',
          name: 'Project Planning',
          defaultDuration: 90
        },
        
        // Participants
        participants: [
          {
            id: 'part-1',
            userId: 'user-1',
            name: 'Sarah Johnson',
            role: 'presenter',
            invitationStatus: 'accepted',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.95,
            aiEngagementScore: 0.88
          },
          {
            id: 'part-2',
            userId: 'user-2',
            name: 'Mike Chen',
            role: 'attendee',
            invitationStatus: 'accepted',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.91,
            aiEngagementScore: 0.82
          },
          {
            id: 'part-3',
            userId: 'user-3',
            name: 'Lisa Wang',
            role: 'attendee',
            invitationStatus: 'tentative',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.75,
            aiEngagementScore: 0.79
          }
        ],
        
        // Room booking
        room: {
          id: 'room-1',
          name: 'Conference Room A',
          capacity: 12,
          equipment: ['projector', 'whiteboard', 'video_conf'],
          bookingConfirmed: true
        },
        
        // Agenda
        agenda: [
          { title: 'Q3 Review', duration: 20, presenter: 'Sarah Johnson' },
          { title: 'Q4 Goals', duration: 30, presenter: 'John Smith' },
          { title: 'Resource Planning', duration: 25, presenter: 'Mike Chen' },
          { title: 'Next Steps', duration: 15, presenter: 'John Smith' }
        ],
        
        createdAt: new Date('2025-09-20T14:30:00Z'),
        updatedAt: new Date('2025-09-25T09:15:00Z')
      },
      {
        id: 'meeting-2',
        tenantId: req.user.tenantId,
        title: 'Client Presentation - Global Manufacturing',
        description: 'Product demonstration and proposal presentation',
        startTime: new Date('2025-09-27T14:00:00Z'),
        endTime: new Date('2025-09-27T15:00:00Z'),
        timezone: 'America/New_York',
        status: 'scheduled',
        priority: 'asap',
        location: 'Conference Room A',
        meetingUrl: 'https://meet.company.com/client-demo',
        isRecurring: false,
        
        // AI insights
        aiSchedulingScore: 0.89,
        aiParticipantCompatibility: 0.92,
        aiOptimalDurationMinutes: 60,
        aiPreparationTimeMinutes: 30,
        
        // Organization
        organizerId: 'user-sales-1',
        organizerName: 'Sarah Johnson',
        meetingType: {
          id: 'type-client',
          name: 'Client Presentation',
          defaultDuration: 60
        },
        
        // Participants
        participants: [
          {
            id: 'part-4',
            userId: 'user-1',
            name: 'Sarah Johnson',
            role: 'presenter',
            invitationStatus: 'accepted',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.98,
            aiEngagementScore: 0.95
          },
          {
            id: 'part-5',
            userId: 'user-2',
            name: 'Mike Chen',
            role: 'attendee',
            invitationStatus: 'accepted',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.94,
            aiEngagementScore: 0.87
          },
          {
            id: 'part-6',
            userId: 'external-client-1',
            name: 'David Thompson (Client)',
            role: 'attendee',
            invitationStatus: 'accepted',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.85,
            aiEngagementScore: 0.90
          }
        ],
        
        // Room booking
        room: {
          id: 'room-1',
          name: 'Conference Room A',
          capacity: 12,
          equipment: ['projector', 'whiteboard', 'video_conf'],
          bookingConfirmed: true
        },
        
        // Agenda
        agenda: [
          { title: 'Introductions', duration: 5, presenter: 'Sarah Johnson' },
          { title: 'Company Overview', duration: 10, presenter: 'Sarah Johnson' },
          { title: 'Product Demonstration', duration: 25, presenter: 'Mike Chen' },
          { title: 'Proposal Discussion', duration: 15, presenter: 'Sarah Johnson' },
          { title: 'Q&A and Next Steps', duration: 5, presenter: 'Sarah Johnson' }
        ],
        
        createdAt: new Date('2025-09-22T11:20:00Z'),
        updatedAt: new Date('2025-09-25T16:45:00Z')
      },
      {
        id: 'meeting-3',
        tenantId: req.user.tenantId,
        title: 'Daily Team Standup',
        description: 'Daily synchronization and progress update',
        startTime: new Date('2025-09-27T09:00:00Z'),
        endTime: new Date('2025-09-27T09:15:00Z'),
        timezone: 'America/New_York',
        status: 'scheduled',
        priority: 'medium',
        location: 'Huddle Room 1',
        meetingUrl: 'https://meet.company.com/daily-standup',
        isRecurring: true,
        recurrencePattern: {
          frequency: 'daily',
          interval: 1,
          daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        },
        
        // AI insights
        aiSchedulingScore: 0.96,
        aiParticipantCompatibility: 0.94,
        aiOptimalDurationMinutes: 15,
        aiPreparationTimeMinutes: 0,
        
        // Organization
        organizerId: 'user-manager-2',
        organizerName: 'Alex Rodriguez',
        meetingType: {
          id: 'type-standup',
          name: 'Team Standup',
          defaultDuration: 15
        },
        
        // Participants
        participants: [
          {
            id: 'part-7',
            userId: 'user-1',
            name: 'Sarah Johnson',
            role: 'attendee',
            invitationStatus: 'accepted',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.92,
            aiEngagementScore: 0.85
          },
          {
            id: 'part-8',
            userId: 'user-2',
            name: 'Mike Chen',
            role: 'attendee',
            invitationStatus: 'accepted',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.89,
            aiEngagementScore: 0.83
          },
          {
            id: 'part-9',
            userId: 'user-3',
            name: 'Lisa Wang',
            role: 'attendee',
            invitationStatus: 'accepted',
            attendanceStatus: 'unknown',
            aiAttendanceProbability: 0.94,
            aiEngagementScore: 0.88
          }
        ],
        
        // Room booking
        room: {
          id: 'room-2',
          name: 'Huddle Room 1',
          capacity: 4,
          equipment: ['tv_display', 'conference_phone'],
          bookingConfirmed: true
        },
        
        // Agenda
        agenda: [
          { title: 'Yesterday\'s Progress', duration: 5, presenter: 'Team' },
          { title: 'Today\'s Plans', duration: 5, presenter: 'Team' },
          { title: 'Blockers & Help Needed', duration: 5, presenter: 'Team' }
        ],
        
        createdAt: new Date('2025-09-01T10:00:00Z'),
        updatedAt: new Date('2025-09-25T08:30:00Z')
      }
    ];

    // Apply filters
    let filteredMeetings = meetings;
    
    if (status) {
      filteredMeetings = filteredMeetings.filter(m => m.status === status);
    }
    
    if (start || end) {
      const startDate = start ? new Date(start as string) : new Date(0);
      const endDate = end ? new Date(end as string) : new Date('2030-01-01');
      filteredMeetings = filteredMeetings.filter(m => 
        m.startTime >= startDate && m.startTime <= endDate
      );
    }
    
    if (participant) {
      filteredMeetings = filteredMeetings.filter(m => 
        m.participants.some(p => p.userId === participant)
      );
    }
    
    if (room) {
      filteredMeetings = filteredMeetings.filter(m => m.room?.id === room);
    }

    res.json(filteredMeetings);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

/**
 * GET /api/meetings/:meetingId
 * Get meeting details
 */
router.get('/meetings/:meetingId', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    // Mock detailed meeting data
    const meeting = {
      id: meetingId,
      tenantId: req.user.tenantId,
      title: 'Q4 Planning Session',
      description: 'Strategic planning session for Q4 initiatives, goals, and resource allocation',
      startTime: new Date('2025-09-27T10:00:00Z'),
      endTime: new Date('2025-09-27T11:30:00Z'),
      timezone: 'America/New_York',
      status: 'scheduled',
      priority: 'high',
      location: 'Conference Room A',
      meetingUrl: 'https://meet.company.com/q4-planning',
      isRecurring: false,
      
      // AI optimization insights
      aiSchedulingScore: 0.92,
      aiParticipantCompatibility: 0.88,
      aiOptimalDurationMinutes: 90,
      aiPreparationTimeMinutes: 15,
      aiFollowUpRequired: true,
      
      // Scheduling context
      schedulingFactors: {
        participantProductivity: 0.91,
        meetingFatigue: 0.15,
        travelTime: 0.95,
        businessPriority: 0.93
      },
      
      conflictResolutions: [
        {
          type: 'participant_conflict',
          description: 'Resolved scheduling conflict for Lisa Wang',
          resolution: 'Moved meeting 30 minutes later to accommodate previous commitment',
          impact: 'low'
        }
      ],
      
      // Organization details
      organizerId: 'user-manager-1',
      organizerName: 'John Smith',
      createdBy: 'user-manager-1',
      meetingType: {
        id: 'type-planning',
        name: 'Project Planning',
        description: 'Strategic planning and coordination session',
        defaultDuration: 90,
        bufferTime: 15,
        aiSchedulingPriority: 7
      },
      
      // Detailed participants
      participants: [
        {
          id: 'part-1',
          userId: 'user-1',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@company.com',
          role: 'presenter',
          invitationStatus: 'accepted',
          attendanceStatus: 'unknown',
          respondedAt: new Date('2025-09-20T15:30:00Z'),
          
          // AI insights
          aiAttendanceProbability: 0.95,
          aiEngagementScore: 0.88,
          aiContributionValue: 0.92,
          aiSchedulingFlexibility: 0.78,
          
          // Preferences for this meeting
          availabilityPreference: 'flexible',
          preferredTimeSlots: [],
          responseNotes: 'Looking forward to discussing Q4 strategy'
        },
        {
          id: 'part-2',
          userId: 'user-2',
          name: 'Mike Chen',
          email: 'mike.chen@company.com',
          role: 'attendee',
          invitationStatus: 'accepted',
          attendanceStatus: 'unknown',
          respondedAt: new Date('2025-09-20T16:45:00Z'),
          
          // AI insights
          aiAttendanceProbability: 0.91,
          aiEngagementScore: 0.82,
          aiContributionValue: 0.85,
          aiSchedulingFlexibility: 0.65,
          
          availabilityPreference: 'preferred',
          preferredTimeSlots: [
            { start: '10:00', end: '12:00' },
            { start: '14:00', end: '16:00' }
          ]
        },
        {
          id: 'part-3',
          userId: 'user-3',
          name: 'Lisa Wang',
          email: 'lisa.wang@company.com',
          role: 'attendee',
          invitationStatus: 'tentative',
          attendanceStatus: 'unknown',
          respondedAt: new Date('2025-09-21T09:20:00Z'),
          
          // AI insights
          aiAttendanceProbability: 0.75,
          aiEngagementScore: 0.79,
          aiContributionValue: 0.88,
          aiSchedulingFlexibility: 0.45,
          
          availabilityPreference: 'required',
          blackoutTimes: [
            { start: '2025-09-27T09:30:00Z', end: '2025-09-27T10:30:00Z' }
          ],
          responseNotes: 'Have a conflict until 10:30, but can join after that'
        }
      ],
      
      // Room details
      room: {
        id: 'room-1',
        name: 'Conference Room A',
        description: 'Large conference room with video conferencing',
        location: 'Floor 1, East Wing',
        capacity: 12,
        equipment: ['projector', 'whiteboard', 'conference_phone', 'video_camera'],
        features: ['video_conf', 'screen_sharing', 'wireless_presentation'],
        bookingConfirmed: true,
        setupTime: 10, // minutes
        cleanupTime: 5,
        specialRequirements: 'Whiteboard setup for brainstorming session'
      },
      
      // Detailed agenda
      agenda: [
        {
          id: 'agenda-1',
          title: 'Q3 Performance Review',
          description: 'Review Q3 achievements and metrics',
          duration: 20,
          presenter: 'Sarah Johnson',
          materials: ['Q3 Performance Report', 'Metrics Dashboard'],
          objectives: ['Assess Q3 performance', 'Identify key learnings']
        },
        {
          id: 'agenda-2',
          title: 'Q4 Strategic Goals',
          description: 'Define and align on Q4 strategic objectives',
          duration: 30,
          presenter: 'John Smith',
          materials: ['Q4 Strategy Document', 'Market Analysis'],
          objectives: ['Set Q4 priorities', 'Align team on objectives']
        },
        {
          id: 'agenda-3',
          title: 'Resource Planning & Allocation',
          description: 'Plan resource allocation for Q4 initiatives',
          duration: 25,
          presenter: 'Mike Chen',
          materials: ['Resource Capacity Report', 'Budget Overview'],
          objectives: ['Allocate resources', 'Identify hiring needs']
        },
        {
          id: 'agenda-4',
          title: 'Action Items & Next Steps',
          description: 'Define action items and follow-up plan',
          duration: 15,
          presenter: 'John Smith',
          objectives: ['Assign action items', 'Set follow-up schedule']
        }
      ],
      
      // Attachments and materials
      attachments: [
        {
          id: 'att-1',
          name: 'Q3 Performance Report.pdf',
          size: '2.4 MB',
          uploadedBy: 'Sarah Johnson',
          uploadedAt: new Date('2025-09-25T14:20:00Z')
        },
        {
          id: 'att-2',
          name: 'Q4 Strategy Draft.docx',
          size: '1.8 MB',
          uploadedBy: 'John Smith',
          uploadedAt: new Date('2025-09-24T11:15:00Z')
        }
      ],
      
      // Meeting preparation
      preparation: {
        aiSuggestedPrepTime: 15,
        preparationTasks: [
          'Review Q3 performance metrics',
          'Read Q4 strategy document',
          'Prepare resource allocation questions',
          'Bring ideas for Q4 initiatives'
        ],
        requiredReading: [
          'Q3 Performance Report',
          'Q4 Strategy Draft'
        ]
      },
      
      // Analytics and insights
      analytics: {
        invitationsSent: 3,
        acceptanceRate: 0.67, // 2 accepted, 1 tentative
        expectedAttendance: 0.87,
        roomUtilization: 0.25, // 3 people in 12-person room
        costEstimate: {
          participantTime: 270, // 3 people * 90 minutes
          roomCost: 45, // $0.50/minute * 90 minutes
          totalCost: 315
        }
      },
      
      createdAt: new Date('2025-09-20T14:30:00Z'),
      updatedAt: new Date('2025-09-25T09:15:00Z')
    };

    res.json(meeting);
  } catch (error) {
    console.error('Error fetching meeting details:', error);
    res.status(500).json({ error: 'Failed to fetch meeting details' });
  }
});

/**
 * GET /api/meetings/types
 * Get available meeting types
 */
router.get('/types', requireAuth, async (req, res) => {
  try {
    // Mock meeting types
    const meetingTypes = [
      {
        id: 'type-standup',
        name: 'Team Standup',
        description: 'Daily team synchronization meeting',
        defaultDurationMinutes: 15,
        bufferTimeMinutes: 5,
        maxParticipants: 8,
        requiresRoom: false,
        requiredEquipment: [],
        aiSchedulingPriority: 8,
        aiOptimalTimeSlots: [
          { start: '09:00', end: '09:30' },
          { start: '17:00', end: '17:30' }
        ],
        usageCount: 156,
        averageDuration: 12,
        satisfactionScore: 4.2
      },
      {
        id: 'type-client',
        name: 'Client Presentation',
        description: 'Client-facing presentation and demo',
        defaultDurationMinutes: 60,
        bufferTimeMinutes: 15,
        maxParticipants: 12,
        requiresRoom: true,
        requiredEquipment: ['projector', 'video_conf'],
        aiSchedulingPriority: 9,
        aiOptimalTimeSlots: [
          { start: '10:00', end: '12:00' },
          { start: '14:00', end: '16:00' }
        ],
        usageCount: 89,
        averageDuration: 58,
        satisfactionScore: 4.6
      },
      {
        id: 'type-planning',
        name: 'Project Planning',
        description: 'Project planning and strategy session',
        defaultDurationMinutes: 90,
        bufferTimeMinutes: 15,
        maxParticipants: 6,
        requiresRoom: true,
        requiredEquipment: ['whiteboard'],
        aiSchedulingPriority: 7,
        aiOptimalTimeSlots: [
          { start: '10:00', end: '12:00' },
          { start: '13:00', end: '15:00' }
        ],
        usageCount: 67,
        averageDuration: 85,
        satisfactionScore: 4.1
      },
      {
        id: 'type-sales',
        name: 'Sales Call',
        description: 'Sales prospect or client call',
        defaultDurationMinutes: 30,
        bufferTimeMinutes: 10,
        maxParticipants: 4,
        requiresRoom: false,
        requiredEquipment: [],
        aiSchedulingPriority: 9,
        aiOptimalTimeSlots: [
          { start: '10:00', end: '12:00' },
          { start: '14:00', end: '17:00' }
        ],
        usageCount: 234,
        averageDuration: 28,
        satisfactionScore: 4.4
      },
      {
        id: 'type-training',
        name: 'Training Session',
        description: 'Team training and knowledge sharing',
        defaultDurationMinutes: 120,
        bufferTimeMinutes: 15,
        maxParticipants: 15,
        requiresRoom: true,
        requiredEquipment: ['projector', 'sound_system'],
        aiSchedulingPriority: 6,
        aiOptimalTimeSlots: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '16:00' }
        ],
        usageCount: 45,
        averageDuration: 115,
        satisfactionScore: 4.3
      }
    ];

    res.json(meetingTypes);
  } catch (error) {
    console.error('Error fetching meeting types:', error);
    res.status(500).json({ error: 'Failed to fetch meeting types' });
  }
});

/**
 * GET /api/meetings/rooms
 * Get available meeting rooms
 */
router.get('/rooms', requireAuth, async (req, res) => {
  try {
    const { capacity, equipment, features, available_at } = req.query;
    
    // Mock meeting rooms
    const rooms = [
      {
        id: 'room-1',
        name: 'Conference Room A',
        description: 'Large conference room with video conferencing',
        location: 'Floor 1, East Wing',
        capacity: 12,
        equipment: ['projector', 'whiteboard', 'conference_phone', 'video_camera'],
        features: ['video_conf', 'screen_sharing', 'wireless_presentation'],
        accessibilityFeatures: ['wheelchair_accessible', 'hearing_loop'],
        isBookable: true,
        operatingHours: {
          monday: { start: '08:00', end: '18:00' },
          tuesday: { start: '08:00', end: '18:00' },
          wednesday: { start: '08:00', end: '18:00' },
          thursday: { start: '08:00', end: '18:00' },
          friday: { start: '08:00', end: '18:00' }
        },
        
        // AI insights
        aiUsagePatterns: {
          peakHours: ['10:00-12:00', '14:00-16:00'],
          popularMeetingTypes: ['client_presentation', 'project_planning'],
          averageBookingDuration: 75
        },
        aiPopularityScore: 0.85,
        aiOptimalMeetingTypes: ['client_presentation', 'all_hands', 'training'],
        
        // Booking stats
        utilizationRate: 0.68,
        bookingsThisWeek: 15,
        averageRating: 4.3,
        
        // Availability (mock - would be real-time)
        isAvailable: true,
        nextAvailableSlot: new Date('2025-09-27T15:30:00Z'),
        
        isActive: true
      },
      {
        id: 'room-2',
        name: 'Conference Room B',
        description: 'Medium conference room for team meetings',
        location: 'Floor 1, West Wing',
        capacity: 8,
        equipment: ['tv_display', 'whiteboard', 'conference_phone'],
        features: ['video_conf', 'wireless_presentation'],
        accessibilityFeatures: ['wheelchair_accessible'],
        isBookable: true,
        operatingHours: {
          monday: { start: '08:00', end: '18:00' },
          tuesday: { start: '08:00', end: '18:00' },
          wednesday: { start: '08:00', end: '18:00' },
          thursday: { start: '08:00', end: '18:00' },
          friday: { start: '08:00', end: '18:00' }
        },
        
        // AI insights
        aiUsagePatterns: {
          peakHours: ['09:00-11:00', '15:00-17:00'],
          popularMeetingTypes: ['team_meeting', 'project_planning'],
          averageBookingDuration: 60
        },
        aiPopularityScore: 0.72,
        aiOptimalMeetingTypes: ['team_meeting', 'project_planning', 'training'],
        
        // Booking stats
        utilizationRate: 0.71,
        bookingsThisWeek: 18,
        averageRating: 4.1,
        
        // Availability (mock)
        isAvailable: false,
        nextAvailableSlot: new Date('2025-09-27T16:00:00Z'),
        currentBooking: {
          title: 'Sprint Planning',
          endTime: new Date('2025-09-27T15:30:00Z')
        },
        
        isActive: true
      },
      {
        id: 'room-3',
        name: 'Huddle Room 1',
        description: 'Small room for quick meetings and calls',
        location: 'Floor 2, North',
        capacity: 4,
        equipment: ['tv_display', 'conference_phone'],
        features: ['video_conf'],
        accessibilityFeatures: [],
        isBookable: true,
        operatingHours: {
          monday: { start: '08:00', end: '18:00' },
          tuesday: { start: '08:00', end: '18:00' },
          wednesday: { start: '08:00', end: '18:00' },
          thursday: { start: '08:00', end: '18:00' },
          friday: { start: '08:00', end: '18:00' }
        },
        
        // AI insights
        aiUsagePatterns: {
          peakHours: ['11:00-12:00', '16:00-17:00'],
          popularMeetingTypes: ['one_on_one', 'sales_call'],
          averageBookingDuration: 30
        },
        aiPopularityScore: 0.64,
        aiOptimalMeetingTypes: ['one_on_one', 'sales_call', 'quick_sync'],
        
        // Booking stats
        utilizationRate: 0.58,
        bookingsThisWeek: 22,
        averageRating: 4.0,
        
        // Availability (mock)
        isAvailable: true,
        nextAvailableSlot: new Date('2025-09-27T14:00:00Z'),
        
        isActive: true
      }
    ];

    // Apply filters
    let filteredRooms = rooms;
    
    if (capacity) {
      const minCapacity = parseInt(capacity as string);
      filteredRooms = filteredRooms.filter(room => room.capacity >= minCapacity);
    }
    
    if (equipment) {
      const requiredEquipment = Array.isArray(equipment) ? equipment : [equipment];
      filteredRooms = filteredRooms.filter(room => 
        requiredEquipment.every((eq: string) => room.equipment.includes(eq))
      );
    }
    
    if (features) {
      const requiredFeatures = Array.isArray(features) ? features : [features];
      filteredRooms = filteredRooms.filter(room => 
        requiredFeatures.every((feat: string) => room.features.includes(feat))
      );
    }

    res.json(filteredRooms);
  } catch (error) {
    console.error('Error fetching meeting rooms:', error);
    res.status(500).json({ error: 'Failed to fetch meeting rooms' });
  }
});

/**
 * GET /api/meetings/analytics
 * Get meeting analytics and insights
 */
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    
    const analytics = await MeetingSchedulingService.getMeetingAnalytics(
      req.user.tenantId,
      {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      }
    );

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching meeting analytics:', error);
    res.status(500).json({ error: 'Failed to fetch meeting analytics' });
  }
});

/**
 * POST /api/meetings/optimize-schedule
 * Optimize existing meeting schedule
 */
router.post('/optimize-schedule', requireAuth, async (req, res) => {
  try {
    const { 
      timeRange = { 
        start: new Date(), 
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
      },
      optimizationGoals = {
        minimizeMeetingFatigue: 0.8,
        maximizeProductivity: 0.9,
        improveAttendance: 0.7,
        optimizeRoomUsage: 0.6
      }
    } = req.body;

    const optimization = await MeetingSchedulingService.optimizeExistingSchedule(
      req.user.tenantId,
      timeRange,
      optimizationGoals
    );

    res.json(optimization);
  } catch (error) {
    console.error('Error optimizing schedule:', error);
    res.status(500).json({ error: 'Failed to optimize schedule' });
  }
});

export default router;
