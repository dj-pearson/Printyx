/**
 * Meeting Transcription Routes
 * API endpoints for meeting recording, transcription, and AI note generation
 */

import express from 'express';
import multer from 'multer';
import MeetingTranscriptionService from '../services/meeting-transcription-service';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/recordings/',
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio and video files
    if (file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio and video files are allowed'));
    }
  }
});

// Mock authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'mock-user-id', tenantId: 'mock-tenant-id' };
  next();
};

/**
 * POST /api/meetings/:meetingId/recordings/upload
 * Upload a meeting recording
 */
router.post('/meetings/:meetingId/recordings/upload', upload.single('recording'), async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { autoTranscribe = true, autoGenerateNotes = true, recordingSource = 'manual_upload' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Recording file is required' });
    }

    const recording = await MeetingTranscriptionService.uploadRecording(
      meetingId,
      {
        name: req.file.originalname,
        size: req.file.size,
        path: req.file.path,
        mimetype: req.file.mimetype
      },
      req.user.id,
      {
        autoTranscribe: autoTranscribe === 'true',
        autoGenerateNotes: autoGenerateNotes === 'true',
        recordingSource
      }
    );

    res.status(201).json(recording);
  } catch (error) {
    console.error('Error uploading recording:', error);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
});

/**
 * GET /api/meetings/:meetingId/recordings
 * Get recordings for a meeting
 */
