import React, { useState, useRef } from 'react';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Palette,
  Upload,
  Download,
  Copy,
  Trash2,
  Plus,
  Settings,
  Eye,
  Save,
  RotateCcw,
  Type,
  Layout,
  Image as ImageIcon,
  Paintbrush,
  FileImage,
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react';

interface BrandProfile {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    logoFont: string;
    baseFontSize: number;
    headingScale: number;
    lineHeight: number;
    letterSpacing: number;
  };
  logos: {
    primary?: string;
    secondary?: string;
    icon?: string;
    watermark?: string;
  };
  layout: {
    pageMargins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    headerHeight: number;
    footerHeight: number;
    sectionSpacing: number;
    columnGap: number;
  };
  styling: {
    borderRadius: number;
    shadowStrength: number;
    gradients: Array<{
      name: string;
      colors: string[];
      direction: string;
    }>;
    patterns: Array<{
      name: string;
      url: string;
      opacity: number;
    }>;
  };
  templates: {
    coverPageLayout: 'centered' | 'left-aligned' | 'right-aligned' | 'split';
    headerStyle: 'minimal' | 'branded' | 'logo-only' | 'full';
    footerStyle: 'minimal' | 'branded' | 'contact-info' | 'none';
    sectionDividers: 'lines' | 'spacing' | 'cards' | 'none';
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const defaultBrandProfile: Omit<BrandProfile, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'New Brand Profile',
  description: 'Custom brand profile',
  colors: {
    primary: '#0066CC',
    secondary: '#4A90E2',
    accent: '#FF6B35',
    background: '#FFFFFF',
    text: '#1F2937',
    muted: '#6B7280'
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    logoFont: 'Inter',
    baseFontSize: 16,
    headingScale: 1.25,
    lineHeight: 1.6,
    letterSpacing: 0
  },
  logos: {},
  layout: {
    pageMargins: { top: 40, right: 40, bottom: 40, left: 40 },
    headerHeight: 80,
    footerHeight: 60,
    sectionSpacing: 32,
    columnGap: 24
  },
  styling: {
    borderRadius: 8,
    shadowStrength: 2,
    gradients: [
      {
        name: 'Primary Gradient',
        colors: ['#0066CC', '#4A90E2'],
        direction: '45deg'
      }
    ],
    patterns: []
  },
  templates: {
    coverPageLayout: 'centered',
    headerStyle: 'branded',
    footerStyle: 'minimal',
    sectionDividers: 'spacing'
  },
  isDefault: false
};

const fontOptions = [
  'Inter', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 
  'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Montserrat',
  'Source Sans Pro', 'Nunito', 'Playfair Display', 'Merriweather'
];

const gradientDirections = [
  '0deg', '45deg', '90deg', '135deg', '180deg', '225deg', '270deg', '315deg'
];

