/**
 * Meeting Scheduling Service
 * Intelligent meeting coordination, availability optimization, and automated scheduling
 */

import { db } from '../../db';
import ClaudeAIService from './claude-ai-service';
import AdvancedSchedulingService from './advanced-scheduling-service';
import TeamCollaborationService from './team-collaboration-service';
import { eq, and, sql, desc, asc, gte, lte } from 'drizzle-orm';

interface MeetingType {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  defaultDurationMinutes: number;
  bufferTimeMinutes: number;
  maxParticipants: number;
  requiresRoom: boolean;
  requiredEquipment: string[];
  aiSchedulingPriority: number; // 1-10
  aiOptimalTimeSlots: Array<{ start: string; end: string }>;
}

interface Meeting {
  id: string;
  tenantId: string;
  meetingTypeId?: string;
  projectId?: string;
  title: string;
  description?: string;
  location?: string;
  meetingUrl?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
  priority: 'asap' | 'high' | 'medium' | 'low';
  isRecurring: boolean;
  recurrencePattern?: Record<string, any>;
  aiSchedulingScore?: number;
  aiParticipantCompatibility?: number;
  aiOptimalDurationMinutes?: number;
  organizerId: string;
  agenda: Array<{ title: string; duration: number; presenter?: string }>;
  participants: MeetingParticipant[];
}

interface MeetingParticipant {
  id: string;
  meetingId: string;
  userId: string;
  role: 'organizer' | 'presenter' | 'attendee' | 'optional';
  invitationStatus: 'pending' | 'accepted' | 'declined' | 'tentative';
  attendanceStatus: 'attended' | 'absent' | 'late' | 'unknown';
  availabilityPreference: 'flexible' | 'preferred' | 'required';
  preferredTimeSlots: Array<{ start: Date; end: Date }>;
  blackoutTimes: Array<{ start: Date; end: Date }>;
  aiAttendanceProbability?: number;
  aiEngagementScore?: number;
  aiContributionValue?: number;
}

interface MeetingRoom {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  location?: string;
  capacity: number;
  equipment: string[];
  features: string[];
  isBookable: boolean;
  aiUsagePatterns: Record<string, any>;
  aiOptimalMeetingTypes: string[];
  aiPopularityScore?: number;
}

interface SchedulingRequest {
  id: string;
  tenantId: string;
  requesterId: string;
  title: string;
  description?: string;
  meetingTypeId?: string;
  durationMinutes: number;
  earliestStartTime?: Date;
  latestEndTime?: Date;
  preferredTimeSlots: Array<{ start: Date; end: Date }>;
  requiredParticipants: string[];
  optionalParticipants: string[];
  roomRequirements: Record<string, any>;
  priority: 'asap' | 'high' | 'medium' | 'low';
  deadline?: Date;
}

interface SchedulingSuggestion {
  startTime: Date;
  endTime: Date;
  confidence: number;
  participantAvailability: Record<string, number>;
  roomSuggestions: Array<{
    roomId: string;
    roomName: string;
    suitabilityScore: number;
    availabilityConfirmed: boolean;
  }>;
  conflictResolutions: Array<{
    type: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
  }>;
  optimizationFactors: {
    participantProductivity: number;
    travelTime: number;
    meetingFatigue: number;
    businessPriority: number;
  };
  reasoning: string;
}

interface AvailabilityWindow {
  start: Date;
  end: Date;
  userId?: string;
  confidence: number; // 0.0-1.0, how confident we are in this availability
  type: 'free' | 'busy' | 'tentative' | 'out_of_office';
  context?: string; // What's happening during busy times
}

class MeetingSchedulingService {
  /**
   * Create an intelligent scheduling request with AI optimization
   */
  async createSchedulingRequest(requestData: Partial<SchedulingRequest>): Promise<{
    requestId: string;
    suggestions: SchedulingSuggestion[];
    processingStatus: string;
  }> {
    console.log('📅 Creating intelligent scheduling request:', requestData.title);
    
    try {
      // Create the scheduling request
      const request: SchedulingRequest = {
        id: `req-${Date.now()}`,
        tenantId: requestData.tenantId || 'mock-tenant',
        requesterId: requestData.requesterId || 'mock-user',
        title: requestData.title || 'New Meeting',
        description: requestData.description,
        meetingTypeId: requestData.meetingTypeId,
        durationMinutes: requestData.durationMinutes || 30,
        earliestStartTime: requestData.earliestStartTime,
        latestEndTime: requestData.latestEndTime,
        preferredTimeSlots: requestData.preferredTimeSlots || [],
        requiredParticipants: requestData.requiredParticipants || [],
        optionalParticipants: requestData.optionalParticipants || [],
        roomRequirements: requestData.roomRequirements || {},
        priority: requestData.priority || 'medium',
        deadline: requestData.deadline
      };

      // Generate AI-optimized scheduling suggestions
      const suggestions = await this.generateSchedulingSuggestions(request);

      console.log(`✅ Generated ${suggestions.length} scheduling suggestions`);
      return {
        requestId: request.id,
        suggestions,
        processingStatus: 'completed'
      };
    } catch (error) {
      console.error('Failed to create scheduling request:', error);
      throw error;
    }
  }