router.get('/meetings/:meetingId/recordings', async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    // Mock recordings data
    const recordings = [
      {
        id: 'recording-1',
        meetingId,
        tenantId: req.user.tenantId,
        recordingName: 'Q4 Planning Session Recording',
        recordingUrl: 'https://storage.company.com/recordings/meeting-1/recording.mp4',
        recordingFormat: 'mp4',
        fileSizeBytes: 157286400, // ~150MB
        durationSeconds: 3720, // 62 minutes
        recordingSource: 'zoom',
        audioQuality: 'excellent',
        videoQuality: 'hd',
        
        // Processing status
        processingStatus: 'completed',
        transcriptionStatus: 'completed',
        aiAnalysisStatus: 'completed',
        
        // AI analysis results
        aiConfidenceScore: 0.92,
        aiSpeakerCount: 4,
        aiLanguageDetected: 'en',
        aiAudioClarityScore: 0.89,
        
        // Metadata
        uploadedBy: 'user-manager-1',
        uploadedAt: new Date('2025-09-27T10:00:00Z'),
        processingStartedAt: new Date('2025-09-27T10:02:00Z'),
        processingCompletedAt: new Date('2025-09-27T10:05:30Z'),
        
        // Access control
        isPublic: true,
        accessPermissions: ['user-1', 'user-2', 'user-3', 'user-manager-1']
      },
      {
        id: 'recording-2',
        meetingId,
        tenantId: req.user.tenantId,
        recordingName: 'Audio Recording - Mobile',
        recordingUrl: 'https://storage.company.com/recordings/meeting-1/audio.mp3',
        recordingFormat: 'mp3',
        fileSizeBytes: 28435200, // ~27MB
        durationSeconds: 3600, // 60 minutes
        recordingSource: 'manual_upload',
        audioQuality: 'good',
        videoQuality: 'audio_only',
        
        // Processing status
        processingStatus: 'processing',
        transcriptionStatus: 'processing',
        aiAnalysisStatus: 'pending',
        
        // AI analysis results
        aiConfidenceScore: null,
        aiSpeakerCount: null,
        aiLanguageDetected: 'en',
        aiAudioClarityScore: 0.75,
        
        // Metadata
        uploadedBy: 'user-2',
        uploadedAt: new Date('2025-09-27T14:30:00Z'),
        processingStartedAt: new Date('2025-09-27T14:32:00Z'),
        processingCompletedAt: null,
        
        // Access control
        isPublic: false,
        accessPermissions: ['user-2', 'user-manager-1']
      }
    ];

    res.json(recordings);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

/**
 * GET /api/recordings/:recordingId/transcription
 * Get transcription for a recording
 */
router.get('/recordings/:recordingId/transcription', async (req, res) => {
  try {
    const { recordingId } = req.params;
    const { includeSegments = true, includeTimestamps = true } = req.query;
    
    // Mock transcription data
    const transcription = {
      id: 'transcription-1',
      recordingId,
      meetingId: 'meeting-1',
      tenantId: req.user.tenantId,
      
      // Transcription content
      fullTranscript: `John Smith: Good morning everyone, thank you for joining today's Q4 planning session. Let's start by reviewing our Q3 performance.

Sarah Johnson: Thank you, John. Our Q3 results exceeded expectations with a 23% increase in revenue compared to Q2. The new client acquisition strategy has been particularly effective.

Mike Chen: That's excellent news, Sarah. I'd like to discuss how we can scale this success into Q4. We should consider increasing our marketing budget by 15% to capitalize on this momentum.

John Smith: Great point, Mike. Let's also look at our resource allocation. We'll need to hire 3 additional sales representatives to handle the increased demand.

Lisa Wang: I agree with the hiring plan. From an operational perspective, we should also invest in our customer support infrastructure to maintain service quality as we scale.

Sarah Johnson: Absolutely, Lisa. Customer retention will be crucial as we grow. I propose we implement a dedicated account management program for our top-tier clients.

Mike Chen: That's a strategic move. We should also consider expanding our market reach. The data shows strong potential in the Pacific Northwest region.

John Smith: Excellent insights everyone. Let me summarize our key decisions and action items before we wrap up.`,

      // Segment data (if requested)
      transcriptSegments: includeSegments === 'true' ? [
        {
          id: 'seg-1',
          startTime: 0,
          endTime: 15,
          speakerId: 'speaker-1',
          speakerName: 'John Smith',
          text: 'Good morning everyone, thank you for joining today\'s Q4 planning session. Let\'s start by reviewing our Q3 performance.',
          confidence: 0.95,
          words: includeTimestamps === 'true' ? [
            { word: 'Good', startTime: 0, endTime: 0.5, confidence: 0.98 },
            { word: 'morning', startTime: 0.5, endTime: 1.0, confidence: 0.97 },
            { word: 'everyone', startTime: 1.0, endTime: 1.8, confidence: 0.96 }
          ] : []
        },
        {
          id: 'seg-2',
          startTime: 15,
          endTime: 32,
          speakerId: 'speaker-2',
          speakerName: 'Sarah Johnson',
          text: 'Thank you, John. Our Q3 results exceeded expectations with a 23% increase in revenue compared to Q2. The new client acquisition strategy has been particularly effective.',
          confidence: 0.92,
          words: []
        },
        {
          id: 'seg-3',
          startTime: 32,
          endTime: 48,
          speakerId: 'speaker-3',
          speakerName: 'Mike Chen',
          text: 'That\'s excellent news, Sarah. I\'d like to discuss how we can scale this success into Q4. We should consider increasing our marketing budget by 15% to capitalize on this momentum.',
          confidence: 0.89,
          words: []
        }
      ] : [],
      
      // Processing details
      transcriptionService: 'openai_whisper',
      aiModelVersion: 'whisper-1',
      processingTimeSeconds: 45,
      overallConfidence: 0.925,
      wordCount: 486,
      speakerCount: 4,
      
      // Speaker analysis
      speakers: [
        {
          id: 'speaker-1',
          name: 'John Smith',
          speakingTimeSeconds: 85,
          wordCount: 142,
          averageConfidence: 0.945
        },
        {
          id: 'speaker-2',
          name: 'Sarah Johnson',
          speakingTimeSeconds: 78,
          wordCount: 128,
          averageConfidence: 0.92
        },
        {
          id: 'speaker-3',
          name: 'Mike Chen',
          speakingTimeSeconds: 72,
          wordCount: 115,
          averageConfidence: 0.89
        },
        {
          id: 'speaker-4',
          name: 'Lisa Wang',
          speakingTimeSeconds: 65,
          wordCount: 101,
          averageConfidence: 0.91
        }
      ],
      
      speakerMapping: {
        'speaker-1': 'John Smith',
        'speaker-2': 'Sarah Johnson',
        'speaker-3': 'Mike Chen',
        'speaker-4': 'Lisa Wang'
      },
      
      // Content analysis
      primaryLanguage: 'en',
      detectedLanguages: ['en'],
      contentCategories: ['business_planning', 'performance_review', 'strategy_discussion'],
      
      // Timestamps
      transcribedAt: new Date('2025-09-27T10:03:30Z'),
      lastUpdatedAt: new Date('2025-09-27T10:03:30Z'),
      createdAt: new Date('2025-09-27T10:03:30Z')
    };

    res.json(transcription);
  } catch (error) {
    console.error('Error fetching transcription:', error);
    res.status(500).json({ error: 'Failed to fetch transcription' });
  }
});

/**
 * GET /api/meetings/:meetingId/notes
 * Get AI-generated notes for a meeting
 */
router.get('/meetings/:meetingId/notes', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { version = 'latest' } = req.query;
    
    // Mock meeting notes
    const notes = {
      id: 'notes-1',
      meetingId,
      recordingId: 'recording-1',
      transcriptionId: 'transcription-1',
      tenantId: req.user.tenantId,
      title: 'Q4 Planning Session - Meeting Notes',
      
      // Executive summary
      executiveSummary: 'The Q4 planning session focused on building upon strong Q3 performance with a 23% revenue increase. Key decisions included a 15% marketing budget increase, hiring 3 additional sales representatives, and implementing a dedicated account management program for top-tier clients.',
      
      // Detailed notes
      detailedNotes: `**Q4 Strategic Planning Session**

**Meeting Overview:**
- Date: September 27, 2025
- Duration: 62 minutes
- Participants: John Smith (Manager), Sarah Johnson (Sales Lead), Mike Chen (Marketing), Lisa Wang (Operations)

**Q3 Performance Review:**
Sarah Johnson reported exceptional Q3 results with a 23% revenue increase compared to Q2. The new client acquisition strategy has proven particularly effective, exceeding all projected targets.

**Q4 Strategic Initiatives:**
The team discussed scaling Q3 success into Q4 with several key strategic initiatives:
1. Marketing budget increase to capitalize on momentum
2. Sales team expansion to handle increased demand
3. Customer support infrastructure investment
4. Account management program for top-tier clients
5. Market expansion into Pacific Northwest region

**Resource Planning:**
Significant discussion around resource allocation to support growth objectives while maintaining service quality and customer satisfaction.`,

      // Structured content
      keyPoints: [
        {
          id: 'kp-1',
          point: 'Q3 revenue exceeded expectations with 23% increase over Q2',
          importance: 0.95,
          speakers: ['Sarah Johnson'],
          timestamp: 18
        },
        {
          id: 'kp-2',
          point: 'New client acquisition strategy has been highly effective',
          importance: 0.88,
          speakers: ['Sarah Johnson'],
          timestamp: 25
        },
        {
          id: 'kp-3',
          point: 'Marketing budget increase of 15% proposed for Q4',
          importance: 0.92,
          speakers: ['Mike Chen'],
          timestamp: 38
        },
        {
          id: 'kp-4',
          point: 'Need to hire 3 additional sales representatives',
          importance: 0.85,
          speakers: ['John Smith'],
          timestamp: 52
        },
        {
          id: 'kp-5',
          point: 'Customer support infrastructure investment required',
          importance: 0.82,
          speakers: ['Lisa Wang'],
          timestamp: 145
        }
      ],

      decisionsMade: [
        {
          id: 'dm-1',
          decision: 'Approve 15% increase in marketing budget for Q4',
          context: 'To capitalize on Q3 momentum and support growth objectives',
          decisionMaker: 'John Smith',
          impact: 'high',
          timestamp: 42
        },
        {
          id: 'dm-2',
          decision: 'Hire 3 additional sales representatives',
          context: 'To handle increased demand from successful client acquisition',
          decisionMaker: 'John Smith',
          impact: 'high',
          timestamp: 55
        },
        {
          id: 'dm-3',
          decision: 'Implement dedicated account management program',
          context: 'For top-tier clients to ensure retention during growth phase',
          decisionMaker: 'Team Consensus',
          impact: 'medium',
          timestamp: 165
        }
      ],

      actionItems: [
        {
          id: 'ai-1',
          task: 'Prepare detailed budget proposal for 15% marketing increase',
          assignee: 'Mike Chen',
          dueDate: new Date('2025-10-05T17:00:00Z'),
          priority: 'high',
          status: 'open',
          timestamp: 45
        },
        {
          id: 'ai-2',
          task: 'Begin recruitment process for 3 sales representatives',
          assignee: 'Sarah Johnson',
          dueDate: new Date('2025-10-10T17:00:00Z'),
          priority: 'high',
          status: 'open',
          timestamp: 58
        },
        {
          id: 'ai-3',
          task: 'Research customer support infrastructure options',
          assignee: 'Lisa Wang',
          dueDate: new Date('2025-10-08T17:00:00Z'),
          priority: 'medium',
          status: 'open',
          timestamp: 152
        },
        {
          id: 'ai-4',
          task: 'Develop account management program framework',
          assignee: 'Sarah Johnson',
          dueDate: new Date('2025-10-15T17:00:00Z'),
          priority: 'medium',
          status: 'open',
          timestamp: 172
        },
        {
          id: 'ai-5',
          task: 'Analyze Pacific Northwest market expansion opportunity',
          assignee: 'Mike Chen',
          dueDate: new Date('2025-10-12T17:00:00Z'),
          priority: 'low',
          status: 'open',
          timestamp: 198
        }
      ],

      followUpItems: [
        {
          id: 'fu-1',
          topic: 'Q4 Budget Review Meeting',
          description: 'Review and approve all Q4 budget allocations including marketing increase',
          owner: 'John Smith',
          targetDate: new Date('2025-10-08T10:00:00Z')
        },
        {
          id: 'fu-2',
          topic: 'Sales Team Onboarding Plan',
          description: 'Develop comprehensive onboarding plan for new sales representatives',
          owner: 'Sarah Johnson',
          targetDate: new Date('2025-10-15T14:00:00Z')
        },
        {
          id: 'fu-3',
          topic: 'Customer Success Metrics Review',
          description: 'Establish KPIs for account management program success',
          owner: 'Lisa Wang',
          targetDate: new Date('2025-10-20T11:00:00Z')
        }
      ],

      // Meeting analysis
      meetingSentiment: 'positive',
      engagementLevel: 'high',
      productivityScore: 0.91,
      topicsDiscussed: [
        'Q3 Performance Review',
        'Q4 Strategic Planning', 
        'Budget Allocation',
        'Team Expansion',
        'Customer Success',
        'Market Expansion'
      ],

      // AI insights
      aiInsights: [
        'Strong team alignment on growth strategy with unanimous support for key initiatives',
        'Q3 performance momentum creates excellent foundation for aggressive Q4 expansion',
        'Balanced approach to growth - scaling sales while investing in customer success',
        'Clear accountability with specific assignments and realistic timelines',
        'Strategic focus on both acquisition and retention demonstrates mature growth planning'
      ],

      aiRecommendations: [
        'Schedule weekly check-ins during Q4 ramp-up to monitor progress on action items',
        'Consider establishing Q4 success metrics and KPIs for new initiatives',
        'Plan for potential challenges with rapid team expansion and maintain culture',
        'Develop contingency plans if marketing spend doesn\'t yield expected ROI',
        'Create communication plan to keep entire organization informed of Q4 strategy'
      ],

      aiRiskFlags: [
        'Aggressive hiring timeline may impact onboarding quality and team integration',
        'Increased marketing spend requires careful ROI monitoring to avoid budget overrun',
        'Rapid growth may strain existing customer support resources before improvements'
      ],

      aiOpportunities: [
        'Q3 success demonstrates scalable business model ready for expansion',
        'Pacific Northwest market expansion could open additional regional opportunities',
        'Account management program could become competitive differentiator',
        'Strong team dynamics and clear decision-making process positions company for success'
      ],

      // Generation metadata
      aiModelUsed: 'claude-3-5-sonnet-20241022',
      generationPromptVersion: 'v2.1',
      processingTimeSeconds: 23,
      aiConfidenceScore: 0.91,
      version: 1,
      isFinal: true,
      parentNoteId: null,

      // Access control
      createdBy: 'ai-assistant',
      sharedWith: ['user-1', 'user-2', 'user-3', 'user-manager-1'],
      isPublic: false,

      createdAt: new Date('2025-09-27T10:04:15Z'),
      updatedAt: new Date('2025-09-27T10:04:15Z')
    };

    res.json(notes);
  } catch (error) {
    console.error('Error fetching meeting notes:', error);
    res.status(500).json({ error: 'Failed to fetch meeting notes' });
  }
});

