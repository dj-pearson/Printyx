import React, { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sanitizeRichHtml } from '@/lib/sanitize-html';
import { STARTER_SECTIONS } from '@/lib/proposal/starter-sections';
import {
  MERGE_FIELDS,
  MERGE_FIELD_GROUPS,
  renderWithSampleData,
} from '@shared/proposal-merge-fields';
import { Button } from '@/components/ui/button';
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
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GripVertical,
  Plus,
  Trash2,
  Eye,
  Settings,
  Palette,
  Type,
  Layout,
  Image,
  Download,
  Save,
  Copy,
  RotateCcw,
  Maximize,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
} from 'lucide-react';

interface ProposalSection {
  id: string;
  type: string;
  title: string;
  content: string;
  styling: {
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    fontSize?: number;
    padding?: number;
    margin?: number;
    alignment?: 'left' | 'center' | 'right';
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline';
  };
  layout: {
    width?: string;
    height?: string;
    position?: 'relative' | 'absolute';
    top?: number;
    left?: number;
    zIndex?: number;
  };
  isVisible: boolean;
  isLocked: boolean;
}

interface ProposalTemplate {
  id: string;
  name: string;
  description: string;
  sections: ProposalSection[];
  globalStyling: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    headerFont: string;
    logoUrl?: string;
    backgroundImage?: string;
    pageMargins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
}

