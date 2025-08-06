import React, { useState, useEffect, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  ListOrdered
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
  onUpdate 
}: { 
  section: ProposalSection;
  isSelected: boolean;
  onClick: () => void;
  onUpdate: (section: ProposalSection) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
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
      styling: { ...section.styling, [key]: value }
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative border-2 transition-all duration-200 ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-gray-300'
      } ${section.isLocked ? 'opacity-75' : ''}`}
      onClick={onClick}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <div className="bg-gray-800 text-white p-1 rounded">
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Section Controls */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
          <Settings className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
          <Copy className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="destructive" className="h-6 w-6 p-0">
          <Trash2 className="h-3 w-3" />
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
              fontSize: 'inherit'
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            className="cursor-text"
            dangerouslySetInnerHTML={{ __html: section.content || `<h3>${section.title}</h3><p>Double-click to edit content...</p>` }}
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
  onGlobalStylingUpdate 
}: {
  selectedSection: ProposalSection | null;
  onSectionUpdate: (section: ProposalSection) => void;
  globalStyling: ProposalTemplate['globalStyling'];
  onGlobalStylingUpdate: (styling: ProposalTemplate['globalStyling']) => void;
}) {
  if (!selectedSection) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Global Styling
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Primary Color</Label>
              <Input
                type="color"
                value={globalStyling.primaryColor}
                onChange={(e) => onGlobalStylingUpdate({ ...globalStyling, primaryColor: e.target.value })}
                className="h-10"
              />
            </div>
            <div>
              <Label>Secondary Color</Label>
              <Input
                type="color"
                value={globalStyling.secondaryColor}
                onChange={(e) => onGlobalStylingUpdate({ ...globalStyling, secondaryColor: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          <div>
            <Label>Font Family</Label>
            <Select value={globalStyling.fontFamily} onValueChange={(value) => onGlobalStylingUpdate({ ...globalStyling, fontFamily: value })}>
              <SelectTrigger>
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
            <Label>Page Margins</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Top"
                type="number"
                value={globalStyling.pageMargins.top}
                onChange={(e) => onGlobalStylingUpdate({
                  ...globalStyling,
                  pageMargins: { ...globalStyling.pageMargins, top: parseInt(e.target.value) || 0 }
                })}
              />
              <Input
                placeholder="Right"
                type="number"
                value={globalStyling.pageMargins.right}
                onChange={(e) => onGlobalStylingUpdate({
                  ...globalStyling,
                  pageMargins: { ...globalStyling.pageMargins, right: parseInt(e.target.value) || 0 }
                })}
              />
              <Input
                placeholder="Bottom"
                type="number"
                value={globalStyling.pageMargins.bottom}
                onChange={(e) => onGlobalStylingUpdate({
                  ...globalStyling,
                  pageMargins: { ...globalStyling.pageMargins, bottom: parseInt(e.target.value) || 0 }
                })}
              />
              <Input
                placeholder="Left"
                type="number"
                value={globalStyling.pageMargins.left}
                onChange={(e) => onGlobalStylingUpdate({
                  ...globalStyling,
                  pageMargins: { ...globalStyling.pageMargins, left: parseInt(e.target.value) || 0 }
                })}
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
      styling: { ...selectedSection.styling, [key]: value }
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
                onClick={() => handleStyleUpdate('fontWeight', selectedSection.styling.fontWeight === 'bold' ? 'normal' : 'bold')}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedSection.styling.fontStyle === 'italic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStyleUpdate('fontStyle', selectedSection.styling.fontStyle === 'italic' ? 'normal' : 'italic')}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant={selectedSection.styling.textDecoration === 'underline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStyleUpdate('textDecoration', selectedSection.styling.textDecoration === 'underline' ? 'none' : 'underline')}
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
  onPreview
}: {
  initialTemplate?: ProposalTemplate;
  quoteData?: any;
  onSave?: (template: ProposalTemplate) => void;
  onPreview?: () => void;
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
          content: '<h1>Professional Proposal</h1><p>Prepared for [Customer Name]</p>',
          styling: { fontSize: 24, fontWeight: 'bold', alignment: 'center' },
          layout: { width: '100%' },
          isVisible: true,
          isLocked: false
        },
        {
          id: 'executive',
          type: 'executive_summary',
          title: 'Executive Summary',
          content: '<h2>Executive Summary</h2><p>This proposal outlines our recommended solution...</p>',
          styling: { fontSize: 16 },
          layout: { width: '100%' },
          isVisible: true,
          isLocked: false
        }
      ],
      globalStyling: {
        primaryColor: '#0066CC',
        secondaryColor: '#4A90E2',
        accentColor: '#FF6B35',
        fontFamily: 'Inter',
        headerFont: 'Inter',
        pageMargins: { top: 20, right: 20, bottom: 20, left: 20 }
      }
    }
  );

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedSection = template.sections.find(s => s.id === selectedSectionId) || null;

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = template.sections.findIndex(s => s.id === active.id);
      const newIndex = template.sections.findIndex(s => s.id === over.id);
      const newSections = arrayMove(template.sections, oldIndex, newIndex);
      setTemplate({ ...template, sections: newSections });
    }
  };

  const handleSectionUpdate = (updatedSection: ProposalSection) => {
    const newSections = template.sections.map(s => 
      s.id === updatedSection.id ? updatedSection : s
    );
    setTemplate({ ...template, sections: newSections });
  };

  const handleAddSection = (type: string) => {
    const newSection: ProposalSection = {
      id: `section-${Date.now()}`,
      type,
      title: type.replace('_', ' ').toUpperCase(),
      content: `<h3>${type.replace('_', ' ').toUpperCase()}</h3><p>Add your content here...</p>`,
      styling: { fontSize: 16 },
      layout: { width: '100%' },
      isVisible: true,
      isLocked: false
    };
    setTemplate({ ...template, sections: [...template.sections, newSection] });
  };

  const handleDeleteSection = (sectionId: string) => {
    const newSections = template.sections.filter(s => s.id !== sectionId);
    setTemplate({ ...template, sections: newSections });
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Components & Templates */}
      <div className="w-80 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Proposal Builder</h2>
          <p className="text-sm text-muted-foreground">Drag & drop to customize</p>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Add Sections</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: 'cover_page', label: 'Cover', icon: Layout },
                  { type: 'executive_summary', label: 'Executive', icon: Eye },
                  { type: 'company_intro', label: 'About Us', icon: Type },
                  { type: 'solution_overview', label: 'Solution', icon: Settings },
                  { type: 'pricing', label: 'Pricing', icon: Type },
                  { type: 'terms', label: 'Terms', icon: Type },
                ].map(({ type, label, icon: Icon }) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="h-16 flex flex-col gap-1"
                    onClick={() => handleAddSection(type)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-sm font-medium mb-2">Sections</h3>
              <div className="space-y-2">
                {template.sections.map((section) => (
                  <div
                    key={section.id}
                    className={`p-2 rounded border cursor-pointer transition-colors ${
                      selectedSectionId === section.id ? 'bg-primary/10 border-primary' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{section.title}</span>
                      <div className="flex gap-1">
                        <Switch
                          checked={section.isVisible}
                          onCheckedChange={(checked) => 
                            handleSectionUpdate({ ...section, isVisible: checked })
                          }
                          size="sm"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSection(section.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
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
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Input
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              className="font-semibold"
            />
            <Badge variant="secondary">{template.sections.length} sections</Badge>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewMode(!previewMode)}>
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? 'Edit' : 'Preview'}
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button size="sm" onClick={() => onSave?.(template)}>
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div 
            className="bg-white shadow-lg mx-auto min-h-[800px]"
            style={{ 
              width: '794px', // A4 width at 96dpi
              padding: `${template.globalStyling.pageMargins.top}px ${template.globalStyling.pageMargins.right}px ${template.globalStyling.pageMargins.bottom}px ${template.globalStyling.pageMargins.left}px`,
              fontFamily: template.globalStyling.fontFamily
            }}
          >
            {previewMode ? (
              // Preview Mode
              <div className="space-y-4">
                {template.sections
                  .filter(section => section.isVisible)
                  .map((section) => (
                    <div
                      key={section.id}
                      className="transition-all duration-200"
                      style={{
                        backgroundColor: section.styling.backgroundColor || 'transparent',
                        color: section.styling.textColor || 'inherit',
                        fontFamily: section.styling.fontFamily || 'inherit',
                        fontSize: section.styling.fontSize ? `${section.styling.fontSize}px` : 'inherit',
                        padding: section.styling.padding ? `${section.styling.padding}px` : '16px',
                        margin: section.styling.margin ? `${section.styling.margin}px 0` : '0',
                        textAlign: section.styling.alignment || 'left',
                        fontWeight: section.styling.fontWeight || 'normal',
                        fontStyle: section.styling.fontStyle || 'normal',
                        textDecoration: section.styling.textDecoration || 'none',
                      }}
                      dangerouslySetInnerHTML={{ __html: section.content }}
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
                  items={template.sections.filter(s => s.isVisible).map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-4">
                    {template.sections
                      .filter(section => section.isVisible)
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
      <div className="w-80 bg-white border-l">
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