/**
 * GET /api/meetings/:meetingId/highlights
 * Get meeting highlights and key moments
 */
router.get('/meetings/:meetingId/highlights', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { type, importance_min = 0.5 } = req.query;
    
    // Mock highlights data
    let highlights = [
      {
        id: 'highlight-1',
        meetingId,
        recordingId: 'recording-1',
        transcriptionId: 'transcription-1',
        tenantId: req.user.tenantId,
        highlightType: 'key_point',
        title: 'Q3 Revenue Growth Announcement',
        description: '23% revenue increase over Q2 - exceeded all expectations',
        startTimeSeconds: 18,
        endTimeSeconds: 32,
        durationSeconds: 14,
        transcriptExcerpt: 'Our Q3 results exceeded expectations with a 23% increase in revenue compared to Q2. The new client acquisition strategy has been particularly effective.',
        contextBefore: 'Thank you, John.',
        contextAfter: 'That\'s excellent news, Sarah.',
        speakers: ['Sarah Johnson'],
        participantsMentioned: [],
        importanceScore: 0.95,
        sentiment: 'positive',
        confidenceScore: 0.92,
        tags: ['Q3', 'revenue', 'growth', 'performance'],
        relatedTopics: ['performance_review', 'client_acquisition'],
        businessImpact: 'high',
        requiresAction: false,
        completionStatus: 'open',
        aiGenerated: true
      },
      {
        id: 'highlight-2',
        meetingId,
        recordingId: 'recording-1',
        transcriptionId: 'transcription-1',
        tenantId: req.user.tenantId,
        highlightType: 'decision',
        title: 'Marketing Budget Increase Approved',
        description: '15% marketing budget increase approved to capitalize on Q3 momentum',
        startTimeSeconds: 35,
        endTimeSeconds: 48,
        durationSeconds: 13,
        transcriptExcerpt: 'We should consider increasing our marketing budget by 15% to capitalize on this momentum.',
        contextBefore: 'I\'d like to discuss how we can scale this success into Q4.',
        contextAfter: 'Great point, Mike. Let\'s also look at our resource allocation.',
        speakers: ['Mike Chen'],
        participantsMentioned: [],
        importanceScore: 0.92,
        sentiment: 'positive',
        confidenceScore: 0.89,
        tags: ['marketing', 'budget', 'Q4', 'strategy'],
        relatedTopics: ['budget_planning', 'marketing_strategy'],
        businessImpact: 'high',
        requiresAction: true,
        assignedTo: 'Mike Chen',
        dueDate: new Date('2025-10-05T17:00:00Z'),
        completionStatus: 'open',
        aiGenerated: true
      },
      {
        id: 'highlight-3',
        meetingId,
        recordingId: 'recording-1',
        transcriptionId: 'transcription-1',
        tenantId: req.user.tenantId,
        highlightType: 'action_item',
        title: 'Sales Team Expansion Decision',
        description: 'Hire 3 additional sales representatives to handle increased demand',
        startTimeSeconds: 52,
        endTimeSeconds: 65,
        durationSeconds: 13,
        transcriptExcerpt: 'We\'ll need to hire 3 additional sales representatives to handle the increased demand.',
        contextBefore: 'Let\'s also look at our resource allocation.',
        contextAfter: 'I agree with the hiring plan.',
        speakers: ['John Smith'],
        participantsMentioned: [],
        importanceScore: 0.88,
        sentiment: 'neutral',
        confidenceScore: 0.94,
        tags: ['hiring', 'sales', 'team_expansion', 'resources'],
        relatedTopics: ['resource_planning', 'team_growth'],
        businessImpact: 'high',
        requiresAction: true,
        assignedTo: 'Sarah Johnson',
        dueDate: new Date('2025-10-10T17:00:00Z'),
        completionStatus: 'open',
        aiGenerated: true
      },
      {
        id: 'highlight-4',
        meetingId,
        recordingId: 'recording-1',
        transcriptionId: 'transcription-1',
        tenantId: req.user.tenantId,
        highlightType: 'opportunity',
        title: 'Pacific Northwest Market Expansion',
        description: 'Strong potential identified for expansion into Pacific Northwest region',
        startTimeSeconds: 195,
        endTimeSeconds: 208,
        durationSeconds: 13,
        transcriptExcerpt: 'The data shows strong potential in the Pacific Northwest region.',
        contextBefore: 'We should also consider expanding our market reach.',
        contextAfter: 'Excellent insights everyone.',
        speakers: ['Mike Chen'],
        participantsMentioned: [],
        importanceScore: 0.75,
        sentiment: 'positive',
        confidenceScore: 0.82,
        tags: ['expansion', 'market', 'pacific_northwest', 'opportunity'],
        relatedTopics: ['market_expansion', 'growth_strategy'],
        businessImpact: 'medium',
        requiresAction: true,
        assignedTo: 'Mike Chen',
        dueDate: new Date('2025-10-12T17:00:00Z'),
        completionStatus: 'open',
        aiGenerated: true
      },
      {
        id: 'highlight-5',
        meetingId,
        recordingId: 'recording-1',
        transcriptionId: 'transcription-1',
        tenantId: req.user.tenantId,
        highlightType: 'concern',
        title: 'Customer Support Infrastructure Concern',
        description: 'Need to invest in customer support to maintain quality during scaling',
        startTimeSeconds: 145,
        endTimeSeconds: 158,
        durationSeconds: 13,
        transcriptExcerpt: 'We should also invest in our customer support infrastructure to maintain service quality as we scale.',
        contextBefore: 'From an operational perspective,',
        contextAfter: 'Absolutely, Lisa. Customer retention will be crucial.',
        speakers: ['Lisa Wang'],
        participantsMentioned: [],
        importanceScore: 0.82,
        sentiment: 'neutral',
        confidenceScore: 0.91,
        tags: ['customer_support', 'infrastructure', 'scaling', 'quality'],
        relatedTopics: ['operational_planning', 'customer_success'],
        businessImpact: 'medium',
        requiresAction: true,
        assignedTo: 'Lisa Wang',
        dueDate: new Date('2025-10-08T17:00:00Z'),
        completionStatus: 'open',
        aiGenerated: true
      }
    ];

    // Apply filters
    if (type) {
      highlights = highlights.filter(h => h.highlightType === type);
    }
    
    const importanceThreshold = parseFloat(importance_min as string);
    highlights = highlights.filter(h => h.importanceScore >= importanceThreshold);

    // Sort by importance score
    highlights.sort((a, b) => b.importanceScore - a.importanceScore);

    res.json(highlights);
  } catch (error) {
    console.error('Error fetching meeting highlights:', error);
    res.status(500).json({ error: 'Failed to fetch meeting highlights' });
  }
});

