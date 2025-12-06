/**
 * Unified Task Hub
 * Consolidates all task management functionality into a single, cohesive interface
 * - Replaces: TaskManagement.tsx, BasicTaskManagement.tsx, TaskManagementPage.tsx,
 *             AITaskScheduling.tsx, my-tasks.tsx
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  CheckSquare,
  Brain,
  Folder,
  User,
  Layout,
  Plus,
  Settings,
  Zap,
} from "lucide-react";

// Import view components
import { AllTasksView } from "@/components/tasks/AllTasksView";
import { MyTasksView } from "@/components/tasks/MyTasksView";
import { ProjectsView } from "@/components/tasks/ProjectsView";
import { AIInsightsView } from "@/components/tasks/AIInsightsView";
import { TemplatesView } from "@/components/tasks/TemplatesView";
import { TaskHubStats } from "@/components/tasks/TaskHubStats";
import { CreateTaskDialog, CreateProjectDialog } from "@/components/tasks/TaskDialogs";
import ContextualHelp from "@/components/contextual/ContextualHelp";
import PageAlerts from "@/components/contextual/PageAlerts";
import KpiSummaryBar from "@/components/dashboard/KpiSummaryBar";
import { apiRequest } from "@/lib/queryClient";

export default function TaskHub() {
  const [activeTab, setActiveTab] = useState<string>("my-tasks");
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch unified data
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: async () => apiRequest("/api/tasks"),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => apiRequest("/api/projects"),
  });

  const { data: taskStats } = useQuery({
    queryKey: ["/api/tasks/stats", { my: true }],
    queryFn: async () => apiRequest("/api/tasks/stats?my=true"),
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => apiRequest("/api/users"),
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/tasks", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/stats"] });
      toast({ title: "Success", description: "Task created successfully" });
      setIsCreateTaskOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/projects", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Success", description: "Project created successfully" });
      setIsCreateProjectOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const isLoading = tasksLoading || projectsLoading;

  return (
    <MainLayout
      title="Task Hub"
      description="Unified task and project management with AI-powered insights"
    >
      <div className="space-y-6">
        <ContextualHelp page="task-hub" />
        <KpiSummaryBar className="mb-4" />
        <PageAlerts
          categories={["business", "performance"]}
          severities={["high", "critical"]}
          className="-mt-2"
        />

        {/* Header with Stats and Actions */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <CheckSquare className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold">Task Hub</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Centralized task management, projects, and AI-powered scheduling
            </p>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateProjectOpen(true)}
              className="flex-1 lg:flex-none"
            >
              <Folder className="h-4 w-4 mr-2" />
              New Project
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateTaskOpen(true)}
              className="flex-1 lg:flex-none"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <TaskHubStats stats={taskStats} isLoading={isLoading} />

        {/* Main Tabbed Interface */}
        <Card>
          <CardHeader className="pb-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
                <TabsTrigger value="my-tasks" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">My Tasks</span>
                </TabsTrigger>
                <TabsTrigger value="all-tasks" className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  <span className="hidden sm:inline">All Tasks</span>
                </TabsTrigger>
                <TabsTrigger value="projects" className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  <span className="hidden sm:inline">Projects</span>
                </TabsTrigger>
                <TabsTrigger value="ai-insights" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Insights</span>
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="hidden sm:inline">Templates</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} className="space-y-6">
              {/* My Tasks Tab */}
              <TabsContent value="my-tasks">
                <MyTasksView
                  tasks={tasks}
                  isLoading={tasksLoading}
                  teamMembers={teamMembers}
                />
              </TabsContent>

              {/* All Tasks Tab */}
              <TabsContent value="all-tasks">
                <AllTasksView
                  tasks={tasks}
                  isLoading={tasksLoading}
                  teamMembers={teamMembers}
                  projects={projects}
                />
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects">
                <ProjectsView
                  projects={projects}
                  isLoading={projectsLoading}
                  teamMembers={teamMembers}
                />
              </TabsContent>

              {/* AI Insights Tab */}
              <TabsContent value="ai-insights">
                <AIInsightsView
                  tasks={tasks}
                  stats={taskStats}
                  isLoading={isLoading}
                />
              </TabsContent>

              {/* Templates Tab (NEW) */}
              <TabsContent value="templates">
                <TemplatesView teamMembers={teamMembers} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Create Task Dialog */}
        <CreateTaskDialog
          open={isCreateTaskOpen}
          onOpenChange={setIsCreateTaskOpen}
          projects={projects}
          teamMembers={teamMembers}
          onSubmit={(data) => createTaskMutation.mutate(data)}
          isLoading={createTaskMutation.isPending}
        />

        {/* Create Project Dialog */}
        <CreateProjectDialog
          open={isCreateProjectOpen}
          onOpenChange={setIsCreateProjectOpen}
          teamMembers={teamMembers}
          onSubmit={(data) => createProjectMutation.mutate(data)}
          isLoading={createProjectMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
