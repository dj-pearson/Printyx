import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Flag,
  Calendar as CalendarIcon,
  User,
  CheckSquare,
  Square,
  Play,
  Eye,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";

// Priority configuration
const priorityConfig = {
  urgent: {
    label: "Urgent",
    color: "bg-red-500",
    icon: "🔥",
    bgColor: "bg-red-50 text-red-700 border-red-200",
    hoverColor: "hover:bg-red-100",
  },
  high: {
    label: "High",
    color: "bg-orange-500",
    icon: "⚡",
    bgColor: "bg-orange-50 text-orange-700 border-orange-200",
    hoverColor: "hover:bg-orange-100",
  },
  medium: {
    label: "Medium",
    color: "bg-yellow-500",
    icon: "📌",
    bgColor: "bg-yellow-50 text-yellow-700 border-yellow-200",
    hoverColor: "hover:bg-yellow-100",
  },
  low: {
    label: "Low",
    color: "bg-green-500",
    icon: "📋",
    bgColor: "bg-green-50 text-green-700 border-green-200",
    hoverColor: "hover:bg-green-100",
  },
};

// Status configuration
const statusConfig = {
  todo: {
    label: "To Do",
    color: "bg-gray-100 text-gray-800",
    icon: Square,
    hoverColor: "hover:bg-gray-200",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-800",
    icon: Play,
    hoverColor: "hover:bg-blue-200",
  },
  review: {
    label: "Review",
    color: "bg-purple-100 text-purple-800",
    icon: Eye,
    hoverColor: "hover:bg-purple-200",
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    icon: CheckSquare,
    hoverColor: "hover:bg-green-200",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    icon: Square,
    hoverColor: "hover:bg-red-200",
  },
};

