import type { Express } from "express";

// Mock data for tasks and projects
const mockTasks = [
  {
    id: "1",
    title: "Install Canon imageRUNNER at TechCorp",
    description: "Complete installation and setup of new multifunction device",
    status: "in_progress",
    priority: "high",
    assignedTo: "tech1",
    assignedToName: "John Smith",
    projectId: "proj1",
    projectName: "TechCorp Equipment Upgrade",
    dueDate: "2025-01-05T17:00:00Z",
    estimatedHours: 6,
    actualHours: 4,
    completionPercentage: 75,
    tags: ["installation", "canon", "urgent"],
    createdAt: "2025-01-01T09:00:00Z"
  },
  {
    id: "2",
    title: "Update service contract pricing",
    description: "Review and update pricing for all service contracts due for renewal",
    status: "todo",
    priority: "medium",
    assignedTo: "admin1",
    assignedToName: "Sarah Johnson",
    dueDate: "2025-01-10T17:00:00Z",
    estimatedHours: 3,
    completionPercentage: 0,
    tags: ["contracts", "pricing"],
    createdAt: "2024-12-30T14:00:00Z"
  },
  {
    id: "3",
    title: "Quarterly inventory audit",
    description: "Conduct full inventory count and reconciliation",
    status: "completed",
    priority: "medium",
    assignedTo: "admin2",
    assignedToName: "Mike Wilson",
    completedAt: "2024-12-28T16:30:00Z",
    estimatedHours: 8,
    actualHours: 7,
    completionPercentage: 100,
    tags: ["inventory", "audit"],
    createdAt: "2024-12-20T10:00:00Z"
  },
  {
    id: "4",
    title: "Train customer on new device features",
    description: "Provide comprehensive training on advanced features and maintenance",
    status: "todo",
    priority: "medium",
    assignedTo: "tech1",
    assignedToName: "John Smith",
    projectId: "proj1",
    projectName: "TechCorp Equipment Upgrade",
    dueDate: "2025-01-08T14:00:00Z",
    estimatedHours: 2,
    completionPercentage: 0,
    tags: ["training", "customer"],
    createdAt: "2025-01-02T10:00:00Z"
  },
  {
    id: "5",
    title: "Plan Q1 preventive maintenance schedule",
    description: "Create detailed schedule for all devices across major accounts",
    status: "in_progress",
    priority: "high",
    assignedTo: "pm2",
    assignedToName: "Tom Anderson",
    projectId: "proj2",
    projectName: "Q1 Service Campaign",
    dueDate: "2025-01-12T17:00:00Z",
    estimatedHours: 4,
    actualHours: 2,
    completionPercentage: 40,
    tags: ["planning", "maintenance"],
    createdAt: "2024-12-28T09:00:00Z"
  }
];

const mockProjects = [
  {
    id: "proj1",
    name: "TechCorp Equipment Upgrade",
    description: "Complete fleet upgrade with 5 new devices and training",
    status: "active",
    projectManager: "pm1",
    projectManagerName: "Lisa Davis",
    customerId: "1",
    customerName: "TechCorp Solutions",
    startDate: "2024-12-01T00:00:00Z",
    endDate: "2025-01-15T00:00:00Z",
    estimatedBudget: 2500000, // $25,000
    completionPercentage: 65,
    taskCount: 8,
    completedTaskCount: 5,
    tags: ["equipment", "training", "large-account"],
    createdAt: "2024-11-25T00:00:00Z"
  },
  {
    id: "proj2", 
    name: "Q1 Service Campaign",
    description: "Preventive maintenance for all devices across major accounts",
    status: "planning",
    projectManager: "pm2",
    projectManagerName: "Tom Anderson",
    startDate: "2025-01-15T00:00:00Z",
    endDate: "2025-03-31T00:00:00Z",
    estimatedBudget: 1200000, // $12,000
    completionPercentage: 10,
    taskCount: 25,
    completedTaskCount: 2,
    tags: ["maintenance", "campaign"],
    createdAt: "2024-12-15T00:00:00Z"
  },
  {
    id: "proj3",
    name: "Office Relocation Project",
    description: "Coordinate equipment relocation for Global Manufacturing",
    status: "completed",
    projectManager: "pm1", 
    projectManagerName: "Lisa Davis",
    customerId: "2",
    customerName: "Global Manufacturing Inc",
    startDate: "2024-11-01T00:00:00Z",
    endDate: "2024-12-15T00:00:00Z",
    estimatedBudget: 800000, // $8,000
    actualBudget: 750000, // $7,500
    completionPercentage: 100,
    taskCount: 12,
    completedTaskCount: 12,
    tags: ["relocation", "logistics"],
    createdAt: "2024-10-15T00:00:00Z",
    completedAt: "2024-12-15T16:00:00Z"
  }
];