export default function BrandManager({
  initialProfile,
  onSave,
  onClose
}: {
  initialProfile?: BrandProfile;
  onSave: (profile: BrandProfile) => void;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<BrandProfile>(
    initialProfile || {
      ...defaultBrandProfile,
      id: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );
  const [activeTab, setActiveTab] = useState('colors');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const logoUploadRef = useRef<HTMLInputElement>(null);

  const updateProfile = (updates: Partial<BrandProfile>) => {
    setProfile(prev => ({ ...prev, ...updates, updatedAt: new Date().toISOString() }));
  };

  const updateColors = (colorKey: keyof BrandProfile['colors'], value: string) => {
    updateProfile({
      colors: { ...profile.colors, [colorKey]: value }
    });
  };

  const updateTypography = (key: keyof BrandProfile['typography'], value: any) => {
    updateProfile({
      typography: { ...profile.typography, [key]: value }
    });
  };

  const updateLayout = (key: keyof BrandProfile['layout'], value: any) => {
    updateProfile({
      layout: { ...profile.layout, [key]: value }
    });
  };

  const updateStyling = (key: keyof BrandProfile['styling'], value: any) => {
    updateProfile({
      styling: { ...profile.styling, [key]: value }
    });
  };

  const updateTemplates = (key: keyof BrandProfile['templates'], value: any) => {
    updateProfile({
      templates: { ...profile.templates, [key]: value }
    });
  };

  const handleLogoUpload = (type: keyof BrandProfile['logos']) => {
    // In a real implementation, this would handle file upload
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Create object URL for preview (in production, upload to server)
        const url = URL.createObjectURL(file);
        updateProfile({
          logos: { ...profile.logos, [type]: url }
        });
      }
    };
    input.click();
  };

  const addGradient = () => {
    const newGradient = {
      name: `Gradient ${profile.styling.gradients.length + 1}`,
      colors: [profile.colors.primary, profile.colors.secondary],
      direction: '45deg'
    };
    updateStyling('gradients', [...profile.styling.gradients, newGradient]);
  };

  const removeGradient = (index: number) => {
    const updatedGradients = profile.styling.gradients.filter((_, i) => i !== index);
    updateStyling('gradients', updatedGradients);
  };

  const generateColorPalette = () => {
    // Auto-generate complementary colors based on primary
    const primary = profile.colors.primary;
    // This is a simplified color generation - in production, use a proper color theory library
    updateColors('secondary', adjustColor(primary, 20));
    updateColors('accent', adjustColor(primary, -60));
    updateColors('muted', adjustColor(primary, 40, 0.6));
  };

  // Helper function to adjust color (simplified)
  const adjustColor = (hex: string, amount: number, opacity: number = 1) => {
    const color = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (color >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((color >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (color & 0x0000FF) + amount));
    
    if (opacity < 1) {
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  };

  const previewStyles = {
    fontFamily: profile.typography.bodyFont,
    fontSize: `${profile.baseFontSize}px`,
    lineHeight: profile.typography.lineHeight,
    color: profile.colors.text,
    backgroundColor: profile.colors.background,
    padding: `${profile.layout.pageMargins.top}px ${profile.layout.pageMargins.right}px ${profile.layout.pageMargins.bottom}px ${profile.layout.pageMargins.left}px`,
    borderRadius: `${profile.styling.borderRadius}px`,
    boxShadow: `0 ${profile.styling.shadowStrength}px ${profile.styling.shadowStrength * 2}px rgba(0,0,0,0.1)`
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Controls */}
      <div className="w-96 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Brand Manager</h2>
            <Button variant="outline" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
          <Input
            value={profile.name}
            onChange={(e) => updateProfile({ name: e.target.value })}
            placeholder="Brand profile name"
            className="mb-2"
          />
          <Textarea
            value={profile.description}
            onChange={(e) => updateProfile({ description: e.target.value })}
            placeholder="Description..."
            rows={2}
          />
        </div>

        <ScrollArea className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mx-4 mt-4">
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="typography">Type</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="style">Style</TabsTrigger>
            </TabsList>

            <div className="p-4">
              <TabsContent value="colors" className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Color Palette</Label>
                  <Button size="sm" variant="outline" onClick={generateColorPalette}>
                    <Paintbrush className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(profile.colors).map(([key, value]) => (
                    <div key={key}>
                      <Label className="text-xs capitalize">{key}</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={value}
                          onChange={(e) => updateColors(key as any, e.target.value)}
                          className="w-12 h-8 p-0 border"
                        />
                        <Input
                          type="text"
                          value={value}
                          onChange={(e) => updateColors(key as any, e.target.value)}
                          className="flex-1 h-8 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Gradients</Label>
                    <Button size="sm" variant="outline" onClick={addGradient}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {profile.styling.gradients.map((gradient, index) => (
                    <div key={index} className="space-y-2 p-3 border rounded mb-2">
                      <div className="flex justify-between items-center">
                        <Input
                          value={gradient.name}
                          onChange={(e) => {
                            const updated = [...profile.styling.gradients];
                            updated[index] = { ...gradient, name: e.target.value };
                            updateStyling('gradients', updated);
                          }}
                          className="flex-1 mr-2 text-sm"
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeGradient(index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        {gradient.colors.map((color, colorIndex) => (
                          <Input
                            key={colorIndex}
                            type="color"
                            value={color}
                            onChange={(e) => {
                              const updated = [...profile.styling.gradients];
                              updated[index].colors[colorIndex] = e.target.value;
                              updateStyling('gradients', updated);
                            }}
                            className="w-8 h-6 p-0"
                          />
                        ))}
                      </div>
                      <Select
                        value={gradient.direction}
                        onValueChange={(value) => {
                          const updated = [...profile.styling.gradients];
                          updated[index] = { ...gradient, direction: value };
                          updateStyling('gradients', updated);
                        }}
                      >
                        <SelectTrigger className="h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {gradientDirections.map(dir => (
                            <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div
                        className="h-4 rounded"
                        style={{
                          background: `linear-gradient(${gradient.direction}, ${gradient.colors.join(', ')})`
                        }}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="typography" className="space-y-4">
                <div>
                  <Label>Heading Font</Label>
                  <Select value={profile.typography.headingFont} onValueChange={(value) => updateTypography('headingFont', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map(font => (
                        <SelectItem key={font} value={font}>{font}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Body Font</Label>
                  <Select value={profile.typography.bodyFont} onValueChange={(value) => updateTypography('bodyFont', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions.map(font => (
                        <SelectItem key={font} value={font}>{font}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Base Font Size: {profile.typography.baseFontSize}px</Label>
                  <Slider
                    value={[profile.typography.baseFontSize]}
                    onValueChange={([value]) => updateTypography('baseFontSize', value)}
                    min={12}
                    max={24}
                    step={1}
                  />
                </div>

                <div>
                  <Label>Heading Scale: {profile.typography.headingScale.toFixed(2)}</Label>
                  <Slider
                    value={[profile.typography.headingScale]}
                    onValueChange={([value]) => updateTypography('headingScale', value)}
                    min={1.1}
                    max={2.0}
                    step={0.05}
                  />
                </div>

                <div>
                  <Label>Line Height: {profile.typography.lineHeight.toFixed(1)}</Label>
                  <Slider
                    value={[profile.typography.lineHeight]}
                    onValueChange={([value]) => updateTypography('lineHeight', value)}
                    min={1.2}
                    max={2.0}
                    step={0.1}
                  />
                </div>

                <div>
                  <Label>Letter Spacing: {profile.typography.letterSpacing}px</Label>
                  <Slider
                    value={[profile.typography.letterSpacing]}
                    onValueChange={([value]) => updateTypography('letterSpacing', value)}
                    min={-2}
                    max={4}
                    step={0.5}
                  />
                </div>
              </TabsContent>

              <TabsContent value="layout" className="space-y-4">
                <div>
                  <Label>Page Margins</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <Label className="text-xs">Top</Label>
                      <Input
                        type="number"
                        value={profile.layout.pageMargins.top}
                        onChange={(e) => updateLayout('pageMargins', { 
                          ...profile.layout.pageMargins, 
                          top: parseInt(e.target.value) || 0 
                        })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Right</Label>
                      <Input
                        type="number"
                        value={profile.layout.pageMargins.right}
                        onChange={(e) => updateLayout('pageMargins', { 
                          ...profile.layout.pageMargins, 
                          right: parseInt(e.target.value) || 0 
                        })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bottom</Label>
                      <Input
                        type="number"
                        value={profile.layout.pageMargins.bottom}
                        onChange={(e) => updateLayout('pageMargins', { 
                          ...profile.layout.pageMargins, 
                          bottom: parseInt(e.target.value) || 0 
                        })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Left</Label>
                      <Input
                        type="number"
                        value={profile.layout.pageMargins.left}
                        onChange={(e) => updateLayout('pageMargins', { 
                          ...profile.layout.pageMargins, 
                          left: parseInt(e.target.value) || 0 
                        })}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Header Height: {profile.layout.headerHeight}px</Label>
                  <Slider
                    value={[profile.layout.headerHeight]}
                    onValueChange={([value]) => updateLayout('headerHeight', value)}
                    min={40}
                    max={160}
                    step={8}
                  />
                </div>

                <div>
                  <Label>Footer Height: {profile.layout.footerHeight}px</Label>
                  <Slider
                    value={[profile.layout.footerHeight]}
                    onValueChange={([value]) => updateLayout('footerHeight', value)}
                    min={30}
                    max={120}
                    step={6}
                  />
                </div>

                <div>
                  <Label>Section Spacing: {profile.layout.sectionSpacing}px</Label>
                  <Slider
                    value={[profile.layout.sectionSpacing]}
                    onValueChange={([value]) => updateLayout('sectionSpacing', value)}
                    min={16}
                    max={64}
                    step={4}
                  />
                </div>

                <div>
                  <Label>Cover Page Layout</Label>
                  <Select value={profile.templates.coverPageLayout} onValueChange={(value) => updateTemplates('coverPageLayout', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="centered">Centered</SelectItem>
                      <SelectItem value="left-aligned">Left Aligned</SelectItem>
                      <SelectItem value="right-aligned">Right Aligned</SelectItem>
                      <SelectItem value="split">Split Layout</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Header Style</Label>
                  <Select value={profile.templates.headerStyle} onValueChange={(value) => updateTemplates('headerStyle', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="branded">Branded</SelectItem>
                      <SelectItem value="logo-only">Logo Only</SelectItem>
                      <SelectItem value="full">Full Header</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="style" className="space-y-4">
                <div>
                  <Label>Border Radius: {profile.styling.borderRadius}px</Label>
                  <Slider
                    value={[profile.styling.borderRadius]}
                    onValueChange={([value]) => updateStyling('borderRadius', value)}
                    min={0}
                    max={24}
                    step={2}
                  />
                </div>

                <div>
                  <Label>Shadow Strength: {profile.styling.shadowStrength}</Label>
                  <Slider
                    value={[profile.styling.shadowStrength]}
                    onValueChange={([value]) => updateStyling('shadowStrength', value)}
                    min={0}
                    max={8}
                    step={1}
                  />
                </div>

                <Separator />

                <div>
                  <Label>Logos</Label>
                  <div className="space-y-2 mt-2">
                    {Object.entries(profile.logos).map(([key, url]) => (
                      <div key={key} className="flex items-center gap-2">
                        <Label className="text-xs capitalize w-16">{key}</Label>
                        {url ? (
                          <div className="flex items-center gap-2 flex-1">
                            <OptimizedImage src={url} alt={key} className="h-8 w-8 object-contain border rounded" />
                            <Button size="sm" variant="outline" onClick={() => handleLogoUpload(key as any)}>
                              Change
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleLogoUpload(key as any)}>
                            <Upload className="h-3 w-3 mr-1" />
                            Upload
                          </Button>
                        )}
                      </div>
                    ))}
                    {!profile.logos.primary && (
                      <Button size="sm" variant="outline" onClick={() => handleLogoUpload('primary')}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Primary Logo
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Section Dividers</Label>
                  <Select value={profile.templates.sectionDividers} onValueChange={(value) => updateTemplates('sectionDividers', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lines">Lines</SelectItem>
                      <SelectItem value="spacing">Spacing Only</SelectItem>
                      <SelectItem value="cards">Cards</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setProfile({ ...defaultBrandProfile, id: profile.id, createdAt: profile.createdAt, updatedAt: new Date().toISOString() })}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={() => onSave(profile)}>
              <Save className="h-4 w-4 mr-2" />
              Save Brand
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Brand Preview</h3>
            <div className="flex gap-2">
              <div className="flex border rounded">
                <Button
                  variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                  className="rounded-r-none"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewMode === 'tablet' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('tablet')}
                  className="rounded-none"
                >
                  <Tablet className="h-4 w-4" />
                </Button>
                <Button
                  variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                  className="rounded-l-none"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-8">
          <div 
            className="bg-white shadow-lg mx-auto transition-all duration-300"
            style={{
              width: previewMode === 'desktop' ? '794px' : previewMode === 'tablet' ? '600px' : '375px',
              minHeight: '600px',
              ...previewStyles
            }}
          >
            {/* Header Preview */}
            <div
              className="border-b mb-6 flex items-center justify-between"
              style={{
                height: `${profile.layout.headerHeight}px`,
                borderColor: profile.colors.muted
              }}
            >
              {profile.logos.primary && (
                <OptimizedImage 
                  src={profile.logos.primary} 
                  alt="Logo" 
                  className="h-12 object-contain"
                />
              )}
              <div className="text-right">
                <h3 
                  style={{ 
                    fontFamily: profile.typography.headingFont,
                    fontSize: `${profile.typography.baseFontSize * profile.typography.headingScale}px`,
                    color: profile.colors.primary
                  }}
                >
                  Company Name
                </h3>
                <p style={{ color: profile.colors.muted, fontSize: '14px' }}>
                  Professional Proposal
                </p>
              </div>
            </div>

            {/* Content Preview */}
            <div style={{ marginBottom: `${profile.layout.sectionSpacing}px` }}>
              <h1
                style={{
                  fontFamily: profile.typography.headingFont,
                  fontSize: `${profile.typography.baseFontSize * Math.pow(profile.typography.headingScale, 3)}px`,
                  color: profile.colors.primary,
                  marginBottom: '16px',
                  letterSpacing: `${profile.typography.letterSpacing}px`
                }}
              >
                Proposal Title
              </h1>
              <p style={{ color: profile.colors.muted, marginBottom: '24px' }}>
                Executive Summary section with brand-consistent styling
              </p>
            </div>

            <div style={{ marginBottom: `${profile.layout.sectionSpacing}px` }}>
              <h2
                style={{
                  fontFamily: profile.typography.headingFont,
                  fontSize: `${profile.typography.baseFontSize * Math.pow(profile.typography.headingScale, 2)}px`,
                  color: profile.colors.text,
                  marginBottom: '12px',
                  letterSpacing: `${profile.typography.letterSpacing}px`
                }}
              >
                Section Heading
              </h2>
              <p style={{ lineHeight: profile.typography.lineHeight }}>
                This is a sample paragraph showing how your body text will appear with the selected typography settings. 
                The font family, size, line height, and letter spacing all work together to create a cohesive reading experience.
              </p>
            </div>

            {/* Color Palette Preview */}
            <div style={{ marginBottom: `${profile.layout.sectionSpacing}px` }}>
              <h3
                style={{
                  fontFamily: profile.typography.headingFont,
                  fontSize: `${profile.typography.baseFontSize * profile.typography.headingScale}px`,
                  color: profile.colors.text,
                  marginBottom: '12px'
                }}
              >
                Color Palette
              </h3>
              <div className="flex gap-2 mb-4">
                {Object.entries(profile.colors).map(([name, color]) => (
                  <div key={name} className="text-center">
                    <div
                      className="w-12 h-12 rounded mb-1"
                      style={{ backgroundColor: color, borderRadius: `${profile.styling.borderRadius}px` }}
                    />
                    <div className="text-xs capitalize" style={{ color: profile.colors.muted }}>
                      {name}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gradient Preview */}
            {profile.styling.gradients.length > 0 && (
              <div style={{ marginBottom: `${profile.layout.sectionSpacing}px` }}>
                <h3
                  style={{
                    fontFamily: profile.typography.headingFont,
                    fontSize: `${profile.typography.baseFontSize * profile.typography.headingScale}px`,
                    color: profile.colors.text,
                    marginBottom: '12px'
                  }}
                >
                  Gradients
                </h3>
                <div className="space-y-2">
                  {profile.styling.gradients.map((gradient, index) => (
                    <div
                      key={index}
                      className="h-8 rounded"
                      style={{
                        background: `linear-gradient(${gradient.direction}, ${gradient.colors.join(', ')})`,
                        borderRadius: `${profile.styling.borderRadius}px`
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Footer Preview */}
            <div
              className="border-t mt-8 pt-4 flex items-center justify-between text-sm"
              style={{
                height: `${profile.layout.footerHeight}px`,
                color: profile.colors.muted,
                borderColor: profile.colors.muted
              }}
            >
              <span>© 2024 Company Name. All rights reserved.</span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}