  /**
   * Generate AI-optimized scheduling suggestions
   */
  private async generateSchedulingSuggestions(request: SchedulingRequest): Promise<SchedulingSuggestion[]> {
    console.log('🧠 Generating AI-optimized scheduling suggestions...');
    
    try {
      // Get participant availability
      const participantAvailability = await this.analyzeParticipantAvailability(
        request.requiredParticipants,
        request.optionalParticipants,
        request.earliestStartTime,
        request.latestEndTime
      );

      // Get room availability if needed
      const roomSuggestions = await this.findOptimalRooms(request);

      // Use AI to optimize scheduling
      const aiPrompt = `Optimize meeting scheduling with these constraints:

Meeting: "${request.title}"
Duration: ${request.durationMinutes} minutes
Priority: ${request.priority}
Required Participants: ${request.requiredParticipants.length}
Optional Participants: ${request.optionalParticipants.length}

Participant Availability Summary:
${Object.entries(participantAvailability.summary).map(([userId, data]) => 
  `- ${userId}: ${(data as any).availableSlots} available slots, best productivity: ${(data as any).bestProductivityHours.join(', ')}`
).join('\n')}

Room Requirements: ${JSON.stringify(request.roomRequirements)}
Available Rooms: ${roomSuggestions.length}

Time Constraints:
- Earliest: ${request.earliestStartTime?.toISOString() || 'No limit'}
- Latest: ${request.latestEndTime?.toISOString() || 'No limit'}
- Preferred slots: ${request.preferredTimeSlots.length}

Generate 3-5 optimal meeting time suggestions considering:
1. Participant availability and productivity peaks
2. Meeting fatigue and scheduling density
3. Travel time between meetings
4. Business priority and urgency
5. Room availability and suitability

Return JSON with suggestions:
{
  "suggestions": [
    {
      "startTime": "2025-09-27T10:00:00Z",
      "endTime": "2025-09-27T10:30:00Z",
      "confidence": 0.92,
      "participantAvailability": {"user1": 0.95, "user2": 0.88},
      "optimizationFactors": {
        "participantProductivity": 0.9,
        "travelTime": 0.8,
        "meetingFatigue": 0.85,
        "businessPriority": 0.9
      },
      "reasoning": "Optimal time during productivity peak with minimal conflicts"
    }
  ]
}`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: aiPrompt }],
        temperature: 0.3,
        max_tokens: 2000
      });

      const aiSuggestions = JSON.parse(aiResponse);
      
      // Enhance suggestions with room data and conflict resolution
      const enhancedSuggestions: SchedulingSuggestion[] = [];
      
      for (const suggestion of aiSuggestions.suggestions) {
        const startTime = new Date(suggestion.startTime);
        const endTime = new Date(suggestion.endTime);
        
        // Find best room for this time slot
        const timeSlotRooms = await this.findRoomsForTimeSlot(startTime, endTime, request.roomRequirements);
        
        // Analyze potential conflicts
        const conflicts = await this.analyzeSchedulingConflicts(
          startTime,
          endTime,
          request.requiredParticipants
        );

        enhancedSuggestions.push({
          startTime,
          endTime,
          confidence: suggestion.confidence,
          participantAvailability: suggestion.participantAvailability,
          roomSuggestions: timeSlotRooms,
          conflictResolutions: conflicts,
          optimizationFactors: suggestion.optimizationFactors,
          reasoning: suggestion.reasoning
        });
      }

      return enhancedSuggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('AI scheduling suggestion failed:', error);
      return this.generateFallbackSuggestions(request);
    }
  }

  /**
   * Analyze participant availability across time ranges
   */
  private async analyzeParticipantAvailability(
    requiredParticipants: string[],
    optionalParticipants: string[],
    startRange?: Date,
    endRange?: Date
  ): Promise<{
    windows: AvailabilityWindow[];
    summary: Record<string, any>;
    conflicts: Array<{ userId: string; conflict: string; severity: string }>;
  }> {
    console.log('📊 Analyzing participant availability...');
    
    const allParticipants = [...requiredParticipants, ...optionalParticipants];
    const windows: AvailabilityWindow[] = [];
    const summary: Record<string, any> = {};
    const conflicts: Array<{ userId: string; conflict: string; severity: string }> = [];

    // Mock availability analysis - in production, this would query actual calendars
    for (const userId of allParticipants) {
      const userAvailability = await this.getUserAvailability(userId, startRange, endRange);
      
      summary[userId] = {
        availableSlots: userAvailability.availableSlots.length,
        busySlots: userAvailability.busySlots.length,
        bestProductivityHours: userAvailability.bestProductivityHours,
        meetingFatigueRisk: userAvailability.meetingFatigueRisk,
        flexibility: userAvailability.flexibility
      };

      // Add availability windows
      windows.push(...userAvailability.availableSlots.map(slot => ({
        start: slot.start,
        end: slot.end,
        userId,
        confidence: slot.confidence,
        type: 'free' as const
      })));

      // Check for conflicts
      if (userAvailability.meetingFatigueRisk > 0.7) {
        conflicts.push({
          userId,
          conflict: 'High meeting fatigue risk',
          severity: 'medium'
        });
      }

      if (userAvailability.flexibility < 0.3) {
        conflicts.push({
          userId,
          conflict: 'Limited scheduling flexibility',
          severity: 'high'
        });
      }
    }

    return { windows, summary, conflicts };
  }

  /**
   * Get user availability data
   */
  private async getUserAvailability(
    userId: string,
    startRange?: Date,
    endRange?: Date
  ): Promise<{
    availableSlots: Array<{ start: Date; end: Date; confidence: number }>;
    busySlots: Array<{ start: Date; end: Date; context: string }>;
    bestProductivityHours: string[];
    meetingFatigueRisk: number;
    flexibility: number;
  }> {
    // Mock user availability - in production, this would integrate with calendar APIs
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return {
      availableSlots: [
        {
          start: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000), // 9 AM tomorrow
          end: new Date(tomorrow.getTime() + 12 * 60 * 60 * 1000), // 12 PM tomorrow
          confidence: 0.9
        },
        {
          start: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000), // 2 PM tomorrow
          end: new Date(tomorrow.getTime() + 17 * 60 * 60 * 1000), // 5 PM tomorrow
          confidence: 0.8
        }
      ],
      busySlots: [
        {
          start: new Date(tomorrow.getTime() + 13 * 60 * 60 * 1000), // 1 PM tomorrow
          end: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000), // 2 PM tomorrow
          context: 'Lunch break'
        }
      ],
      bestProductivityHours: ['9 AM', '10 AM', '2 PM', '3 PM'],
      meetingFatigueRisk: Math.random() * 0.5, // 0-50% fatigue risk
      flexibility: 0.7 + Math.random() * 0.3 // 70-100% flexibility
    };
  }

  /**
   * Find optimal rooms for meeting requirements
   */
  private async findOptimalRooms(request: SchedulingRequest): Promise<Array<{
    roomId: string;
    roomName: string;
    suitabilityScore: number;
    availabilityConfirmed: boolean;
  }>> {
    console.log('🏢 Finding optimal meeting rooms...');
    
    // Mock room data - in production, this would query the meeting_rooms table
    const availableRooms = [
      {
        roomId: 'room-1',
        roomName: 'Conference Room A',
        capacity: 12,
        equipment: ['projector', 'whiteboard', 'video_conf'],
        features: ['screen_sharing', 'wireless_presentation'],
        aiPopularityScore: 0.8
      },
      {
        roomId: 'room-2',
        roomName: 'Huddle Room 1',
        capacity: 4,
        equipment: ['tv_display', 'conference_phone'],
        features: ['video_conf'],
        aiPopularityScore: 0.6
      },
      {
        roomId: 'room-3',
        roomName: 'Training Room',
        capacity: 20,
        equipment: ['projector', 'sound_system', 'microphones'],
        features: ['video_conf', 'recording'],
        aiPopularityScore: 0.7
      }
    ];

    const participantCount = request.requiredParticipants.length + request.optionalParticipants.length;
    const roomSuggestions = [];

    for (const room of availableRooms) {
      // Calculate suitability score
      let suitabilityScore = 0.5; // Base score

      // Capacity match (prefer rooms 20-50% larger than needed)
      const capacityRatio = participantCount / room.capacity;
      if (capacityRatio <= 0.5) {
        suitabilityScore += 0.3; // Good capacity match
      } else if (capacityRatio <= 0.8) {
        suitabilityScore += 0.4; // Excellent capacity match
      } else if (capacityRatio <= 1.0) {
        suitabilityScore += 0.2; // Acceptable but tight
      } else {
        continue; // Room too small, skip
      }

      // Equipment match
      const requiredEquipment = request.roomRequirements.equipment || [];
      const equipmentMatch = requiredEquipment.filter((eq: string) => room.equipment.includes(eq)).length;
      const equipmentScore = requiredEquipment.length > 0 ? equipmentMatch / requiredEquipment.length : 0.5;
      suitabilityScore += equipmentScore * 0.2;

      // Popularity/quality score
      suitabilityScore += (room.aiPopularityScore || 0.5) * 0.1;

      roomSuggestions.push({
        roomId: room.roomId,
        roomName: room.roomName,
        suitabilityScore: Math.min(1.0, suitabilityScore),
        availabilityConfirmed: true // Mock - would check actual availability
      });
    }

    return roomSuggestions.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }

  /**
   * Find rooms available for specific time slot
   */
  private async findRoomsForTimeSlot(
    startTime: Date,
    endTime: Date,
    requirements: Record<string, any>
  ): Promise<Array<{
    roomId: string;
    roomName: string;
    suitabilityScore: number;
    availabilityConfirmed: boolean;
  }>> {
    // This would check actual room bookings and availability
    // For now, return mock data
    return [
      {
        roomId: 'room-1',
        roomName: 'Conference Room A',
        suitabilityScore: 0.9,
        availabilityConfirmed: true
      },
      {
        roomId: 'room-2',
        roomName: 'Huddle Room 1',
        suitabilityScore: 0.7,
        availabilityConfirmed: true
      }
    ];
  }

  /**
   * Analyze potential scheduling conflicts
   */
  private async analyzeSchedulingConflicts(
    startTime: Date,
    endTime: Date,
    participantIds: string[]
  ): Promise<Array<{
    type: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
  }>> {
    const conflicts = [];

    // Mock conflict analysis
    if (startTime.getHours() < 9 || startTime.getHours() > 17) {
      conflicts.push({
        type: 'outside_business_hours',
        description: 'Meeting scheduled outside standard business hours',
        impact: 'medium' as const
      });
    }

    if (startTime.getHours() >= 12 && startTime.getHours() <= 13) {
      conflicts.push({
        type: 'lunch_time_conflict',
        description: 'Meeting conflicts with typical lunch hours',
        impact: 'low' as const
      });
    }

    // Random conflict for demo
    if (Math.random() > 0.7) {
      conflicts.push({
        type: 'participant_conflict',
        description: 'One participant has a potential scheduling conflict',
        impact: 'medium' as const
      });
    }

    return conflicts;
  }

  /**
   * Generate fallback suggestions when AI fails
   */
  private generateFallbackSuggestions(request: SchedulingRequest): SchedulingSuggestion[] {
    console.log('⚠️ Generating fallback scheduling suggestions');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0); // 10 AM tomorrow

    return [
      {
        startTime: new Date(tomorrow),
        endTime: new Date(tomorrow.getTime() + request.durationMinutes * 60 * 1000),
        confidence: 0.6,
        participantAvailability: {},
        roomSuggestions: [],
        conflictResolutions: [],
        optimizationFactors: {
          participantProductivity: 0.7,
          travelTime: 0.8,
          meetingFatigue: 0.7,
          businessPriority: 0.6
        },
        reasoning: 'Fallback suggestion - standard business hours'
      }
    ];
  }

  /**
   * Schedule a meeting from a scheduling request
   */
  async scheduleMeeting(
    requestId: string,
    selectedSuggestion: SchedulingSuggestion,
    roomId?: string
  ): Promise<Meeting> {
    console.log('📅 Scheduling meeting from request:', requestId);
    
    try {
      // Mock meeting creation
      const meeting: Meeting = {
        id: `meeting-${Date.now()}`,
        tenantId: 'mock-tenant',
        title: 'Scheduled Meeting',
        startTime: selectedSuggestion.startTime,
        endTime: selectedSuggestion.endTime,
        timezone: 'UTC',
        status: 'scheduled',
        priority: 'medium',
        isRecurring: false,
        organizerId: 'mock-user',
        agenda: [],
        participants: []
      };

      // Send invitations to participants
      await this.sendMeetingInvitations(meeting);

      // Book room if specified
      if (roomId) {
        await this.bookMeetingRoom(meeting.id, roomId, selectedSuggestion.startTime, selectedSuggestion.endTime);
      }

      console.log('✅ Meeting scheduled successfully:', meeting.id);
      return meeting;
    } catch (error) {
      console.error('Failed to schedule meeting:', error);
      throw error;
    }
  }

  /**
   * Send meeting invitations to participants
   */
  private async sendMeetingInvitations(meeting: Meeting): Promise<void> {
    console.log('📧 Sending meeting invitations for:', meeting.title);
    // This would integrate with email/calendar systems to send invitations
  }

  /**
   * Book a meeting room
   */
  private async bookMeetingRoom(
    meetingId: string,
    roomId: string,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    console.log('🏢 Booking meeting room:', roomId);
    // This would create a room booking record
  }

  /**
   * Get meeting analytics and insights
   */
  async getMeetingAnalytics(tenantId: string, timeRange: { start: Date; end: Date }): Promise<{
    totalMeetings: number;
    totalMeetingHours: number;
    averageMeetingDuration: number;
    onTimeStartRate: number;
    attendanceRate: number;
    roomUtilization: number;
    aiSchedulingEfficiency: number;
    recommendations: string[];
    trends: {
      meetingFrequency: 'increasing' | 'stable' | 'decreasing';
      averageDuration: 'increasing' | 'stable' | 'decreasing';
      attendanceRate: 'improving' | 'stable' | 'declining';
    };
  }> {
    console.log('📊 Generating meeting analytics for tenant:', tenantId);
    
    // Mock analytics data
    return {
      totalMeetings: 347,
      totalMeetingHours: 521.5,
      averageMeetingDuration: 45.2, // minutes
      onTimeStartRate: 0.84,
      attendanceRate: 0.91,
      roomUtilization: 0.67,
      aiSchedulingEfficiency: 0.89,
      recommendations: [
        'Consider shorter default meeting durations to improve efficiency',
        'Implement buffer time between meetings to improve on-time starts',
        'Use AI-suggested optimal times to increase attendance rates',
        'Room A is underutilized - consider promoting for larger meetings'
      ],
      trends: {
        meetingFrequency: 'stable',
        averageDuration: 'decreasing',
        attendanceRate: 'improving'
      }
    };
  }

  /**
   * Optimize existing meeting schedule
   */
  async optimizeExistingSchedule(
    tenantId: string,
    timeRange: { start: Date; end: Date },
    optimizationGoals: {
      minimizeMeetingFatigue: number;
      maximizeProductivity: number;
      improveAttendance: number;
      optimizeRoomUsage: number;
    }
  ): Promise<{
    originalSchedule: any[];
    optimizedSchedule: any[];
    improvements: {
      meetingFatigueReduction: number;
      productivityIncrease: number;
      attendanceImprovement: number;
      roomUtilizationImprovement: number;
    };
    changes: Array<{
      meetingId: string;
      changeType: 'reschedule' | 'room_change' | 'duration_adjustment';
      oldValue: any;
      newValue: any;
      reasoning: string;
    }>;
  }> {
    console.log('🔧 Optimizing existing meeting schedule...');
    
    // Mock optimization results
    return {
      originalSchedule: [],
      optimizedSchedule: [],
      improvements: {
        meetingFatigueReduction: 23.5, // % reduction
        productivityIncrease: 18.2, // % increase
        attendanceImprovement: 12.8, // % improvement
        roomUtilizationImprovement: 15.4 // % improvement
      },
      changes: [
        {
          meetingId: 'meeting-1',
          changeType: 'reschedule',
          oldValue: { startTime: '2025-09-27T13:00:00Z' },
          newValue: { startTime: '2025-09-27T10:00:00Z' },
          reasoning: 'Moved to participant productivity peak hours'
        },
        {
          meetingId: 'meeting-2',
          changeType: 'duration_adjustment',
          oldValue: { duration: 60 },
          newValue: { duration: 45 },
          reasoning: 'Historical data shows 45 minutes is optimal for this meeting type'
        }
      ]
    };
  }
}

export default new MeetingSchedulingService();
