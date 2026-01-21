import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BookOpen,
  ListChecks,
  FileText,
  AlertCircle,
  Award,
  HelpCircle,
  Rocket,
  Check,
  Clock,
  GraduationCap,
} from 'lucide-react';

interface ArticleTemplate {
  id: string;
  name: string;
  description: string;
  contentType: string;
  recommendedDifficulty: string;
  estimatedReadingTime: number;
  icon: React.ReactNode;
  sectionCount: number;
  useCases: string[];
}

const templates: ArticleTemplate[] = [
  {
    id: 'tutorial',
    name: 'Tutorial Template',
    description:
      'Step-by-step guide teaching a specific skill or workflow with prerequisites and verification steps',
    contentType: 'tutorial',
    recommendedDifficulty: 'beginner',
    estimatedReadingTime: 10,
    icon: <GraduationCap className="h-5 w-5" />,
    sectionCount: 15,
    useCases: ['Teaching new features', 'Onboarding guides', 'Skill development'],
  },
  {
    id: 'howTo',
    name: 'How-To Guide',
    description: 'Quick, focused guide for accomplishing a specific task with concise action steps',
    contentType: 'how_to',
    recommendedDifficulty: 'beginner',
    estimatedReadingTime: 7,
    icon: <ListChecks className="h-5 w-5" />,
    sectionCount: 10,
    useCases: ['Quick tasks', 'Common operations', 'Feature usage'],
  },
  {
    id: 'reference',
    name: 'Reference Documentation',
    description: 'Comprehensive documentation for features, APIs, or configurations with examples',
    contentType: 'reference',
    recommendedDifficulty: 'intermediate',
    estimatedReadingTime: 12,
    icon: <FileText className="h-5 w-5" />,
    sectionCount: 13,
    useCases: ['Feature documentation', 'API references', 'Configuration guides'],
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting Guide',
    description: 'Diagnostic guide for resolving specific issues or errors with solutions',
    contentType: 'troubleshooting',
    recommendedDifficulty: 'intermediate',
    estimatedReadingTime: 8,
    icon: <AlertCircle className="h-5 w-5" />,
    sectionCount: 16,
    useCases: ['Error resolution', 'Common problems', 'Diagnostic guides'],
  },
  {
    id: 'bestPractice',
    name: 'Best Practice Guide',
    description:
      'Industry best practices and optimization recommendations with real-world examples',
    contentType: 'best_practice',
    recommendedDifficulty: 'intermediate',
    estimatedReadingTime: 10,
    icon: <Award className="h-5 w-5" />,
    sectionCount: 16,
    useCases: ['Optimization strategies', 'Industry standards', 'Process improvement'],
  },
  {
    id: 'faq',
    name: 'FAQ Template',
    description: 'Frequently asked questions in Q&A format with concise answers',
    contentType: 'faq',
    recommendedDifficulty: 'beginner',
    estimatedReadingTime: 5,
    icon: <HelpCircle className="h-5 w-5" />,
    sectionCount: 7,
    useCases: ['Common questions', 'Quick answers', 'Self-service support'],
  },
  {
    id: 'releaseNotes',
    name: 'Release Notes',
    description: 'Document new features, improvements, and bug fixes in product updates',
    contentType: 'release_notes',
    recommendedDifficulty: 'beginner',
    estimatedReadingTime: 5,
    icon: <Rocket className="h-5 w-5" />,
    sectionCount: 13,
    useCases: ['Product updates', 'Feature announcements', 'Changelog'],
  },
];

interface ArticleTemplateSelectorProps {
  onSelectTemplate: (templateId: string) => void;
  onCancel?: () => void;
}

export default function ArticleTemplateSelector({
  onSelectTemplate,
  onCancel,
}: ArticleTemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      advanced: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      expert: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[difficulty] || colors.beginner;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose an Article Template</h2>
        <p className="text-muted-foreground">
          Select a template that best fits your content type. Templates provide structure and
          guidance to help you create high-quality articles quickly.
        </p>
      </div>

      <ScrollArea className="h-[600px] pr-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTemplate === template.id
                  ? 'ring-2 ring-blue-500 border-blue-500'
                  : 'hover:border-gray-400'
              }`}
              onClick={() => handleSelect(template.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
                      {template.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {template.contentType.replace('_', ' ')}
                        </Badge>
                        <Badge
                          className={`text-xs ${getDifficultyColor(template.recommendedDifficulty)}`}
                        >
                          {template.recommendedDifficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {selectedTemplate === template.id && (
                    <div className="p-1 bg-blue-500 text-white rounded-full">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{template.description}</p>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{template.estimatedReadingTime} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{template.sectionCount} sections</span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Best for:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.useCases.map((useCase, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {useCase}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleConfirm} disabled={!selectedTemplate} className="min-w-[120px]">
          {selectedTemplate ? 'Use Template' : 'Select a Template'}
        </Button>
      </div>

      {selectedTemplate && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500 text-white rounded-lg">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  What happens next?
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Your article editor will be pre-populated with the{' '}
                  <strong>{templates.find((t) => t.id === selectedTemplate)?.name}</strong>{' '}
                  structure. You'll have{' '}
                  {templates.find((t) => t.id === selectedTemplate)?.sectionCount} pre-defined
                  sections with guidance on what to write in each section.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