// Sortable Section Component
function SortableSection({
  section,
  isSelected,
  onClick,
  onUpdate,
}: {
  section: ProposalSection;
  isSelected: boolean;
  onClick: () => void;
  onUpdate: (section: ProposalSection) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const [isEditing, setIsEditing] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContentChange = (content: string) => {
    onUpdate({ ...section, content });
  };

  const handleStyleUpdate = (key: string, value: any) => {
    onUpdate({
      ...section,
      styling: { ...section.styling, [key]: value },
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative border-2 transition-all duration-200 touch-manipulation ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-transparent hover:border-gray-300 active:border-gray-400'
      } ${section.isLocked ? 'opacity-75' : ''}`}
      onClick={onClick}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-manipulation"
      >
        <div className="bg-gray-800 text-white p-2 rounded min-w-[44px] min-h-[44px] flex items-center justify-center">
          <GripVertical className="h-5 w-5" />
        </div>
      </div>

      {/* Section Controls */}
      <div className="absolute top-2 right-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 sm:h-10 sm:w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 w-8 sm:h-10 sm:w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 w-8 sm:h-10 sm:w-10 p-0 touch-manipulation active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Section Content */}
      <div
        className="p-4 min-h-[100px] rounded"
        style={{
          backgroundColor: section.styling.backgroundColor || 'transparent',
          color: section.styling.textColor || 'inherit',
          fontFamily: section.styling.fontFamily || 'inherit',
          fontSize: section.styling.fontSize ? `${section.styling.fontSize}px` : 'inherit',
          padding: section.styling.padding ? `${section.styling.padding}px` : '16px',
          textAlign: section.styling.alignment || 'left',
          fontWeight: section.styling.fontWeight || 'normal',
          fontStyle: section.styling.fontStyle || 'normal',
          textDecoration: section.styling.textDecoration || 'none',
        }}
      >
        {isEditing ? (
          <Textarea
            value={section.content}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            autoFocus
            className="min-h-[60px] resize-none border-none p-0 focus-visible:ring-0"
            style={{
              backgroundColor: 'transparent',
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            className="cursor-text"
            dangerouslySetInnerHTML={{
              __html: sanitizeRichHtml(
                section.content ||
                  `<h3>${(section.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</h3><p>Double-click to edit content...</p>`,
              ),
            }}
          />
        )}
      </div>

      {/* Section Type Badge */}
      <Badge variant="secondary" className="absolute bottom-2 left-2 text-xs">
        {section.type.replace('_', ' ')}
      </Badge>
    </div>
  );
}

// Style Panel Component
function StylePanel({
  selectedSection,
  onSectionUpdate,
  globalStyling,
  onGlobalStylingUpdate,
}: {
  selectedSection: ProposalSection | null;
  onSectionUpdate: (section: ProposalSection) => void;
  globalStyling: ProposalTemplate['globalStyling'];
  onGlobalStylingUpdate: (styling: ProposalTemplate['globalStyling']) => void;
}) {
  const [fieldToInsert, setFieldToInsert] = useState('');

  if (!selectedSection) {
    return (
      <Card className="h-full border-0 sm:border">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
            Global Styling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs sm:text-sm">Primary Color</Label>
              <Input
                type="color"
                value={globalStyling.primaryColor}
                onChange={(e) =>
                  onGlobalStylingUpdate({ ...globalStyling, primaryColor: e.target.value })
                }
                className="h-12 touch-manipulation"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Secondary Color</Label>
              <Input
                type="color"
                value={globalStyling.secondaryColor}
                onChange={(e) =>
                  onGlobalStylingUpdate({ ...globalStyling, secondaryColor: e.target.value })
                }
                className="h-12 touch-manipulation"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Font Family</Label>
            <Select
              value={globalStyling.fontFamily}
              onValueChange={(value) =>
                onGlobalStylingUpdate({ ...globalStyling, fontFamily: value })
              }
            >
              <SelectTrigger className="touch-manipulation min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter">Inter</SelectItem>
                <SelectItem value="Arial">Arial</SelectItem>
                <SelectItem value="Helvetica">Helvetica</SelectItem>
                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                <SelectItem value="Georgia">Georgia</SelectItem>
                <SelectItem value="Roboto">Roboto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Page Margins</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Top"
                type="number"
                value={globalStyling.pageMargins.top}
                onChange={(e) =>
                  onGlobalStylingUpdate({
                    ...globalStyling,
                    pageMargins: {
                      ...globalStyling.pageMargins,
                      top: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="touch-manipulation min-h-[44px]"
              />
              <Input
                placeholder="Right"
                type="number"
                value={globalStyling.pageMargins.right}
                onChange={(e) =>
                  onGlobalStylingUpdate({
                    ...globalStyling,
                    pageMargins: {
                      ...globalStyling.pageMargins,
                      right: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="touch-manipulation min-h-[44px]"
              />
              <Input
                placeholder="Bottom"
                type="number"
                value={globalStyling.pageMargins.bottom}
                onChange={(e) =>
                  onGlobalStylingUpdate({
                    ...globalStyling,
                    pageMargins: {
                      ...globalStyling.pageMargins,
                      bottom: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="touch-manipulation min-h-[44px]"
              />
              <Input
                placeholder="Left"
                type="number"
                value={globalStyling.pageMargins.left}
                onChange={(e) =>
                  onGlobalStylingUpdate({
                    ...globalStyling,
                    pageMargins: {
                      ...globalStyling.pageMargins,
                      left: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className="touch-manipulation min-h-[44px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleStyleUpdate = (key: string, value: any) => {
    onSectionUpdate({
      ...selectedSection,
      styling: { ...selectedSection.styling, [key]: value },
    });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          Section Styling
        </CardTitle>
        <p className="text-sm text-muted-foreground">{selectedSection.title}</p>
      </CardHeader>
      <CardContent>
        {/* Content + merge-field insertion (PROP-004) */}
        <div className="space-y-2 mb-4">
          <Label className="text-xs sm:text-sm">Content</Label>
          <Textarea
            value={selectedSection.content}
            onChange={(e) => onSectionUpdate({ ...selectedSection, content: e.target.value })}
            rows={6}
            className="font-mono text-xs touch-manipulation"
            placeholder="HTML content with {{merge.tokens}}"
          />
          <div className="flex gap-2">
            <Select value={fieldToInsert} onValueChange={setFieldToInsert}>
              <SelectTrigger className="flex-1 min-h-[40px] text-xs">
                <SelectValue placeholder="Insert a field…" />
              </SelectTrigger>
              <SelectContent>
                {MERGE_FIELD_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                      {g.label}
                    </div>
                    {MERGE_FIELDS.filter((f) => f.group === g.group).map((f) => (
                      <SelectItem key={f.token} value={f.token} className="text-xs">
                        {f.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={!fieldToInsert}
              onClick={() => {
                if (!fieldToInsert) return;
                onSectionUpdate({
                  ...selectedSection,
                  content: `${selectedSection.content ?? ''}${fieldToInsert}`,
                });
                setFieldToInsert('');
              }}
              className="min-h-[40px]"
            >
              <Plus className="h-4 w-4 mr-1" /> Insert
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Tokens like <code className="bg-muted px-1 rounded">{'{{customer.companyName}}'}</code>{' '}
            fill in per quote. Use Preview to see sample values.
          </p>
        </div>

        <Tabs defaultValue="typography">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="typography">Text</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="colors">Colors</TabsTrigger>
          </TabsList>

          <TabsContent value="typography" className="space-y-4">
            <div>
              <Label>Font Family</Label>
              <Select
                value={selectedSection.styling.fontFamily || 'inherit'}
                onValueChange={(value) => handleStyleUpdate('fontFamily', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Inherit</SelectItem>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Font Size: {selectedSection.styling.fontSize || 16}px</Label>
              <Slider
                value={[selectedSection.styling.fontSize || 16]}
                onValueChange={([value]) => handleStyleUpdate('fontSize', value)}
                max={72}
                min={8}
                step={1}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={selectedSection.styling.fontWeight === 'bold' ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  handleStyleUpdate(
                    'fontWeight',
                    selectedSection.styling.fontWeight === 'bold' ? 'normal' : 'bold',
                  )
                }
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedSection.styling.fontStyle === 'italic' ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  handleStyleUpdate(
                    'fontStyle',
                    selectedSection.styling.fontStyle === 'italic' ? 'normal' : 'italic',
                  )
                }
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant={
                  selectedSection.styling.textDecoration === 'underline' ? 'default' : 'outline'
                }
                size="sm"
                onClick={() =>
                  handleStyleUpdate(
                    'textDecoration',
                    selectedSection.styling.textDecoration === 'underline' ? 'none' : 'underline',
                  )
                }
              >
                <Underline className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-1">
              <Button
                variant={selectedSection.styling.alignment === 'left' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStyleUpdate('alignment', 'left')}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedSection.styling.alignment === 'center' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStyleUpdate('alignment', 'center')}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedSection.styling.alignment === 'right' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStyleUpdate('alignment', 'right')}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="space-y-4">
            <div>
              <Label>Padding: {selectedSection.styling.padding || 16}px</Label>
              <Slider
                value={[selectedSection.styling.padding || 16]}
                onValueChange={([value]) => handleStyleUpdate('padding', value)}
                max={80}
                min={0}
                step={4}
              />
            </div>

            <div>
              <Label>Margin: {selectedSection.styling.margin || 0}px</Label>
              <Slider
                value={[selectedSection.styling.margin || 0]}
                onValueChange={([value]) => handleStyleUpdate('margin', value)}
                max={40}
                min={0}
                step={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="colors" className="space-y-4">
            <div>
              <Label>Text Color</Label>
              <Input
                type="color"
                value={selectedSection.styling.textColor || '#000000'}
                onChange={(e) => handleStyleUpdate('textColor', e.target.value)}
                className="h-10"
              />
            </div>

            <div>
              <Label>Background Color</Label>
              <Input
                type="color"
                value={selectedSection.styling.backgroundColor || '#ffffff'}
                onChange={(e) => handleStyleUpdate('backgroundColor', e.target.value)}
                className="h-10"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Main Visual Builder Component
export default function ProposalVisualBuilder({
  initialTemplate,
  quoteData,
  onSave,
  onPreview,
  brandingDefaults,
  saving = false,
}: {
  initialTemplate?: ProposalTemplate;
  quoteData?: any;
  onSave?: (template: ProposalTemplate) => void;
  onPreview?: () => void;
  // PROP-004: seed a new template's global styling from the tenant's default brand.
  brandingDefaults?: Partial<ProposalTemplate['globalStyling']>;
  saving?: boolean;
}) {
  const [template, setTemplate] = useState<ProposalTemplate>(
    initialTemplate || {
      id: 'new',
      name: 'Untitled Proposal',
      description: 'Custom proposal template',
      sections: [
        {
          id: 'cover',
          type: 'cover_page',
          title: 'Cover Page',
          content: STARTER_SECTIONS.find((s) => s.type === 'cover_page')!.content,
          styling: { fontSize: 24, fontWeight: 'bold', alignment: 'center' },
          layout: { width: '100%' },
          isVisible: true,
          isLocked: false,
        },
        {
          id: 'executive',
          type: 'executive_summary',
          title: 'Executive Summary',
          content: STARTER_SECTIONS.find((s) => s.type === 'executive_summary')!.content,
          styling: { fontSize: 16 },
          layout: { width: '100%' },
          isVisible: true,
          isLocked: false,
        },
      ],
      globalStyling: {
        primaryColor: brandingDefaults?.primaryColor ?? '#0066CC',
        secondaryColor: brandingDefaults?.secondaryColor ?? '#4A90E2',
        accentColor: brandingDefaults?.accentColor ?? '#FF6B35',
        fontFamily: brandingDefaults?.fontFamily ?? 'Inter',
        headerFont: brandingDefaults?.headerFont ?? 'Inter',
        logoUrl: brandingDefaults?.logoUrl,
        pageMargins: { top: 20, right: 20, bottom: 20, left: 20 },
      },
    },
  );

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Re-hydrate when a different template is loaded into the editor.
  useEffect(() => {
    if (initialTemplate) setTemplate(initialTemplate);
  }, [initialTemplate?.id]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedSection = template.sections.find((s) => s.id === selectedSectionId) || null;

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = template.sections.findIndex((s) => s.id === active.id);
      const newIndex = template.sections.findIndex((s) => s.id === over.id);
      const newSections = arrayMove(template.sections, oldIndex, newIndex);
      setTemplate({ ...template, sections: newSections });
    }
  };

  const handleSectionUpdate = (updatedSection: ProposalSection) => {
    const newSections = template.sections.map((s) =>
      s.id === updatedSection.id ? updatedSection : s,
    );
    setTemplate({ ...template, sections: newSections });
  };

  const handleAddSection = (type: string) => {
    const starter = STARTER_SECTIONS.find((s) => s.type === type);
    const newSection: ProposalSection = {
      id: `section-${Date.now()}`,
      type,
      title: starter?.title ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      content:
        starter?.content ?? `<h3>${type.replace(/_/g, ' ')}</h3><p>Add your content here...</p>`,
      styling: { fontSize: 16 },
      layout: { width: '100%' },
      isVisible: true,
      isLocked: false,
    };
    setTemplate({ ...template, sections: [...template.sections, newSection] });
  };

  const handleDeleteSection = (sectionId: string) => {
    const newSections = template.sections.filter((s) => s.id !== sectionId);
    setTemplate({ ...template, sections: newSections });
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  };

  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50">
      {/* Left Sidebar - Components & Templates */}
      <div
        className={`${showLeftSidebar ? 'block' : 'hidden'} lg:block w-full lg:w-80 bg-white border-b lg:border-r lg:border-b-0 flex flex-col max-h-[40vh] lg:max-h-none overflow-y-auto lg:overflow-visible`}
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Proposal Builder</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Drag & drop to customize</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLeftSidebar(false)}
              className="lg:hidden touch-manipulation active:scale-[0.98] min-h-[44px] min-w-[44px]"
            >
              ×
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-xs sm:text-sm font-medium mb-2">Section Library</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                {STARTER_SECTIONS.map((s) => (
                  <Button
                    key={s.type}
                    variant="outline"
                    size="sm"
                    className="h-16 flex flex-col gap-1 touch-manipulation active:scale-[0.98]"
                    onClick={() => handleAddSection(s.type)}
                    title={`Insert a ${s.label} section`}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-xs text-center leading-tight">{s.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-xs sm:text-sm font-medium mb-2">Sections</h3>
              <div className="space-y-2">
                {template.sections.map((section) => (
                  <div
                    key={section.id}
                    className={`p-2 sm:p-3 rounded border cursor-pointer transition-colors touch-manipulation ${
                      selectedSectionId === section.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-gray-50 active:bg-gray-100'
                    }`}
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-medium truncate">
                        {section.title}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        <Switch
                          checked={section.isVisible}
                          onCheckedChange={(checked) =>
                            handleSectionUpdate({ ...section, isVisible: checked })
                          }
                          className="touch-manipulation"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 touch-manipulation active:scale-[0.98]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSection(section.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Toolbar */}
        <div className="bg-white border-b p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
          {/* Mobile Toggle Buttons */}
          <div className="flex gap-2 lg:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLeftSidebar(!showLeftSidebar)}
              className="flex-1 touch-manipulation active:scale-[0.98] min-h-[44px]"
            >
              <Layout className="h-4 w-4 mr-2" />
              Sections
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRightSidebar(!showRightSidebar)}
              className="flex-1 touch-manipulation active:scale-[0.98] min-h-[44px]"
            >
              <Palette className="h-4 w-4 mr-2" />
              Styling
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2 sm:flex-1">
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                className="font-semibold text-sm sm:text-base touch-manipulation min-h-[44px]"
              />
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                {template.sections.length} sections
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
                className="flex-1 sm:flex-initial touch-manipulation active:scale-[0.98] min-h-[44px]"
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewMode ? 'Edit' : 'Preview'}
              </Button>
              {/* PROP-007: no "Export PDF" here — a template has merge tokens, not a
                  concrete proposal. PDF export lives on a generated proposal. */}
              <Button
                size="sm"
                onClick={() => onSave?.(template)}
                disabled={saving}
                className="w-full sm:w-auto touch-manipulation active:scale-[0.98] min-h-[44px]"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving…' : 'Save Template'}
              </Button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-gray-100 p-2 sm:p-4 lg:p-8">
          <div
            className="bg-white shadow-lg mx-auto min-h-[600px] sm:min-h-[800px]"
            style={{
              width: '100%',
              maxWidth: '794px', // A4 width at 96dpi
              padding: `${Math.max(12, template.globalStyling.pageMargins.top * 0.75)}px ${Math.max(12, template.globalStyling.pageMargins.right * 0.75)}px ${Math.max(12, template.globalStyling.pageMargins.bottom * 0.75)}px ${Math.max(12, template.globalStyling.pageMargins.left * 0.75)}px`,
              fontFamily: template.globalStyling.fontFamily,
            }}
          >
            {previewMode ? (
              // Preview Mode
              <div className="space-y-4">
                {template.sections
                  .filter((section) => section.isVisible)
                  .map((section) => (
                    <div
                      key={section.id}
                      className="transition-all duration-200"
                      style={{
                        backgroundColor: section.styling.backgroundColor || 'transparent',
                        color: section.styling.textColor || 'inherit',
                        fontFamily: section.styling.fontFamily || 'inherit',
                        fontSize: section.styling.fontSize
                          ? `${section.styling.fontSize}px`
                          : 'inherit',
                        padding: section.styling.padding ? `${section.styling.padding}px` : '16px',
                        margin: section.styling.margin ? `${section.styling.margin}px 0` : '0',
                        textAlign: section.styling.alignment || 'left',
                        fontWeight: section.styling.fontWeight || 'normal',
                        fontStyle: section.styling.fontStyle || 'normal',
                        textDecoration: section.styling.textDecoration || 'none',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichHtml(renderWithSampleData(section.content)),
                      }}
                    />
                  ))}
              </div>
            ) : (
              // Edit Mode
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={template.sections.filter((s) => s.isVisible).map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {template.sections
                      .filter((section) => section.isVisible)
                      .map((section) => (
                        <SortableSection
                          key={section.id}
                          section={section}
                          isSelected={selectedSectionId === section.id}
                          onClick={() => setSelectedSectionId(section.id)}
                          onUpdate={handleSectionUpdate}
                        />
                      ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div
        className={`${showRightSidebar ? 'block' : 'hidden'} lg:block w-full lg:w-80 bg-white border-t lg:border-l lg:border-t-0 max-h-[40vh] lg:max-h-none overflow-y-auto`}
      >
        <div className="lg:hidden p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Styling</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRightSidebar(false)}
            className="touch-manipulation active:scale-[0.98] min-h-[44px] min-w-[44px]"
          >
            ×
          </Button>
        </div>
        <StylePanel
          selectedSection={selectedSection}
          onSectionUpdate={handleSectionUpdate}
          globalStyling={template.globalStyling}
          onGlobalStylingUpdate={(styling) => setTemplate({ ...template, globalStyling: styling })}
        />
      </div>
    </div>
  );
}
