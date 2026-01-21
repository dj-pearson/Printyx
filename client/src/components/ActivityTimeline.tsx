import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Phone,
  Mail,
  Users,
  FileText,
  CheckSquare,
  Clock,
  Calendar,
  ArrowRight,
  ExternalLink,
  Edit2,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, formatDistance } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Activity {
  id: string;
  activityType: string;
  subject: string;
  description: string;
  direction?: 'inbound' | 'outbound';
  emailFrom?: string;
  emailTo?: string;
  emailCc?: string;
  callDuration?: number;
  callOutcome?: string;
  scheduledDate?: string;
  completedDate?: string;
  dueDate?: string;
  outcome?: string;
  nextAction?: string;
  followUpDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivityTimelineProps {
  businessRecordId: string; // Company ID (kept for backward compatibility)
  className?: string;
}

export function ActivityTimeline({ businessRecordId, className }: ActivityTimelineProps) {
  console.log('🔍 ActivityTimeline - businessRecordId:', businessRecordId);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
  const [editFormData, setEditFormData] = useState({
    subject: '',
    description: '',
    activityType: '',
    direction: '',
    callDuration: '',
    callOutcome: '',
    outcome: '',
    nextAction: '',
    priority: '',
  });

  const {
    data: activities,
    isLoading,
    error,
    refetch,
  } = useQuery<Activity[]>({
    queryKey: [`/api/companies/${businessRecordId}/activities`],
    queryFn: async () => {
      console.log('🔍 ActivityTimeline - Fetching activities for company:', businessRecordId);
      const data = await apiRequest(`/api/companies/${businessRecordId}/activities`);
      console.log('🔍 ActivityTimeline - Fetched activities:', data);

      // Log first activity for debugging date issues
      if (Array.isArray(data) && data.length > 0) {
        console.log('🔍 ActivityTimeline - First activity dates:', {
          createdAt: data[0].createdAt,
          scheduledDate: data[0].scheduledDate,
          dueDate: data[0].dueDate,
          followUpDate: data[0].followUpDate,
        });
      }

      return Array.isArray(data) ? data : [];
    },
    enabled: !!businessRecordId, // Only run query if businessRecordId is defined
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await apiRequest(`/api/activities/${activityId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Activity deleted',
        description: 'The activity has been successfully deleted.',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/companies/${businessRecordId}/activities`],
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete activity',
        variant: 'destructive',
      });
    },
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/activities/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Activity updated',
        description: 'The activity has been successfully updated.',
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/companies/${businessRecordId}/activities`],
      });
      setEditDialogOpen(false);
      setActivityToEdit(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update activity',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteClick = (activityId: string) => {
    setActivityToDelete(activityId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (activityToDelete) {
      deleteMutation.mutate(activityToDelete);
      setDeleteDialogOpen(false);
      setActivityToDelete(null);
    }
  };

  const handleEditClick = (activity: Activity) => {
    setActivityToEdit(activity);
    setEditFormData({
      subject: activity.subject || '',
      description: activity.description || '',
      activityType: activity.activityType || '',
      direction: activity.direction || '',
      callDuration: activity.callDuration?.toString() || '',
      callOutcome: activity.callOutcome || '',
      outcome: activity.outcome || '',
      nextAction: activity.nextAction || '',
      priority: 'medium',
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!activityToEdit) return;

    const updateData: any = {
      subject: editFormData.subject,
      notes: editFormData.description,
      activityType: editFormData.activityType,
    };

    // Add optional fields if they have values
    if (editFormData.direction) updateData.direction = editFormData.direction;
    if (editFormData.callDuration) updateData.durationMinutes = parseInt(editFormData.callDuration);
    if (editFormData.callOutcome) updateData.outcome = editFormData.callOutcome;
    if (editFormData.outcome) updateData.outcome = editFormData.outcome;
    if (editFormData.nextAction) updateData.nextAction = editFormData.nextAction;

    editMutation.mutate({ id: activityToEdit.id, data: updateData });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'meeting':
        return <Users className="h-4 w-4" />;
      case 'note':
        return <FileText className="h-4 w-4" />;
      case 'task':
        return <CheckSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'call':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'email':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'meeting':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'note':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'task':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'no_response':
        return 'bg-yellow-100 text-yellow-800';
      case 'rescheduled':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Safe date formatter that handles null/invalid dates
  const safeFormatDate = (
    dateString: string | null | undefined,
    formatString: string,
  ): string | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return format(date, formatString);
  };

  const formatActivityTime = (dateString: string | null | undefined) => {
    // Handle invalid or missing dates
    if (!dateString) {
      return { distance: 'Unknown time', formatted: 'No date' };
    }

    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return { distance: 'Invalid date', formatted: 'Invalid date' };
    }

    const now = new Date();
    const distance = formatDistance(date, now, { addSuffix: true });
    const formatted = format(date, 'MMM d, yyyy p');

    return { distance, formatted };
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500 mb-2">Failed to load activities</p>
          <p className="text-sm text-gray-400 mb-3">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No activities yet</h3>
          <p className="text-gray-500">
            Start logging calls, emails, meetings, and notes to track your interactions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {activities.map((activity, index) => {
        const { distance, formatted } = formatActivityTime(activity.createdAt);
        const isLast = index === activities.length - 1;

        return (
          <div key={activity.id} className="relative">
            {/* Timeline line */}
            {!isLast && <div className="absolute left-4 top-10 w-0.5 h-full bg-gray-200"></div>}

            <Card className="ml-0">
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  {/* Activity Icon */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(
                      activity.activityType,
                    )}`}
                  >
                    {getActivityIcon(activity.activityType)}
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900">{activity.subject}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {activity.activityType}
                        </Badge>
                        {activity.direction && (
                          <Badge variant="outline" className="text-xs">
                            {activity.direction}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-xs text-gray-500" title={formatted}>
                          {distance}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-gray-100"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(activity)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(activity.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Activity Details */}
                    <div className="mt-2 space-y-2">
                      {activity.description && (
                        <p className="text-sm text-gray-700">{activity.description}</p>
                      )}

                      {/* Call-specific details */}
                      {activity.activityType === 'call' && (
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {activity.callDuration && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{activity.callDuration} min</span>
                            </div>
                          )}
                          {activity.callOutcome && (
                            <Badge variant="outline" className="text-xs">
                              {activity.callOutcome.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Email-specific details */}
                      {activity.activityType === 'email' && (
                        <div className="space-y-1 text-xs text-gray-500">
                          {activity.emailTo && <div>To: {activity.emailTo}</div>}
                          {activity.emailCc && <div>CC: {activity.emailCc}</div>}
                        </div>
                      )}

                      {/* Meeting/Task dates */}
                      {(activity.scheduledDate || activity.dueDate) && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {activity.scheduledDate &&
                              safeFormatDate(activity.scheduledDate, 'MMM d, yyyy p')}
                            {activity.dueDate &&
                              ` Due: ${safeFormatDate(activity.dueDate, 'MMM d, yyyy')}`}
                          </span>
                        </div>
                      )}

                      {/* Outcome */}
                      {activity.outcome && (
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ${getOutcomeColor(activity.outcome)}`}>
                            {activity.outcome.replace('_', ' ')}
                          </Badge>
                        </div>
                      )}

                      {/* Next Action */}
                      {activity.nextAction && (
                        <div className="flex items-center space-x-2 text-sm">
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">Next: {activity.nextAction}</span>
                        </div>
                      )}

                      {/* Follow-up Date */}
                      {activity.followUpDate &&
                        safeFormatDate(activity.followUpDate, 'MMM d, yyyy') && (
                          <div className="flex items-center space-x-2 text-sm">
                            <Calendar className="h-3 w-3 text-blue-500" />
                            <span className="text-blue-600">
                              Follow-up: {safeFormatDate(activity.followUpDate, 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Created by */}
                    <div className="mt-3 flex items-center space-x-2 text-xs text-gray-500">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {activity.createdBy?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span>by {activity.createdBy}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActivityToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Activity Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
            <DialogDescription>Update the activity details below.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Activity Type */}
            <div className="space-y-2">
              <Label htmlFor="activityType">Activity Type *</Label>
              <Select
                value={editFormData.activityType}
                onValueChange={(value) => setEditFormData({ ...editFormData, activityType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={editFormData.subject}
                onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                placeholder="e.g., Follow-up call with customer"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Add details about this activity..."
                rows={4}
              />
            </div>

            {/* Call-specific fields */}
            {editFormData.activityType === 'call' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="direction">Direction</Label>
                    <Select
                      value={editFormData.direction}
                      onValueChange={(value) =>
                        setEditFormData({ ...editFormData, direction: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="callDuration">Duration (minutes)</Label>
                    <Input
                      id="callDuration"
                      type="number"
                      value={editFormData.callDuration}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, callDuration: e.target.value })
                      }
                      placeholder="e.g., 15"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="callOutcome">Call Outcome</Label>
                  <Select
                    value={editFormData.callOutcome}
                    onValueChange={(value) =>
                      setEditFormData({ ...editFormData, callOutcome: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="no_response">No Response</SelectItem>
                      <SelectItem value="voicemail">Voicemail</SelectItem>
                      <SelectItem value="rescheduled">Rescheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Outcome */}
            <div className="space-y-2">
              <Label htmlFor="outcome">Outcome</Label>
              <Select
                value={editFormData.outcome}
                onValueChange={(value) => setEditFormData({ ...editFormData, outcome: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Next Action */}
            <div className="space-y-2">
              <Label htmlFor="nextAction">Next Action</Label>
              <Input
                id="nextAction"
                value={editFormData.nextAction}
                onChange={(e) => setEditFormData({ ...editFormData, nextAction: e.target.value })}
                placeholder="e.g., Send quote, Schedule demo"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setActivityToEdit(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editMutation.isPending}>
              {editMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ActivityTimeline;