const mockTaskStats = {
  totalTasks: 24,
  completedTasks: 18,
  inProgressTasks: 4,
  overdueTasks: 2,
  myTasks: 8,
  avgCompletionTime: 4.2
};

const mockProjectTemplates = [
  {
    id: "template1",
    name: "Equipment Installation",
    description: "Standard template for new equipment installations",
    category: "installation",
    tasks: [
      { title: "Site survey and preparation", estimatedHours: 2, priority: "high" },
      { title: "Equipment delivery and setup", estimatedHours: 4, priority: "high" },
      { title: "Network configuration", estimatedHours: 2, priority: "medium" },
      { title: "User training", estimatedHours: 2, priority: "medium" },
      { title: "Final testing and sign-off", estimatedHours: 1, priority: "high" }
    ]
  },
  {
    id: "template2",
    name: "Service Campaign",
    description: "Template for organizing preventive maintenance campaigns",
    category: "maintenance",
    tasks: [
      { title: "Identify target devices", estimatedHours: 1, priority: "high" },
      { title: "Schedule customer appointments", estimatedHours: 3, priority: "high" },
      { title: "Prepare maintenance kits", estimatedHours: 2, priority: "medium" },
      { title: "Execute maintenance visits", estimatedHours: 20, priority: "high" },
      { title: "Update service records", estimatedHours: 2, priority: "medium" },
      { title: "Campaign completion report", estimatedHours: 1, priority: "low" }
    ]
  }
];