/**
 * POST /api/meetings/content/search
 * Search meeting content across transcriptions and notes
 */
router.post('/content/search', async (req, res) => {
  try {
    const { 
      query, 
      filters = {},
      page = 1, 
      limit = 20 
    } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchResults = await MeetingTranscriptionService.searchMeetingContent(
      req.user.tenantId,
      query,
      filters
    );

    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = searchResults.results.slice(startIndex, endIndex);

    res.json({
      query,
      results: paginatedResults,
      pagination: {
        page,
        limit,
        total: searchResults.totalResults,
        pages: Math.ceil(searchResults.totalResults / limit)
      },
      searchTime: searchResults.searchTime,
      filters: filters
    });
  } catch (error) {
    console.error('Error searching meeting content:', error);
    res.status(500).json({ error: 'Failed to search meeting content' });
  }
});

/**
 * GET /api/meetings/analytics/content
 * Get meeting content analytics
 */
router.get('/analytics/content', async (req, res) => {
  try {
    const { 
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date = new Date().toISOString()
    } = req.query;

    const analytics = await MeetingTranscriptionService.getMeetingContentAnalytics(
      req.user.tenantId,
      {
        start: new Date(start_date as string),
        end: new Date(end_date as string)
      }
    );

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching meeting content analytics:', error);
    res.status(500).json({ error: 'Failed to fetch meeting content analytics' });
  }
});

