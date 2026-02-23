/**
 * RecordPageLayout - Configurable record page layout engine.
 * HubSpot-style 3-column layout: header + left properties + center timeline + right sidebar.
 * Part of CRM-008: Build configurable record page layout engine with activity timeline.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Phone,
  Mail,
  CheckSquare,
  Clock,
  Activity,
  Send,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CrmObjectType } from '@/lib/crm-object-registry';

interface RecordPageLayoutProps {
  objectType: CrmObjectType;
  recordId: string;
  record: Record<string, any>;
  /** Custom header content (stage picker, quick actions) */
  headerContent?: React.ReactNode;
  /** Custom right sidebar cards */
  sidebarCards?: React.ReactNode;
  /** Event handler for field changes */
  onFieldChange?: (field: string, value: any) => void;
}

interface LayoutSection {
  sectionId: string;
  title: string;
  position: 'header' | 'left' | 'center' | 'right';
  order: number;
  propertyFields: Array<{
    field: string;
    label: string;
    editable: boolean;
  }>;
  collapsed: boolean;
}

interface ActivityEntry {
  id: string;
  type: 'note' | 'email' | 'call' | 'task' | 'stage_change' | 'field_change';
  description: string;
  createdBy?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

// ─── Property Group Card ─────────────────────────────────────────

function PropertyGroupCard({
  section,
  record,
  onFieldChange,
}: {
  section: LayoutSection;
  record: Record<string, any>;
  onFieldChange?: (field: string, value: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(!section.collapsed);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2.5 px-3 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-sm">{section.title}</CardTitle>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="py-2 px-3 space-y-2">
            {section.propertyFields.map((field) => (
              <div key={field.field} className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted-foreground text-xs w-1/3">{field.label}</span>
                <span className="text-right w-2/3 truncate">
                  {record[field.field] !== null && record[field.field] !== undefined
                    ? String(record[field.field])
                    : '-'}
                </span>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Activity Timeline ───────────────────────────────────────────

function ActivityTimeline({
  objectType,
  recordId,
}: {
  objectType: CrmObjectType;
  recordId: string;
}) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [noteText, setNoteText] = useState('');

  const apiPath =
    objectType === 'deals'
      ? `/api/deals-management/deals/${recordId}/activities`
      : `/api/business-records/${recordId}/activities`;

  const { data: activities = [] } = useQuery<ActivityEntry[]>({
    queryKey: [apiPath],
    queryFn: async () => {
      const result = await apiRequest(apiPath);
      return Array.isArray(result) ? result : (result?.activities ?? []);
    },
    enabled: isAuthenticated && !!recordId,
    staleTime: 30_000,
  });

  const filteredActivities =
    activeTab === 'all' ? activities : activities.filter((a) => a.type === activeTab);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'note':
        return <MessageSquare className="h-3.5 w-3.5" />;
      case 'email':
        return <Mail className="h-3.5 w-3.5" />;
      case 'call':
        return <Phone className="h-3.5 w-3.5" />;
      case 'task':
        return <CheckSquare className="h-3.5 w-3.5" />;
      case 'stage_change':
        return <Activity className="h-3.5 w-3.5" />;
      default:
        return <Clock className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Compose area */}
      <Card>
        <CardContent className="p-3">
          <Tabs defaultValue="note" className="space-y-2">
            <TabsList className="h-7">
              <TabsTrigger value="note" className="text-xs h-6 px-2">
                <MessageSquare className="h-3 w-3 mr-1" />
                Note
              </TabsTrigger>
              <TabsTrigger value="email" className="text-xs h-6 px-2">
                <Mail className="h-3 w-3 mr-1" />
                Email
              </TabsTrigger>
              <TabsTrigger value="call" className="text-xs h-6 px-2">
                <Phone className="h-3 w-3 mr-1" />
                Call
              </TabsTrigger>
              <TabsTrigger value="task" className="text-xs h-6 px-2">
                <CheckSquare className="h-3 w-3 mr-1" />
                Task
              </TabsTrigger>
            </TabsList>
            <TabsContent value="note" className="space-y-2">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a note..."
                rows={2}
                className="text-sm"
              />
              <Button size="sm" className="h-7 gap-1 text-xs">
                <Send className="h-3 w-3" /> Add note
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Activity type filter */}
      <div className="flex gap-1 flex-wrap">
        {['all', 'note', 'email', 'call', 'task', 'stage_change'].map((tab) => (
          <Badge
            key={tab}
            variant={activeTab === tab ? 'default' : 'outline'}
            className="cursor-pointer text-[10px]"
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? 'All' : tab.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Badge>
        ))}
      </div>

      {/* Timeline entries */}
      <div className="space-y-2">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">No activities yet</div>
        ) : (
          filteredActivities.map((activity) => (
            <div key={activity.id} className="flex gap-3 py-2 border-b last:border-0">
              <div className="mt-0.5 text-muted-foreground">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{activity.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  {activity.createdBy && (
                    <span className="text-[10px] text-muted-foreground">{activity.createdBy}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Layout Component ───────────────────────────────────────

export function RecordPageLayout({
  objectType,
  recordId,
  record,
  headerContent,
  sidebarCards,
  onFieldChange,
}: RecordPageLayoutProps) {
  const { isAuthenticated } = useAuth();

  // Fetch layout config
  const { data: layoutConfig } = useQuery({
    queryKey: ['/api/record-layout-config', objectType],
    queryFn: () => apiRequest(`/api/record-layout-config?objectType=${objectType}`),
    enabled: isAuthenticated,
    staleTime: 300_000,
  });

  // Default sections if no config
  const sections: LayoutSection[] = Array.isArray(layoutConfig?.layoutSections)
    ? layoutConfig.layoutSections
    : getDefaultSections(objectType);
  const leftSections = sections
    .filter((s) => s.position === 'left')
    .sort((a, b) => a.order - b.order);
  const rightSections = sections
    .filter((s) => s.position === 'right')
    .sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {headerContent && <div className="px-4 py-3 border-b bg-background">{headerContent}</div>}

      {/* 3-column layout */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
          {/* Left panel - Properties */}
          <div className="lg:col-span-3 space-y-3">
            {leftSections.map((section) => (
              <PropertyGroupCard
                key={section.sectionId}
                section={section}
                record={record}
                onFieldChange={onFieldChange}
              />
            ))}
          </div>

          {/* Center panel - Activity Timeline */}
          <div className="lg:col-span-6">
            <ActivityTimeline objectType={objectType} recordId={recordId} />
          </div>

          {/* Right panel - Associated Records + Custom Cards */}
          <div className="lg:col-span-3 space-y-3">
            {rightSections.map((section) => (
              <PropertyGroupCard key={section.sectionId} section={section} record={record} />
            ))}
            {sidebarCards}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Default Sections ────────────────────────────────────────────

function getDefaultSections(objectType: CrmObjectType): LayoutSection[] {
  if (objectType === 'deals') {
    return [
      {
        sectionId: 'deal-info',
        title: 'Deal Information',
        position: 'left',
        order: 1,
        propertyFields: [
          { field: 'title', label: 'Deal Name', editable: true },
          { field: 'value', label: 'Amount', editable: true },
          { field: 'stage', label: 'Stage', editable: true },
          { field: 'probability', label: 'Probability', editable: true },
          { field: 'expectedCloseDate', label: 'Close Date', editable: true },
          { field: 'priority', label: 'Priority', editable: true },
        ],
        collapsed: false,
      },
      {
        sectionId: 'deal-owner',
        title: 'Ownership',
        position: 'left',
        order: 2,
        propertyFields: [
          { field: 'assignedToName', label: 'Owner', editable: true },
          { field: 'createdAt', label: 'Created', editable: false },
          { field: 'updatedAt', label: 'Last Modified', editable: false },
        ],
        collapsed: true,
      },
      {
        sectionId: 'associations',
        title: 'Associated Records',
        position: 'right',
        order: 1,
        propertyFields: [
          { field: 'customerName', label: 'Company', editable: false },
          { field: 'customerId', label: 'Customer ID', editable: false },
        ],
        collapsed: false,
      },
    ];
  }

  // Default for leads/contacts/companies
  return [
    {
      sectionId: 'basic-info',
      title: 'Basic Information',
      position: 'left',
      order: 1,
      propertyFields: [
        { field: 'companyName', label: 'Company', editable: true },
        { field: 'primaryContactName', label: 'Contact', editable: true },
        { field: 'primaryContactEmail', label: 'Email', editable: true },
        { field: 'primaryContactPhone', label: 'Phone', editable: true },
        { field: 'status', label: 'Status', editable: true },
        { field: 'priority', label: 'Priority', editable: true },
      ],
      collapsed: false,
    },
    {
      sectionId: 'details',
      title: 'Additional Details',
      position: 'left',
      order: 2,
      propertyFields: [
        { field: 'industry', label: 'Industry', editable: true },
        { field: 'leadSource', label: 'Source', editable: true },
        { field: 'estimatedAmount', label: 'Est. Value', editable: true },
        { field: 'createdAt', label: 'Created', editable: false },
      ],
      collapsed: true,
    },
  ];
}
