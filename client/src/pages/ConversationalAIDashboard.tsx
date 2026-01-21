// client/src/pages/ConversationalAIDashboard.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Send,
  Bot,
  User,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Search,
  FileText,
  Calendar,
  BarChart,
  Settings,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
  Zap,
  Brain,
  Target,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: Action[];
  suggestions?: string[];
  confidence?: number;
  processing?: boolean;
  feedback?: 'helpful' | 'not_helpful' | null;
}

interface Action {
  id: string;
  type: string;
  name: string;
  description: string;
  parameters: any;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  requiresConfirmation: boolean;
  result?: any;
}

interface Conversation {
  id: string;
  title: string;
  type: string;
  lastActivity: Date;
  messageCount: number;
  summary?: string;
}

interface Capability {
  name: string;
  type: string;
  description: string;
  enabled: boolean;
}

const mockMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content:
      "Hello! I'm your AI assistant. I can help you with searching information, creating documents, scheduling meetings, analyzing data, and managing tasks. What would you like to work on today?",
    timestamp: new Date(Date.now() - 300000),
    suggestions: [
      'Help me search for information',
      'Create a new document',
      'Schedule a meeting',
      'Analyze my data',
      'Manage my tasks',
    ],
  },
];

const mockConversations: Conversation[] = [
  {
    id: '1',
    title: 'General Assistance',
    type: 'general',
    lastActivity: new Date(),
    messageCount: 8,
    summary: 'Discussed document creation and meeting scheduling',
  },
  {
    id: '2',
    title: 'Data Analysis Help',
    type: 'analysis',
    lastActivity: new Date(Date.now() - 3600000),
    messageCount: 12,
    summary: 'Analyzed Q3 sales data and generated insights',
  },
  {
    id: '3',
    title: 'Meeting Preparation',
    type: 'meeting_prep',
    lastActivity: new Date(Date.now() - 7200000),
    messageCount: 6,
    summary: 'Prepared agenda and scheduled follow-up meetings',
  },
];

const mockCapabilities: Capability[] = [
  {
    name: 'semantic_search',
    type: 'search',
    description: 'Search across documents and knowledge base',
    enabled: true,
  },
  {
    name: 'create_document',
    type: 'creation',
    description: 'Create new documents with AI assistance',
    enabled: true,
  },
  {
    name: 'schedule_meeting',
    type: 'automation',
    description: 'Schedule meetings and calendar events',
    enabled: true,
  },
  {
    name: 'analyze_data',
    type: 'analysis',
    description: 'Analyze business data and generate insights',
    enabled: true,
  },
  {
    name: 'manage_tasks',
    type: 'automation',
    description: 'Create, update, and manage tasks',
    enabled: true,
  },
];