/**
 * POST /api/meetings/speakers/profile
 * Generate speaker voice profile
 */
router.post('/speakers/profile', async (req, res) => {
  try {
    const { voiceSamples = [] } = req.body;

    if (!Array.isArray(voiceSamples) || voiceSamples.length === 0) {
      return res.status(400).json({ error: 'Voice samples are required' });
    }

    const profile = await MeetingTranscriptionService.generateSpeakerProfile(
      req.user.id,
      req.user.tenantId,
      voiceSamples
    );

    res.json(profile);
  } catch (error) {
    console.error('Error generating speaker profile:', error);
    res.status(500).json({ error: 'Failed to generate speaker profile' });
  }
});

/**
 * POST /api/recordings/:recordingId/process
 * Manually trigger recording processing
 */
router.post('/recordings/:recordingId/process', async (req, res) => {
  try {
    const { recordingId } = req.params;
    const { 
      forceReprocess = false, 
      generateNotes = true, 
      extractHighlights = true 
    } = req.body;

    const result = await MeetingTranscriptionService.processRecording(recordingId);

    res.json({
      success: true,
      recordingId,
      processing: {
        transcription: !!result.transcription,
        notes: !!result.notes,
        highlights: result.highlights?.length || 0
      },
      message: 'Recording processing completed successfully'
    });
  } catch (error) {
    console.error('Error processing recording:', error);
    res.status(500).json({ error: 'Failed to process recording' });
  }
});

export default router;
