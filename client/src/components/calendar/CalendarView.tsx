import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Brain,
  Plus,
  Settings,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location?: string;
  attendees?: string[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  eventType: 'meeting' | 'task' | 'focus_time' | 'reminder';
  isAiGenerated: boolean;
  aiConfidence?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

interface CalendarViewProps {
  className?: string;
}

export default function CalendarView({ className }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');

  // Mock events data
  useEffect(() => {
    const mockEvents: CalendarEvent[] = [
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
      {
        id: 'event-4',
        title: 'Service Call - XYZ Manufacturing',
        description: 'Copier maintenance and inspection',
        startTime: '2025-09-27T09:00:00Z',
        endTime: '2025-09-27T11:00:00Z',
        isAllDay: false,
        location: '123 Industrial Blvd',
        eventType: 'task',
        isAiGenerated: true,
        aiConfidence: 0.78,
        relatedEntityType: 'service_call',
        relatedEntityId: 'service-456',
      },
    ];

    setEvents(mockEvents);
    setLoading(false);
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isSameDay(new Date(event.startTime), date));
  };

  const getEventTypeColor = (eventType: string, isAiGenerated: boolean) => {
    if (isAiGenerated) {
      switch (eventType) {
        case 'task':
          return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'focus_time':
          return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'meeting':
          return 'bg-green-100 text-green-800 border-green-200';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    } else {
      switch (eventType) {
        case 'meeting':
          return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'task':
          return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    }
  };

  const formatEventTime = (startTime: string, endTime: string, isAllDay: boolean) => {
    if (isAllDay) return 'All day';
    const start = format(new Date(startTime), 'h:mm a');
    const end = format(new Date(endTime), 'h:mm a');
    return `${start} - ${end}`;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <Calendar className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Loading calendar...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-6 w-6" />
            Motion AI Calendar
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Event
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold">{format(currentDate, 'MMMM yyyy')}</h3>
            <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex space-x-1">
            {(['month', 'week', 'day'] as const).map((viewType) => (
              <Button
                key={viewType}
                variant={view === viewType ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView(viewType)}
              >
                {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {view === 'month' && (
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((date, index) => {
              const dayEvents = getEventsForDate(date);
              const isSelected = isSameDay(date, selectedDate);
              const isCurrentMonth = isSameMonth(date, currentDate);

              return (
                <div
                  key={index}
                  className={`
                    min-h-[100px] p-1 border border-gray-200 cursor-pointer transition-colors
                    ${isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}
                    ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}
                  `}
                  onClick={() => setSelectedDate(date)}
                >
                  <div className="text-sm font-medium mb-1">{format(date, 'd')}</div>

                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`
                          text-xs p-1 rounded border truncate
                          ${getEventTypeColor(event.eventType, event.isAiGenerated)}
                        `}
                        title={`${event.title} - ${formatEventTime(event.startTime, event.endTime, event.isAllDay)}`}
                      >
                        <div className="flex items-center">
                          {event.isAiGenerated && <Brain className="h-2 w-2 mr-1 flex-shrink-0" />}
                          <span className="truncate">{event.title}</span>
                        </div>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500 pl-1">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Event Details Sidebar */}
        {selectedDate && (
          <div className="mt-6 border-t pt-4">
            <h4 className="font-medium mb-3">
              Events for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h4>

            {getEventsForDate(selectedDate).length === 0 ? (
              <p className="text-gray-500 text-sm">No events scheduled</p>
            ) : (
              <div className="space-y-3">
                {getEventsForDate(selectedDate).map((event) => (
                  <div key={event.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center">
                        {event.isAiGenerated && <Brain className="h-4 w-4 mr-2 text-blue-600" />}
                        <h5 className="font-medium">{event.title}</h5>
                      </div>
                      <Badge
                        variant="outline"
                        className={getEventTypeColor(event.eventType, event.isAiGenerated)}
                      >
                        {event.eventType.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatEventTime(event.startTime, event.endTime, event.isAllDay)}
                      </div>

                      {event.location && (
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {event.location}
                        </div>
                      )}

                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                        </div>
                      )}

                      {event.isAiGenerated && event.aiConfidence && (
                        <div className="flex items-center">
                          <Brain className="h-3 w-3 mr-1" />
                          AI Confidence: {Math.round(event.aiConfidence * 100)}%
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-sm text-gray-700 mt-2">{event.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
