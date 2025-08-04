import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { format, formatDistance } from "date-fns";

interface Activity {
  id: string;
  activityType: string;
  subject: string;
  description: string;
  direction?: "inbound" | "outbound";
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
  businessRecordId: string;
  className?: string;
}

export function ActivityTimeline({
  businessRecordId,
  className,
}: ActivityTimelineProps) {
  const {
    data: activities,
    isLoading,
    error,
  } = useQuery<Activity[]>({
    queryKey: [`/api/business-records/${businessRecordId}/activities`],
    queryFn: async () => {
      const response = await fetch(
        `/api/business-records/${businessRecordId}/activities`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }

      return response.json();
    },
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "meeting":
        return <Users className="h-4 w-4" />;
      case "note":
        return <FileText className="h-4 w-4" />;
      case "task":
        return <CheckSquare className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "call":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "email":
        return "bg-green-100 text-green-800 border-green-200";
      case "meeting":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "note":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "task":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "no_response":
        return "bg-yellow-100 text-yellow-800";
      case "rescheduled":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatActivityTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const distance = formatDistance(date, now, { addSuffix: true });
    const formatted = format(date, "MMM d, yyyy p");

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
          <p className="text-gray-500">Failed to load activities</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No activities yet
          </h3>
          <p className="text-gray-500">
            Start logging calls, emails, meetings, and notes to track your
            interactions.
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
            {!isLast && (
              <div className="absolute left-4 top-10 w-0.5 h-full bg-gray-200"></div>
            )}

            <Card className="ml-0">
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  {/* Activity Icon */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(
                      activity.activityType
                    )}`}
                  >
                    {getActivityIcon(activity.activityType)}
                  </div>

                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {activity.subject}
                        </h4>
                        <Badge variant="secondary" className="text-xs">
                          {activity.activityType}
                        </Badge>
                        {activity.direction && (
                          <Badge variant="outline" className="text-xs">
                            {activity.direction}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500" title={formatted}>
                        {distance}
                      </div>
                    </div>

                    {/* Activity Details */}
                    <div className="mt-2 space-y-2">
                      {activity.description && (
                        <p className="text-sm text-gray-700">
                          {activity.description}
                        </p>
                      )}

                      {/* Call-specific details */}
                      {activity.activityType === "call" && (
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {activity.callDuration && (
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{activity.callDuration} min</span>
                            </div>
                          )}
                          {activity.callOutcome && (
                            <Badge variant="outline" className="text-xs">
                              {activity.callOutcome.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Email-specific details */}
                      {activity.activityType === "email" && (
                        <div className="space-y-1 text-xs text-gray-500">
                          {activity.emailTo && (
                            <div>To: {activity.emailTo}</div>
                          )}
                          {activity.emailCc && (
                            <div>CC: {activity.emailCc}</div>
                          )}
                        </div>
                      )}

                      {/* Meeting/Task dates */}
                      {(activity.scheduledDate || activity.dueDate) && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {activity.scheduledDate &&
                              format(
                                new Date(activity.scheduledDate),
                                "MMM d, yyyy p"
                              )}
                            {activity.dueDate &&
                              `Due: ${format(
                                new Date(activity.dueDate),
                                "MMM d, yyyy"
                              )}`}
                          </span>
                        </div>
                      )}

                      {/* Outcome */}
                      {activity.outcome && (
                        <div className="flex items-center space-x-2">
                          <Badge
                            className={`text-xs ${getOutcomeColor(
                              activity.outcome
                            )}`}
                          >
                            {activity.outcome.replace("_", " ")}
                          </Badge>
                        </div>
                      )}

                      {/* Next Action */}
                      {activity.nextAction && (
                        <div className="flex items-center space-x-2 text-sm">
                          <ArrowRight className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">
                            Next: {activity.nextAction}
                          </span>
                        </div>
                      )}

                      {/* Follow-up Date */}
                      {activity.followUpDate && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Calendar className="h-3 w-3 text-blue-500" />
                          <span className="text-blue-600">
                            Follow-up:{" "}
                            {format(
                              new Date(activity.followUpDate),
                              "MMM d, yyyy"
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Created by */}
                    <div className="mt-3 flex items-center space-x-2 text-xs text-gray-500">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {activity.createdBy?.charAt(0)?.toUpperCase() || "U"}
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
    </div>
  );
}

export default ActivityTimeline;
