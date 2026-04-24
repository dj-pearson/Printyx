// Static fixtures ported from server/routes/ai-documentation-routes.ts.
//
// WHY IS THIS STATIC?
// The Express routes return mock data and no `ai_documents` / `ai_document_types`
// tables exist in the migrations on disk. Rather than ship a half-finished DB
// layer, we preserve the response shape the frontend already renders. When
// real doc persistence lands, these can be swapped for real queries without
// changing the index.ts dispatch.

export function buildMockDocuments(tenantId: string, userId: string) {
  const now = new Date();
  return [
    {
      id: 'doc-1',
      tenantId,
      title: 'Q4 Strategic Planning Meeting Minutes',
      description: 'Comprehensive minutes from Q4 strategic planning session',
      status: 'published',
      version: 2,
      content: {
        summary: 'Strategic planning session focused on Q4 objectives and resource allocation',
        sections: [
          { type: 'header', content: 'Q4 Strategic Planning Session' },
          {
            type: 'attendees',
            content: ['John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Wang'],
          },
          {
            type: 'discussion',
            content: 'Key discussion points around Q4 growth strategy...',
          },
        ],
      },
      wordCount: 1247,
      estimatedReadingTime: 6,
      aiGeneratedPercentage: 0.85,
      aiModelUsed: 'claude-3-5-sonnet-20241022',
      aiConfidenceScore: 0.92,
      sourceType: 'meeting_transcription',
      sourceId: 'meeting-1',
      tags: ['meeting', 'strategic', 'Q4', 'planning'],
      keywords: ['strategic planning', 'Q4 objectives', 'resource allocation'],
      summary:
        'Strategic planning session outlining Q4 growth objectives and resource requirements',
      viewCount: 45,
      editCount: 3,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    },
    {
      id: 'doc-2',
      tenantId,
      title: 'Enterprise Client Proposal',
      description: 'Comprehensive proposal for enterprise engagement',
      status: 'review',
      version: 1,
      content: {
        executiveSummary: 'Proposal for comprehensive enterprise software solution...',
        sections: [
          { type: 'executive_summary', content: 'Executive overview of proposed solution' },
          { type: 'solution', content: 'Proposed comprehensive solution approach' },
        ],
      },
      wordCount: 2156,
      estimatedReadingTime: 11,
      aiGeneratedPercentage: 0.65,
      aiModelUsed: 'claude-3-5-sonnet-20241022',
      aiConfidenceScore: 0.88,
      sourceType: 'template',
      tags: ['proposal', 'enterprise'],
      keywords: ['enterprise solution', 'software implementation'],
      viewCount: 23,
      editCount: 7,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export const MOCK_DOCUMENT_TYPES = [
  {
    id: 'type-1',
    name: 'Meeting Minutes',
    description: 'Structured meeting minutes with action items and decisions',
    category: 'meeting',
    templateStructure: {
      sections: ['header', 'attendees', 'agenda', 'discussion', 'decisions', 'action_items'],
    },
    aiWritingPrompts: [
      'Generate professional meeting minutes from transcription',
      'Extract key decisions and action items',
      'Identify next steps and follow-up items',
    ],
    requiredSections: ['header', 'attendees', 'discussion', 'action_items'],
    optionalSections: ['agenda', 'appendix'],
    aiTone: 'professional',
    aiComplexityLevel: 'medium',
    aiLengthPreference: 'medium',
    usageCount: 156,
    successRate: 0.91,
    isSystemTemplate: true,
    isActive: true,
  },
  {
    id: 'type-2',
    name: 'Business Proposal',
    description: 'Comprehensive business proposal template',
    category: 'proposal',
    templateStructure: {
      sections: [
        'executive_summary',
        'problem_statement',
        'solution',
        'benefits',
        'timeline',
        'pricing',
      ],
    },
    aiWritingPrompts: [
      'Create compelling executive summary',
      'Define clear problem statement and solution',
      'Highlight key benefits and value proposition',
    ],
    requiredSections: ['executive_summary', 'solution', 'benefits', 'pricing'],
    optionalSections: ['appendix', 'references'],
    aiTone: 'professional',
    aiComplexityLevel: 'advanced',
    aiLengthPreference: 'detailed',
    usageCount: 89,
    successRate: 0.87,
    isSystemTemplate: true,
    isActive: true,
  },
  {
    id: 'type-3',
    name: 'Knowledge Base Article',
    description: 'Structured knowledge base article with step-by-step instructions',
    category: 'knowledge_base',
    templateStructure: {
      sections: ['introduction', 'prerequisites', 'steps', 'examples', 'troubleshooting'],
    },
    aiWritingPrompts: [
      'Write clear introduction and overview',
      'Create step-by-step instructions',
      'Provide practical examples and troubleshooting',
    ],
    requiredSections: ['introduction', 'steps'],
    optionalSections: ['prerequisites', 'examples', 'troubleshooting', 'related_articles'],
    aiTone: 'friendly',
    aiComplexityLevel: 'medium',
    aiLengthPreference: 'detailed',
    usageCount: 67,
    successRate: 0.93,
    isSystemTemplate: true,
    isActive: true,
  },
];

export const MOCK_WRITING_ANALYTICS = {
  documentsCreated: 127,
  aiSessionsConducted: 89,
  totalWordsGenerated: 45600,
  averageAiConfidence: 0.87,
  suggestionsAccepted: 234,
  suggestionsRejected: 67,
  averageUserSatisfaction: 4.3,
  popularDocumentTypes: [
    { type: 'Meeting Minutes', count: 45 },
    { type: 'Business Proposal', count: 32 },
    { type: 'Project Report', count: 28 },
    { type: 'Knowledge Article', count: 22 },
  ],
  aiInsights: [
    'AI-generated content quality has improved by 12% over the past month',
    'Meeting minutes are the most frequently created document type',
    'Users accept 78% of AI content suggestions, indicating high relevance',
  ],
  recommendations: [
    'Consider creating more templates for frequently used document types',
    'Implement advanced formatting suggestions to improve document presentation',
  ],
};
