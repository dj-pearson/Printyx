import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  Clock,
  Mail,
  Phone,
  Users,
  FileText,
  CheckSquare,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityFormProps {
  isOpen: boolean;
  onClose: () => void;
  businessRecordId: string;
  activityType: "call" | "email" | "meeting" | "note" | "task";
  recordType: "lead" | "customer";
  recordName?: string;
}

interface ActivityFormData {
  subject: string;
  description: string;
  direction?: "inbound" | "outbound";
  emailTo?: string;
  emailCc?: string;
  callDuration?: number;
  callOutcome?: "answered" | "no_answer" | "busy" | "voicemail";
  scheduledDate?: Date;
  dueDate?: Date;
  outcome?: "completed" | "no_response" | "rescheduled" | "cancelled";
  nextAction?: string;
  followUpDate?: Date;
  priority?: "low" | "medium" | "high";
}

export function ActivityForm({
  isOpen,
  onClose,
  businessRecordId,
  activityType,
  recordType,
  recordName,
}: ActivityFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<ActivityFormData>({
    subject: "",
    description: "",
    direction:
      activityType === "call" || activityType === "email"
        ? "outbound"
        : undefined,
    emailTo: "",
    emailCc: "",
    callDuration: undefined,
    callOutcome: undefined,
    scheduledDate: activityType === "meeting" ? new Date() : undefined,
    dueDate: activityType === "task" ? new Date() : undefined,
    outcome: activityType === "note" ? "completed" : undefined,
    nextAction: "",
    followUpDate: undefined,
    priority: "medium",
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(
        `/api/business-records/${businessRecordId}/activities`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create activity");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Activity Logged",
        description: `${
          activityType.charAt(0).toUpperCase() + activityType.slice(1)
        } has been successfully logged.`,
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/business-records/${businessRecordId}/activities`],
      });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Log Activity",
        description:
          error.message || "There was an error logging the activity.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      subject: "",
      description: "",
      direction:
        activityType === "call" || activityType === "email"
          ? "outbound"
          : undefined,
      emailTo: "",
      emailCc: "",
      callDuration: undefined,
      callOutcome: undefined,
      scheduledDate: activityType === "meeting" ? new Date() : undefined,
      dueDate: activityType === "task" ? new Date() : undefined,
      outcome: activityType === "note" ? "completed" : undefined,
      nextAction: "",
      followUpDate: undefined,
      priority: "medium",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const activityData = {
      activityType,
      subject:
        formData.subject ||
        `${
          activityType.charAt(0).toUpperCase() + activityType.slice(1)
        } with ${recordName}`,
      description: formData.description,
      direction: formData.direction,
      emailTo: formData.emailTo,
      emailCc: formData.emailCc,
      callDuration: formData.callDuration,
      callOutcome: formData.callOutcome,
      scheduledDate: formData.scheduledDate?.toISOString(),
      dueDate: formData.dueDate?.toISOString(),
      completedDate:
        activityType === "note" || formData.outcome === "completed"
          ? new Date().toISOString()
          : undefined,
      outcome: formData.outcome,
      nextAction: formData.nextAction,
      followUpDate: formData.followUpDate?.toISOString(),
    };

    createActivityMutation.mutate(activityData);
  };

  const getIcon = () => {
    switch (activityType) {
      case "call":
        return <Phone className="h-5 w-5" />;
      case "email":
        return <Mail className="h-5 w-5" />;
      case "meeting":
        return <Users className="h-5 w-5" />;
      case "note":
        return <FileText className="h-5 w-5" />;
      case "task":
        return <CheckSquare className="h-5 w-5" />;
    }
  };

  const getTitle = () => {
    const action =
      activityType === "note"
        ? "Add Note"
        : `Log ${activityType.charAt(0).toUpperCase() + activityType.slice(1)}`;
    return `${action} for ${recordName}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            {getIcon()}
            <span className="ml-2">{getTitle()}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Subject */}
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, subject: e.target.value }))
              }
              placeholder={`${
                activityType.charAt(0).toUpperCase() + activityType.slice(1)
              } with ${recordName}`}
            />
          </div>

          {/* Direction (for calls and emails) */}
          {(activityType === "call" || activityType === "email") && (
            <div>
              <Label>Direction</Label>
              <Select
                value={formData.direction}
                onValueChange={(value: "inbound" | "outbound") =>
                  setFormData((prev) => ({ ...prev, direction: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Email specific fields */}
          {activityType === "email" && (
            <>
              <div>
                <Label htmlFor="emailTo">To</Label>
                <Input
                  id="emailTo"
                  type="email"
                  value={formData.emailTo}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emailTo: e.target.value,
                    }))
                  }
                  placeholder="recipient@email.com"
                />
              </div>
              <div>
                <Label htmlFor="emailCc">CC</Label>
                <Input
                  id="emailCc"
                  type="email"
                  value={formData.emailCc}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emailCc: e.target.value,
                    }))
                  }
                  placeholder="cc@email.com (optional)"
                />
              </div>
            </>
          )}

          {/* Call specific fields */}
          {activityType === "call" && (
            <>
              <div>
                <Label htmlFor="callDuration">Duration (minutes)</Label>
                <Input
                  id="callDuration"
                  type="number"
                  value={formData.callDuration || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      callDuration: parseInt(e.target.value) || undefined,
                    }))
                  }
                  placeholder="15"
                />
              </div>
              <div>
                <Label>Call Outcome</Label>
                <Select
                  value={formData.callOutcome}
                  onValueChange={(
                    value: "answered" | "no_answer" | "busy" | "voicemail"
                  ) => setFormData((prev) => ({ ...prev, callOutcome: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="answered">Answered</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Meeting date */}
          {activityType === "meeting" && (
            <div>
              <Label>Meeting Date & Time</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.scheduledDate ? (
                      format(formData.scheduledDate, "PPP p")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.scheduledDate}
                    onSelect={(date) =>
                      setFormData((prev) => ({ ...prev, scheduledDate: date }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Task due date */}
          {activityType === "task" && (
            <>
              <div>
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dueDate ? (
                        format(formData.dueDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.dueDate}
                      onSelect={(date) =>
                        setFormData((prev) => ({ ...prev, dueDate: date }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: "low" | "medium" | "high") =>
                    setFormData((prev) => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Description */}
          <div>
            <Label htmlFor="description">
              {activityType === "note" ? "Note" : "Description"}
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder={`What ${
                activityType === "note" ? "happened" : "was discussed"
              }? What are the next steps?`}
              className="min-h-[120px]"
              required
            />
          </div>

          {/* Next Action */}
          {activityType !== "note" && (
            <div>
              <Label htmlFor="nextAction">Next Action</Label>
              <Input
                id="nextAction"
                value={formData.nextAction}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    nextAction: e.target.value,
                  }))
                }
                placeholder="What should happen next?"
              />
            </div>
          )}

          {/* Follow-up Date */}
          {activityType !== "note" && activityType !== "task" && (
            <div>
              <Label>Follow-up Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.followUpDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.followUpDate ? (
                      format(formData.followUpDate, "PPP")
                    ) : (
                      <span>No follow-up scheduled</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.followUpDate}
                    onSelect={(date) =>
                      setFormData((prev) => ({ ...prev, followUpDate: date }))
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Activity Outcome */}
          {activityType !== "note" && activityType !== "task" && (
            <div>
              <Label>Outcome</Label>
              <Select
                value={formData.outcome}
                onValueChange={(
                  value:
                    | "completed"
                    | "no_response"
                    | "rescheduled"
                    | "cancelled"
                ) => setFormData((prev) => ({ ...prev, outcome: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createActivityMutation.isPending}>
              {createActivityMutation.isPending ? "Saving..." : "Save Activity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ActivityForm;