export function registerTaskRoutes(app: Express) {
  // Task endpoints
  app.get("/api/tasks", async (req: any, res) => {
    const view = req.query.view as string;
    const priority = req.query.priority as string;
    const status = req.query.status as string;
    
    let filteredTasks = [...mockTasks];
    
    // Apply filters
    if (priority && priority !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.priority === priority);
    }
    
    if (status && status !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.status === status);
    }
    
    // Apply view filter (in real app, would check user permissions)
    if (view === 'my-tasks') {
      // For demo, return all tasks
      filteredTasks = filteredTasks;
    }
    
    res.json(filteredTasks);
  });

  app.get("/api/tasks/stats", async (req: any, res) => {
    res.json(mockTaskStats);
  });

  app.get("/api/tasks/:id", async (req: any, res) => {
    const taskId = req.params.id;
    const task = mockTasks.find(t => t.id === taskId);
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json(task);
  });

  app.post("/api/tasks", async (req: any, res) => {
    const newTask = {
      id: (mockTasks.length + 1).toString(),
      ...req.body,
      status: "todo",
      completionPercentage: 0,
      createdAt: new Date().toISOString(),
      tags: req.body.tags || []
    };
    
    mockTasks.push(newTask);
    res.json(newTask);
  });

  app.patch("/api/tasks/:id", async (req: any, res) => {
    const taskId = req.params.id;
    const taskIndex = mockTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    const updatedTask = {
      ...mockTasks[taskIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    if (req.body.status === 'completed' && !updatedTask.completedAt) {
      updatedTask.completedAt = new Date().toISOString();
      updatedTask.completionPercentage = 100;
    }
    
    mockTasks[taskIndex] = updatedTask;
    res.json(updatedTask);
  });

  app.delete("/api/tasks/:id", async (req: any, res) => {
    const taskId = req.params.id;
    const taskIndex = mockTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    mockTasks.splice(taskIndex, 1);
    res.json({ success: true });
  });

  // Project endpoints
  app.get("/api/projects", async (req: any, res) => {
    res.json(mockProjects);
  });

  app.get("/api/projects/:id", async (req: any, res) => {
    const projectId = req.params.id;
    const project = mockProjects.find(p => p.id === projectId);
    
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    // Include project tasks
    const projectTasks = mockTasks.filter(task => task.projectId === projectId);
    
    res.json({
      ...project,
      tasks: projectTasks
    });
  });

  app.post("/api/projects", async (req: any, res) => {
    const newProject = {
      id: `proj${mockProjects.length + 1}`,
      ...req.body,
      status: "planning",
      completionPercentage: 0,
      taskCount: 0,
      completedTaskCount: 0,
      createdAt: new Date().toISOString(),
      tags: req.body.tags || []
    };
    
    mockProjects.push(newProject);
    res.json(newProject);
  });

  app.patch("/api/projects/:id", async (req: any, res) => {
    const projectId = req.params.id;
    const projectIndex = mockProjects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const updatedProject = {
      ...mockProjects[projectIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    if (req.body.status === 'completed' && !updatedProject.completedAt) {
      updatedProject.completedAt = new Date().toISOString();
      updatedProject.completionPercentage = 100;
    }
    
    mockProjects[projectIndex] = updatedProject;
    res.json(updatedProject);
  });

  // Project templates endpoints
  app.get("/api/project-templates", async (req: any, res) => {
    res.json(mockProjectTemplates);
  });

  app.post("/api/projects/:id/from-template", async (req: any, res) => {
    const { templateId } = req.body;
    const projectId = req.params.id;
    
    const template = mockProjectTemplates.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    const project = mockProjects.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    // Create tasks from template
    const createdTasks = template.tasks.map((taskTemplate, index) => ({
      id: `${projectId}-task-${index + 1}`,
      title: taskTemplate.title,
      description: "",
      status: "todo" as const,
      priority: taskTemplate.priority as any,
      projectId: projectId,
      projectName: project.name,
      estimatedHours: taskTemplate.estimatedHours,
      completionPercentage: 0,
      tags: [template.category],
      createdAt: new Date().toISOString()
    }));
    
    // Add tasks to mock data
    mockTasks.push(...createdTasks);
    
    // Update project task count
    const projectIndex = mockProjects.findIndex(p => p.id === projectId);
    mockProjects[projectIndex].taskCount = createdTasks.length;
    
    res.json({
      project: mockProjects[projectIndex],
      tasks: createdTasks
    });
  });

  // Task comments endpoints
  app.get("/api/tasks/:id/comments", async (req: any, res) => {
    // Mock comments data
    const comments = [
      {
        id: "1",
        taskId: req.params.id,
        userId: "user1",
        userName: "John Smith",
        comment: "Started working on this task. Will update progress later today.",
        createdAt: "2025-01-01T10:30:00Z"
      },
      {
        id: "2",
        taskId: req.params.id,
        userId: "user2",
        userName: "Sarah Johnson",
        comment: "Thanks for the update. Let me know if you need any additional resources.",
        createdAt: "2025-01-01T11:15:00Z"
      }
    ];
    
    res.json(comments);
  });

  app.post("/api/tasks/:id/comments", async (req: any, res) => {
    const newComment = {
      id: Date.now().toString(),
      taskId: req.params.id,
      userId: "current-user",
      userName: "Current User",
      comment: req.body.comment,
      createdAt: new Date().toISOString()
    };
    
    res.json(newComment);
  });

  // Time tracking endpoints
  app.get("/api/tasks/:id/time-entries", async (req: any, res) => {
    // Mock time entries
    const timeEntries = [
      {
        id: "1",
        taskId: req.params.id,
        userId: "user1",
        userName: "John Smith",
        description: "Initial setup and configuration",
        hours: 2.5,
        entryDate: "2025-01-01T00:00:00Z",
        createdAt: "2025-01-01T14:30:00Z"
      }
    ];
    
    res.json(timeEntries);
  });

  app.post("/api/tasks/:id/time-entries", async (req: any, res) => {
    const newTimeEntry = {
      id: Date.now().toString(),
      taskId: req.params.id,
      userId: "current-user",
      userName: "Current User",
      description: req.body.description,
      hours: req.body.hours,
      entryDate: req.body.entryDate,
      createdAt: new Date().toISOString()
    };
    
    res.json(newTimeEntry);
  });
}