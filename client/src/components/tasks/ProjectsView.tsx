/**
 * Projects View Component
 * Project management and overview
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Folder, Calendar, User, CheckCircle, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  projectManagerName?: string;
  startDate?: string;
  endDate?: string;
  completionPercentage: number;
  taskCount: number;
  completedTaskCount: number;
  color?: string;
}

interface ProjectsViewProps {
  projects: Project[];
  isLoading: boolean;
  teamMembers: any[];
}

export function ProjectsView({ projects, isLoading, teamMembers }: ProjectsViewProps) {
  if (isLoading) {
    return <div className="text-center py-8">Loading projects...</div>;
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Projects</h3>
          <p className="text-muted-foreground">
            Create your first project to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: "bg-gray-100 text-gray-800",
      active: "bg-blue-100 text-blue-800",
      on_hold: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <Card key={project.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: project.color || "#3b82f6" }}
                />
                <CardTitle className="text-lg">{project.name}</CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
            <Badge variant="outline" className={getStatusColor(project.status)}>
              {project.status.replace("_", " ")}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            )}

            <div className="space-y-2 text-sm">
              {project.projectManagerName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{project.projectManagerName}</span>
                </div>
              )}

              {project.endDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Due {format(new Date(project.endDate), "MMM d, yyyy")}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <span>
                  {project.completedTaskCount} / {project.taskCount} tasks
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{project.completionPercentage}%</span>
              </div>
              <Progress value={project.completionPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