const ConversationalAIDashboard: React.FC = () => {
  const [currentConversation, setCurrentConversation] = useState<string>('1');
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [capabilities, setCapabilities] = useState<Capability[]>(mockCapabilities);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Simulate AI processing
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateMockResponse(inputMessage),
        timestamp: new Date(),
        confidence: 0.92,
        actions: generateMockActions(inputMessage),
        suggestions: [
          'Tell me more about this',
          'Show me related information',
          'Create a document about this',
        ],
      };

      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
  };

  const generateMockResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();

    if (lowerInput.includes('search') || lowerInput.includes('find')) {
      return "I'll help you search for that information. I can search across your documents, meeting notes, and knowledge base using semantic search to find the most relevant results. What specific information are you looking for?";
    } else if (lowerInput.includes('document') || lowerInput.includes('create')) {
      return "I can help you create a new document with AI assistance. I'll generate content based on your requirements and can use templates or existing knowledge to create comprehensive documents. What type of document would you like to create?";
    } else if (lowerInput.includes('meeting') || lowerInput.includes('schedule')) {
      return "I'll assist you with scheduling a meeting. I can check participant availability, suggest optimal times, and send calendar invitations. I can also help prepare meeting agendas and materials. Who would you like to meet with and what's the purpose of the meeting?";
    } else if (lowerInput.includes('data') || lowerInput.includes('analyze')) {
      return 'I can analyze your business data and provide insights. I have access to your sales data, customer information, and performance metrics. What specific data would you like me to analyze, and what kind of insights are you looking for?';
    } else if (lowerInput.includes('task') || lowerInput.includes('manage')) {
      return "I'll help you manage your tasks and projects. I can create new tasks, update existing ones, set priorities and deadlines, and even suggest optimal scheduling based on your workload. What tasks would you like me to help you with?";
    } else {
      return "I understand you're looking for assistance. I can help with searching information, creating documents, scheduling meetings, analyzing data, and managing tasks. Could you provide more details about what you'd like to accomplish?";
    }
  };

  const generateMockActions = (input: string): Action[] => {
    const lowerInput = input.toLowerCase();
    const actions: Action[] = [];

    if (lowerInput.includes('search')) {
      actions.push({
        id: 'search-1',
        type: 'search',
        name: 'semantic_search',
        description: 'Search across documents and knowledge base',
        parameters: { query: input, maxResults: 10 },
        status: 'pending',
        requiresConfirmation: false,
      });
    }

    if (lowerInput.includes('document') || lowerInput.includes('create')) {
      actions.push({
        id: 'create-1',
        type: 'creation',
        name: 'create_document',
        description: 'Create a new document with AI assistance',
        parameters: { title: 'New Document', type: 'general', content: input },
        status: 'pending',
        requiresConfirmation: true,
      });
    }

    if (lowerInput.includes('meeting') || lowerInput.includes('schedule')) {
      actions.push({
        id: 'meeting-1',
        type: 'automation',
        name: 'schedule_meeting',
        description: 'Schedule a new meeting',
        parameters: { title: 'Team Meeting', duration: 60 },
        status: 'pending',
        requiresConfirmation: true,
      });
    }

    return actions;
  };

  const handleActionConfirmation = (actionId: string, approved: boolean) => {
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        actions: msg.actions?.map((action) =>
          action.id === actionId
            ? { ...action, status: approved ? 'executing' : 'rejected' }
            : action,
        ),
      })),
    );

    // Simulate action execution
    if (approved) {
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            actions: msg.actions?.map((action) =>
              action.id === actionId
                ? {
                    ...action,
                    status: 'completed',
                    result: { success: true, message: 'Action completed successfully' },
                  }
                : action,
            ),
          })),
        );
      }, 2000);
    }
  };

  const handleMessageFeedback = (messageId: string, feedback: 'helpful' | 'not_helpful') => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, feedback } : msg)));
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'search':
        return <Search className="h-4 w-4" />;
      case 'creation':
        return <FileText className="h-4 w-4" />;
      case 'automation':
        return <Calendar className="h-4 w-4" />;
      case 'analysis':
        return <BarChart className="h-4 w-4" />;
      default:
        return <Zap className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'executing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderMessage = (message: Message) => (
    <div
      key={message.id}
      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {message.role === 'assistant' && (
        <Avatar className="h-8 w-8">
          <AvatarFallback>
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`max-w-[70%] ${message.role === 'user' ? 'order-first' : ''}`}>
        <div
          className={`rounded-lg p-3 ${
            message.role === 'user' ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-100 text-gray-900'
          }`}
        >
          <p className="text-sm">{message.content}</p>

          {message.confidence && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs opacity-70">Confidence:</span>
              <Progress value={message.confidence * 100} className="w-16 h-1" />
              <span className="text-xs opacity-70">{(message.confidence * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.actions.map((action) => (
              <Card key={action.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getActionIcon(action.type)}
                    <div>
                      <p className="text-sm font-medium">{action.description}</p>
                      <Badge className={`text-xs ${getStatusColor(action.status)}`}>
                        {action.status}
                      </Badge>
                    </div>
                  </div>

                  {action.requiresConfirmation && action.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActionConfirmation(action.id, false)}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => handleActionConfirmation(action.id, true)}>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                    </div>
                  )}

                  {action.status === 'executing' && (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-gray-600">Executing...</span>
                    </div>
                  )}
                </div>

                {action.result && (
                  <Alert className="mt-2">
                    <AlertDescription>{action.result.message}</AlertDescription>
                  </Alert>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setInputMessage(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}

        {/* Message feedback */}
        {message.role === 'assistant' && (
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${message.feedback === 'helpful' ? 'text-green-600' : 'text-gray-400'}`}
              onClick={() => handleMessageFeedback(message.id, 'helpful')}
            >
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 ${message.feedback === 'not_helpful' ? 'text-red-600' : 'text-gray-400'}`}
              onClick={() => handleMessageFeedback(message.id, 'not_helpful')}
            >
              <ThumbsDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-1">{message.timestamp.toLocaleTimeString()}</p>
      </div>

      {message.role === 'user' && (
        <Avatar className="h-8 w-8">
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );

  return (
    <MainLayout
      title="Conversation AI"
      description="Advanced conversational AI dashboard for customer interactions and support automation"
    >
      <div className="h-[calc(100vh-12rem)] flex">
        {/* Sidebar */}
        <div className="w-80 border-r bg-gray-50 flex flex-col">
          <Tabs defaultValue="conversations" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 m-2">
              <TabsTrigger value="conversations">
                <MessageSquare className="h-4 w-4 mr-1" />
                Chats
              </TabsTrigger>
              <TabsTrigger value="capabilities">
                <Sparkles className="h-4 w-4 mr-1" />
                Features
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conversations" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  <Button className="w-full justify-start" variant="outline">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    New Conversation
                  </Button>
                  <Separator />
                  {conversations.map((conv) => (
                    <Card
                      key={conv.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        currentConversation === conv.id
                          ? 'ring-2 ring-blue-500'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setCurrentConversation(conv.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{conv.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{conv.summary}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {conv.messageCount} messages
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {conv.lastActivity.toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="capabilities" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  {capabilities.map((capability) => (
                    <Card key={capability.name} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getActionIcon(capability.type)}
                          <div>
                            <p className="font-medium text-sm">
                              {capability.name.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-gray-600">{capability.description}</p>
                          </div>
                        </div>
                        <Badge variant={capability.enabled ? 'default' : 'secondary'}>
                          {capability.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">AI Assistant Chat</h2>
                <p className="text-sm text-gray-600">
                  Ask questions, request actions, and get intelligent assistance
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  Online
                </Badge>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map(renderMessage)}
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-gray-600">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask me anything or request an action..."
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="h-[60px]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Press Enter to send, Shift+Enter for new line</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-3 w-3 text-green-500" />
                <span className="text-xs text-gray-500">AI Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ConversationalAIDashboard;
