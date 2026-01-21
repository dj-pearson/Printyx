import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import CalendarView from '@/components/calendar/CalendarView';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Calendar,
  Brain,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Settings,
  RefreshCw,
} from 'lucide-react';

interface CalendarStats {
  totalEvents: number;
  aiGeneratedEvents: number;
  completedTasks: number;
  upcomingMeetings: number;
  focusTimeBlocks: number;
  aiOptimizationSavings: number; // in hours
}

export default function CalendarPage() {
  const [stats] = useState<CalendarStats>({
    totalEvents: 24,
    aiGeneratedEvents: 18,
    completedTasks: 12,
    upcomingMeetings: 6,
    focusTimeBlocks: 4,
    aiOptimizationSavings: 3.5,
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const handleSync = async () => {
    setSyncStatus('syncing');
    // Simulate sync
    setTimeout(() => {
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }, 1500);
  };

  return (
    <MainLayout
      title="Calendar Integration"
      description="Smart scheduling and event management with AI-powered calendar optimization and conflict resolution"
    >
      {/* Action buttons */}
      <div className="flex justify-end gap-3 mb-6">
        <Button variant="outline" onClick={handleSync} disabled={syncStatus === 'syncing'}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
          {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Calendars'}
        </Button>

        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* AI Insights & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Optimization</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.aiOptimizationSavings}h saved
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Time saved through intelligent scheduling this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Events</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.aiGeneratedEvents}/{stats.totalEvents}
                </p>
              </div>
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">AI-generated events this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Tasks</p>
                <p className="text-2xl font-bold text-purple-600">{stats.completedTasks}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Tasks completed this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Focus Time</p>
                <p className="text-2xl font-bold text-orange-600">{stats.focusTimeBlocks}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Deep work blocks scheduled</p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Status */}
      {syncStatus !== 'idle' && (
        <Card
          className={`border-l-4 ${
            syncStatus === 'success'
              ? 'border-green-500 bg-green-50'
              : syncStatus === 'error'
                ? 'border-red-500 bg-red-50'
                : 'border-blue-500 bg-blue-50'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center">
              {syncStatus === 'syncing' && (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                  <span className="text-blue-800">Syncing with external calendars...</span>
                </>
              )}
              {syncStatus === 'success' && (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  <span className="text-green-800">Calendar sync completed successfully!</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                  <span className="text-red-800">Calendar sync failed. Please try again.</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Calendar Component */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <CalendarView />
        </div>

        {/* AI Insights Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Zap className="mr-2 h-5 w-5 text-yellow-500" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Today's Recommendations</h4>
                <div className="space-y-2">
                  <div className="flex items-start space-x-2 text-sm">
                    <Brain className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Optimal Focus Time</p>
                      <p className="text-gray-600 text-xs">
                        3:00 PM - 5:00 PM is your peak productivity window
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 text-sm">
                    <Brain className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Schedule Buffer</p>
                      <p className="text-gray-600 text-xs">
                        Add 15min buffer before important calls
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 text-sm">
                    <Brain className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Follow-up Reminder</p>
                      <p className="text-gray-600 text-xs">
                        ABC Corp lead needs follow-up by Friday
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-sm mb-2">Calendar Connections</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      <span>Google Calendar</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Connected
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      <span>Outlook</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Connected
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                      <span>iCloud</span>
                    </div>
                    <Badge variant="outline" className="text-xs text-gray-500">
                      Not Connected
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-sm mb-2">Quick Actions</h4>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Focus Time
                  </Button>

                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Brain className="h-4 w-4 mr-2" />
                    AI Schedule Optimization
                  </Button>

                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Zap className="h-4 w-4 mr-2" />
                    Smart Meeting Finder
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