// Inline Status Selector
export function InlineStatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const config = statusConfig[value as keyof typeof statusConfig];
  const IconComponent = config?.icon || Square;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={`w-28 h-7 text-xs border-0 ${config?.color} ${config?.hoverColor}`}
      >
        <div className="flex items-center space-x-1">
          <IconComponent className="h-3 w-3" />
          <span className="hidden sm:inline">{config?.label}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(statusConfig).map(([status, statusConf]) => {
          const StatusIcon = statusConf.icon;
          return (
            <SelectItem key={status} value={status}>
              <div className="flex items-center space-x-2">
                <StatusIcon className="h-3 w-3" />
                <span>{statusConf.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Inline Priority Selector
export function InlinePrioritySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const config = priorityConfig[value as keyof typeof priorityConfig];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={`w-24 h-7 text-xs border-0 ${config?.bgColor} ${config?.hoverColor}`}
      >
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${config?.color}`} />
          <span className="hidden sm:inline">{config?.label}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(priorityConfig).map(([priority, priorityConf]) => (
          <SelectItem key={priority} value={priority}>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${priorityConf.color}`} />
              <span>{priorityConf.icon}</span>
              <span>{priorityConf.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Inline Assignee Selector
export function InlineAssigneeSelect({
  value,
  teamMembers,
  onChange,
}: {
  value?: string;
  teamMembers: any[];
  onChange: (value: string | null) => void;
}) {
  const assignee = teamMembers.find((member) => member.id === value);

  return (
    <Select value={value || ""} onValueChange={(val) => onChange(val || null)}>
      <SelectTrigger className="w-32 h-7 text-xs border-0 hover:bg-gray-100">
        {assignee ? (
          <div className="flex items-center space-x-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={assignee.avatar} />
              <AvatarFallback className="text-xs">
                {assignee.name?.charAt(0)?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline truncate">{assignee.name}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-gray-500">
            <User className="h-3 w-3" />
            <span className="hidden sm:inline">Unassigned</span>
          </div>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">
          <div className="flex items-center space-x-2">
            <User className="h-3 w-3 text-gray-400" />
            <span>Unassigned</span>
          </div>
        </SelectItem>
        {teamMembers.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            <div className="flex items-center space-x-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={member.avatar} />
                <AvatarFallback className="text-xs">
                  {member.name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <span>{member.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Inline Date Picker
export function InlineDatePicker({
  value,
  status,
  onChange,
}: {
  value?: string;
  status?: string | null;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return "No due date";

    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "MMM dd");
  };

  const getDateStyle = (status?: string | null) => {
    switch (status) {
      case "overdue":
        return "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
      case "today":
        return "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100";
      case "tomorrow":
        return "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={`w-28 h-7 text-xs justify-start ${getDateStyle(status)}`}
        >
          <div className="flex items-center space-x-1">
            {status === "overdue" && <AlertTriangle className="h-3 w-3" />}
            {status !== "overdue" && <CalendarIcon className="h-3 w-3" />}
            <span className="hidden sm:inline">{formatDateDisplay(value)}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(date) => {
            onChange(date ? date.toISOString().split("T")[0] : null);
            setOpen(false);
          }}
          initialFocus
        />
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-left justify-start"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Remove due date
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Inline Progress Editor
export function InlineProgressEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());

  if (isEditing) {
    return (
      <div className="flex items-center space-x-1">
        <input
          type="number"
          min="0"
          max="100"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={() => {
            const newValue = Math.min(
              100,
              Math.max(0, parseInt(inputValue) || 0)
            );
            onChange(newValue);
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const newValue = Math.min(
                100,
                Math.max(0, parseInt(inputValue) || 0)
              );
              onChange(newValue);
              setIsEditing(false);
            }
            if (e.key === "Escape") {
              setInputValue(value.toString());
              setIsEditing(false);
            }
          }}
          className="w-12 h-6 text-xs text-center border rounded px-1"
          autoFocus
        />
        <span className="text-xs">%</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 rounded px-1 py-1"
      onClick={() => setIsEditing(true)}
    >
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8">{value}%</span>
    </div>
  );
}

// Inline Time Tracker
export function InlineTimeTracker({
  value,
  onChange,
  isTracking = false,
  onToggleTracking,
}: {
  value: number; // minutes
  onChange: (value: number) => void;
  isTracking?: boolean;
  onToggleTracking?: () => void;
}) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return (
    <div className="flex items-center space-x-1">
      <Button
        variant="ghost"
        size="sm"
        className={`h-6 text-xs ${
          isTracking ? "text-green-600" : "text-gray-600"
        }`}
        onClick={onToggleTracking}
      >
        <Clock className="h-3 w-3 mr-1" />
        {hours}h {minutes}m
      </Button>
    </div>
  );
}

// Inline Tags Editor
export function InlineTagsEditor({
  value,
  onChange,
  availableTags = [],
}: {
  value: string[];
  onChange: (value: string[]) => void;
  availableTags?: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const addTag = (tag: string) => {
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInputValue("");
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="text-xs cursor-pointer hover:bg-red-100"
          onClick={() => removeTag(tag)}
        >
          {tag} ×
        </Badge>
      ))}

      {isEditing ? (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={() => {
            if (inputValue.trim()) {
              addTag(inputValue.trim());
            }
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (inputValue.trim()) {
                addTag(inputValue.trim());
              }
              setIsEditing(false);
            }
            if (e.key === "Escape") {
              setInputValue("");
              setIsEditing(false);
            }
          }}
          className="w-20 h-5 text-xs border rounded px-1"
          placeholder="Add tag"
          autoFocus
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-xs text-gray-500 hover:text-gray-700"
          onClick={() => setIsEditing(true)}
        >
          + Tag
        </Button>
      )}
    </div>
  );
}

// Helper function to get due date status
export function getDueDateStatus(dueDate?: string): string | null {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();

  if (isToday(due)) return "today";
  if (due < now) return "overdue";
  if (isTomorrow(due)) return "tomorrow";
  return "upcoming";
}
