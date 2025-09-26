import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User, 
  Tag, 
  Brain,
  Plus,
  Filter,
  Search,
  MoreVertical,
  Play,
  Pause,
  Edit,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'asap' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  estimatedDuration: number; // in minutes
  actualDuration?: number;
  dueDate?: string;
  completionPercentage?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  tags?: string[];
  aiPriorityScore?: number;
  aiComplexityScore?: number;
  assignedTo?: string;
  createdAt: string;
  isAiGenerated?: boolean;
}

interface TaskListProps {
  className?: string;
}

export default function TaskList({ className }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTimers, setActiveTimers] = useState<Set<string>>(new Set());

  // Mock tasks data
  useEffect(() => {
    const mockTasks: Task[] = [
      {
        id: 'task-1',
        title: 'Follow up with ABC Corp lead',
        description: 'Call to discuss their copier lease requirements and answer questions about service packages',
        priority: 'high',
        status: 'pending',
        estimatedDuration: 30,
        dueDate: '2025-09-27T14:00:00Z',
        relatedEntityType: 'lead',
        relatedEntityId: 'lead-123',
        tags: ['sales', 'follow-up', 'urgent'],
        aiPriorityScore: 85,
        aiComplexityScore: 25,
        createdAt: '2025-09-26T10:00:00Z',
        assignedTo: 'current-user',
        isAiGenerated: true,
      },
      {
        id: 'task-2',
        title: 'Prepare proposal for XYZ Manufacturing',
        description: 'Create comprehensive proposal for their multifunction printer needs including cost analysis and service terms',
        priority: 'high',
        status: 'in_progress',
        estimatedDuration: 120,
        actualDuration: 45,
        dueDate: '2025-09-28T17:00:00Z',
        completionPercentage: 35,
        relatedEntityType: 'deal',
        relatedEntityId: 'deal-456',
        tags: ['proposal', 'sales', 'manufacturing'],
        aiPriorityScore: 90,
        aiComplexityScore: 75,
        createdAt: '2025-09-25T09:00:00Z',
        assignedTo: 'current-user',
        isAiGenerated: false,
      },
      {
        id: 'task-3',
        title: 'Service call - Printer maintenance',
        description: 'Routine maintenance for Canon imageRUNNER at Tech Solutions including toner replacement and cleaning',
        priority: 'medium',
        status: 'pending',
        estimatedDuration: 90,
        dueDate: '2025-09-29T10:00:00Z',
        relatedEntityType: 'service_call',
        relatedEntityId: 'service-789',
        tags: ['service', 'maintenance', 'canon'],
        aiPriorityScore: 60,
        aiComplexityScore: 40,
        createdAt: '2025-09-26T08:00:00Z',
        assignedTo: 'current-user',
        isAiGenerated: true,
      },
      {
        id: 'task-4',
        title: 'Update CRM with quarterly activities',
        description: 'Input all Q3 customer interactions, service calls, and sales activities into the CRM system',
        priority: 'low',
        status: 'pending',
        estimatedDuration: 60,
        dueDate: '2025-09-30T17:00:00Z',
        tags: ['administrative', 'crm', 'quarterly'],
        aiPriorityScore: 30,
        aiComplexityScore: 20,
        createdAt: '2025-09-24T16:00:00Z',
        assignedTo: 'current-user',
        isAiGenerated: false,
      },
      {
        id: 'task-5',
        title: 'Demo scheduling for TechStart Inc',
        description: 'Schedule and prepare demo presentation for their office printer requirements',
        priority: 'medium',
        status: 'completed',
        estimatedDuration: 45,
        actualDuration: 50,
        completionPercentage: 100,
        dueDate: '2025-09-25T15:00:00Z',
        relatedEntityType: 'lead',
        relatedEntityId: 'lead-789',
        tags: ['demo', 'sales', 'presentation'],
        aiPriorityScore: 70,
        aiComplexityScore: 50,
        createdAt: '2025-09-24T11:00:00Z',
        assignedTo: 'current-user',
        isAiGenerated: true,
      },
    ];

    setTasks(mockTasks);
    setLoading(false);
  }, []);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'asap': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDueDate = (dueDateString?: string) => {
    if (!dueDateString) return null;
    
    const dueDate = new Date(dueDateString);
    const now = new Date();
    
    if (isPast(dueDate) && !isToday(dueDate)) {
      return { text: `Overdue (${format(dueDate, 'MMM d')})`, className: 'text-red-600' };
    } else if (isToday(dueDate)) {
      return { text: `Due today (${format(dueDate, 'h:mm a')})`, className: 'text-orange-600' };
    } else if (isTomorrow(dueDate)) {
      return { text: `Due tomorrow (${format(dueDate, 'h:mm a')})`, className: 'text-yellow-600' };
    } else {
      return { text: `Due ${format(dueDate, 'MMM d, h:mm a')}`, className: 'text-gray-600' };
    }
  };

  const toggleTimer = (taskId: string) => {
    setActiveTimers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const updateTaskStatus = (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: newStatus as Task['status'], completionPercentage: newStatus === 'completed' ? 100 : task.completionPercentage }
        : task
    ));
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-pulse mx-auto mb-2" />
            <p>Loading tasks...</p>
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
            <CheckCircle2 className="mr-2 h-6 w-6" />
            Task Management
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-1" />
              Filters
            </Button>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {showFilters && (
            <div className="flex space-x-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="asap">ASAP</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No tasks found matching your criteria</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map(task => {
              const dueInfo = formatDueDate(task.dueDate);
              const isTimerActive = activeTimers.has(task.id);
              
              return (
                <div key={task.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3 flex-1">
                      <Checkbox 
                        checked={task.status === 'completed'}
                        onCheckedChange={(checked) => 
                          updateTaskStatus(task.id, checked ? 'completed' : 'pending')
                        }
                        className="mt-1"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                            {task.title}
                          </h4>
                          {task.isAiGenerated && (
                            <Brain className="h-4 w-4 text-blue-600" title="AI Generated Task" />
                          )}
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {task.estimatedDuration}min
                            {task.actualDuration && ` (${task.actualDuration}min spent)`}
                          </div>
                          
                          {dueInfo && (
                            <div className={`flex items-center ${dueInfo.className}`}>
                              <Calendar className="h-3 w-3 mr-1" />
                              {dueInfo.text}
                              {isPast(new Date(task.dueDate!)) && !isToday(new Date(task.dueDate!)) && (
                                <AlertCircle className="h-3 w-3 ml-1" />
                              )}
                            </div>
                          )}
                          
                          {task.relatedEntityType && (
                            <div className="flex items-center">
                              <Tag className="h-3 w-3 mr-1" />
                              {task.relatedEntityType}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Badge variant="outline" className={getPriorityColor(task.priority)}>
                        {task.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(task.status)}>
                        {task.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Progress bar for in-progress tasks */}
                  {task.status === 'in_progress' && task.completionPercentage !== undefined && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="text-gray-600">{task.completionPercentage}%</span>
                      </div>
                      <Progress value={task.completionPercentage} className="h-2" />
                    </div>
                  )}

                  {/* AI Scores */}
                  {(task.aiPriorityScore || task.aiComplexityScore) && (
                    <div className="mb-3 p-2 bg-blue-50 rounded text-sm">
                      <div className="flex items-center space-x-4">
                        <Brain className="h-4 w-4 text-blue-600" />
                        <span className="text-blue-800">AI Analysis:</span>
                        {task.aiPriorityScore && (
                          <span>Priority Score: {task.aiPriorityScore}/100</span>
                        )}
                        {task.aiComplexityScore && (
                          <span>Complexity: {task.aiComplexityScore}/100</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {task.tags && task.tags.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleTimer(task.id)}
                        className={isTimerActive ? 'bg-green-50 border-green-200' : ''}
                      >
                        {isTimerActive ? (
                          <>
                            <Pause className="h-3 w-3 mr-1" />
                            Stop Timer
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            Start Timer
                          </>
                        )}
                      </Button>
                      
                      {task.status !== 'completed' && (
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>

                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
