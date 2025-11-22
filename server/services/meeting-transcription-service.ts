/**
 * Meeting Transcription Service
 * AI-powered meeting recording, transcription, and intelligent note generation
 */

import { db } from '../../db';
import ClaudeAIService from './claude-ai-service';
import { eq, and, sql, desc, asc } from 'drizzle-orm';

interface MeetingRecording {
  id: string;
  meetingId: string;
  tenantId: string;
  recordingName: string;
  recordingUrl?: string;
  recordingFormat: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  recordingSource: string;
  audioQuality: 'excellent' | 'good' | 'fair' | 'poor';
  videoQuality?: 'hd' | 'standard' | 'low' | 'audio_only';
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  aiAnalysisStatus: 'pending' | 'processing' | 'completed' | 'failed';
  aiConfidenceScore?: number;
  aiSpeakerCount?: number;
  aiLanguageDetected: string;
  aiAudioClarityScore?: number;
  uploadedBy: string;
  uploadedAt: Date;
}

interface TranscriptionSegment {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  speakerId: string;
  speakerName?: string;
  text: string;
  confidence: number;
  words: Array<{
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
}

interface MeetingTranscription {
  id: string;
  recordingId: string;
  meetingId: string;
  tenantId: string;
  fullTranscript: string;
  transcriptSegments: TranscriptionSegment[];
  transcriptionService: string;
  aiModelVersion: string;
  processingTimeSeconds: number;
  overallConfidence: number;
  wordCount: number;
  speakerCount: number;
  speakers: Array<{
    id: string;
    name?: string;
    speakingTimeSeconds: number;
    wordCount: number;
    averageConfidence: number;
  }>;
  speakerMapping: Record<string, string>;
  primaryLanguage: string;
  contentCategories: string[];
}

interface MeetingNotes {
  id: string;
  meetingId: string;
  recordingId?: string;
  transcriptionId?: string;
  tenantId: string;
  title: string;
  executiveSummary: string;
  detailedNotes: string;
  keyPoints: Array<{
    id: string;
    point: string;
    importance: number;
    speakers: string[];
    timestamp?: number;
  }>;
  decisionsMade: Array<{
    id: string;
    decision: string;
    context: string;
    decisionMaker: string;
    impact: 'high' | 'medium' | 'low';
    timestamp?: number;
  }>;
  actionItems: Array<{
    id: string;
    task: string;
    assignee?: string;
    dueDate?: Date;
    priority: 'high' | 'medium' | 'low';
    status: 'open' | 'in_progress' | 'completed';
    timestamp?: number;
  }>;
  followUpItems: Array<{
    id: string;
    topic: string;
    description: string;
    owner?: string;
    targetDate?: Date;
  }>;
  meetingSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  engagementLevel: 'high' | 'medium' | 'low';
  productivityScore: number;
  topicsDiscussed: string[];
  aiInsights: string[];
  aiRecommendations: string[];
  aiRiskFlags: string[];
  aiOpportunities: string[];
  aiModelUsed: string;
  aiConfidenceScore: number;
  createdBy: string;
}

interface MeetingHighlight {
  id: string;
  meetingId: string;
  recordingId: string;
  transcriptionId?: string;
  tenantId: string;
  highlightType: 'decision' | 'action_item' | 'key_point' | 'question' | 'concern' | 'opportunity';
  title: string;
  description: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  durationSeconds?: number;
  transcriptExcerpt: string;
  contextBefore?: string;
  contextAfter?: string;
  speakers: string[];
  participantsMentioned: string[];
  importanceScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidenceScore: number;
  tags: string[];
  relatedTopics: string[];
  businessImpact: 'high' | 'medium' | 'low' | 'none';
  requiresAction: boolean;
  assignedTo?: string;
  dueDate?: Date;
  completionStatus: 'open' | 'in_progress' | 'completed' | 'cancelled';
  aiGenerated: boolean;
}

class MeetingTranscriptionService {
  /**
   * Upload and process a meeting recording
   */
  async uploadRecording(
    meetingId: string,
    recordingFile: any,
    uploadedBy: string,
    options: {
      autoTranscribe?: boolean;
      autoGenerateNotes?: boolean;
      recordingSource?: string;
    } = {}
  ): Promise<MeetingRecording> {
    console.log('🎥 Uploading meeting recording for meeting:', meetingId);
    
    try {
      // Mock file upload - in production, this would upload to cloud storage
      const recording: MeetingRecording = {
        id: `recording-${Date.now()}`,
        meetingId,
        tenantId: 'mock-tenant',
        recordingName: recordingFile.name || `Meeting Recording ${new Date().toLocaleDateString()}`,
        recordingUrl: `https://storage.company.com/recordings/${meetingId}/${Date.now()}.mp4`,
        recordingFormat: 'mp4',
        fileSizeBytes: recordingFile.size || 150000000, // ~150MB
        durationSeconds: recordingFile.duration || 3600, // 1 hour default
        recordingSource: options.recordingSource || 'manual_upload',
        audioQuality: 'good',
        videoQuality: 'standard',
        processingStatus: 'pending',
        transcriptionStatus: 'pending',
        aiAnalysisStatus: 'pending',
        aiLanguageDetected: 'en',
        uploadedBy,
        uploadedAt: new Date()
      };

      // Start processing pipeline
      if (options.autoTranscribe !== false) {
        await this.processRecording(recording.id);
      }

      console.log('✅ Recording uploaded successfully:', recording.id);
      return recording;
    } catch (error) {
      console.error('Failed to upload recording:', error);
      throw error;
    }
  }

  /**
   * Process a meeting recording (transcription + AI analysis)
   */
  async processRecording(recordingId: string): Promise<{
    transcription?: MeetingTranscription;
    notes?: MeetingNotes;
    highlights?: MeetingHighlight[];
  }> {
    console.log('⚙️ Processing meeting recording:', recordingId);
    
    try {
      // Step 1: Generate transcription
      const transcription = await this.generateTranscription(recordingId);
      
      // Step 2: Generate AI notes
      const notes = await this.generateMeetingNotes(transcription);
      
      // Step 3: Extract highlights
      const highlights = await this.extractMeetingHighlights(transcription, notes);
      
      // Step 4: Update processing status
      await this.updateRecordingStatus(recordingId, {
        processingStatus: 'completed',
        transcriptionStatus: 'completed',
        aiAnalysisStatus: 'completed'
      });

      console.log('✅ Recording processing completed:', recordingId);
      return { transcription, notes, highlights };
    } catch (error) {
      console.error('Recording processing failed:', error);
      await this.updateRecordingStatus(recordingId, {
        processingStatus: 'failed',
        transcriptionStatus: 'failed',
        aiAnalysisStatus: 'failed'
      });
      throw error;
    }
  }

  /**
   * Generate transcription from recording
   */
  private async generateTranscription(recordingId: string): Promise<MeetingTranscription> {
    console.log('🎤 Generating transcription for recording:', recordingId);
    
    // Mock transcription generation - in production, this would use OpenAI Whisper, Google Speech, etc.
    const mockSegments: TranscriptionSegment[] = [
      {
        id: 'seg-1',
        startTime: 0,
        endTime: 15,
        speakerId: 'speaker-1',
        speakerName: 'John Smith',
        text: 'Good morning everyone, thank you for joining today\'s Q4 planning session. Let\'s start by reviewing our Q3 performance.',
        confidence: 0.95,
        words: [
          { word: 'Good', startTime: 0, endTime: 0.5, confidence: 0.98 },
          { word: 'morning', startTime: 0.5, endTime: 1.0, confidence: 0.97 },
          // ... more words
        ]
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
      },
      {
        id: 'seg-4',
        startTime: 48,
        endTime: 65,
        speakerId: 'speaker-1',
        speakerName: 'John Smith',
        text: 'Great point, Mike. Let\'s also look at our resource allocation. We\'ll need to hire 3 additional sales representatives to handle the increased demand.',
        confidence: 0.94,
        words: []
      }
    ];

    const fullTranscript = mockSegments.map(seg => `${seg.speakerName}: ${seg.text}`).join('\n\n');
    
    const transcription: MeetingTranscription = {
      id: `transcription-${Date.now()}`,
      recordingId,
      meetingId: 'meeting-1',
      tenantId: 'mock-tenant',
      fullTranscript,
      transcriptSegments: mockSegments,
      transcriptionService: 'openai_whisper',
      aiModelVersion: 'whisper-1',
      processingTimeSeconds: 45,
      overallConfidence: 0.925,
      wordCount: 156,
      speakerCount: 3,
      speakers: [
        {
          id: 'speaker-1',
          name: 'John Smith',
          speakingTimeSeconds: 30,
          wordCount: 52,
          averageConfidence: 0.945
        },
        {
          id: 'speaker-2',
          name: 'Sarah Johnson',
          speakingTimeSeconds: 17,
          wordCount: 34,
          averageConfidence: 0.92
        },
        {
          id: 'speaker-3',
          name: 'Mike Chen',
          speakingTimeSeconds: 16,
          wordCount: 35,
          averageConfidence: 0.89
        }
      ],
      speakerMapping: {
        'speaker-1': 'John Smith',
        'speaker-2': 'Sarah Johnson',
        'speaker-3': 'Mike Chen'
      },
      primaryLanguage: 'en',
      contentCategories: ['business_planning', 'performance_review', 'strategy_discussion']
    };

    console.log('✅ Transcription generated with', mockSegments.length, 'segments');
    return transcription;
  }

  /**
   * Generate AI-powered meeting notes
   */
  private async generateMeetingNotes(transcription: MeetingTranscription): Promise<MeetingNotes> {
    console.log('📝 Generating AI meeting notes...');
    
    try {
      const notesPrompt = `Generate comprehensive meeting notes from this transcription:

MEETING TRANSCRIPTION:
${transcription.fullTranscript}

MEETING CONTEXT:
- Duration: ${Math.round(transcription.transcriptSegments[transcription.transcriptSegments.length - 1]?.endTime || 0)} seconds
- Speakers: ${transcription.speakers.map(s => s.name).join(', ')}
- Primary Language: ${transcription.primaryLanguage}
- Content Categories: ${transcription.contentCategories.join(', ')}

Generate structured meeting notes with:
1. Executive Summary (2-3 sentences)
2. Key Discussion Points (5-8 main points)
3. Decisions Made (specific decisions with decision makers)
4. Action Items (tasks with assignees and priorities)
5. Follow-up Items (topics for future meetings)
6. AI Insights and Recommendations
7. Business Opportunities and Risk Flags

Return JSON format:
{
  "executiveSummary": "Brief summary of the meeting",
  "keyPoints": [
    {
      "point": "Key discussion point",
      "importance": 0.9,
      "speakers": ["John Smith"],
      "timestamp": 15
    }
  ],
  "decisionsMade": [
    {
      "decision": "Decision made",
      "context": "Context of decision",
      "decisionMaker": "John Smith",
      "impact": "high",
      "timestamp": 32
    }
  ],
  "actionItems": [
    {
      "task": "Action item description",
      "assignee": "Mike Chen",
      "priority": "high",
      "status": "open",
      "timestamp": 48
    }
  ],
  "followUpItems": [
    {
      "topic": "Follow-up topic",
      "description": "Description of follow-up needed",
      "owner": "Sarah Johnson"
    }
  ],
  "meetingSentiment": "positive",
  "engagementLevel": "high",
  "productivityScore": 0.85,
  "topicsDiscussed": ["Q3 Performance", "Q4 Planning", "Resource Allocation"],
  "aiInsights": ["Team is aligned on growth strategy", "Strong Q3 performance momentum"],
  "aiRecommendations": ["Schedule resource planning meeting", "Prepare Q4 budget proposal"],
  "aiRiskFlags": ["Potential resource constraints with rapid growth"],
  "aiOpportunities": ["Market expansion opportunity based on Q3 success"]
}`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: notesPrompt }],
        temperature: 0.3,
        max_tokens: 3000
      });

      const notesData = JSON.parse(aiResponse);
      
      const notes: MeetingNotes = {
        id: `notes-${Date.now()}`,
        meetingId: transcription.meetingId,
        recordingId: transcription.recordingId,
        transcriptionId: transcription.id,
        tenantId: transcription.tenantId,
        title: 'Q4 Planning Session Notes',
        executiveSummary: notesData.executiveSummary,
        detailedNotes: `Full meeting discussion covering Q3 performance review and Q4 strategic planning.\n\n${transcription.fullTranscript}`,
        keyPoints: notesData.keyPoints.map((kp: any, index: number) => ({
          id: `kp-${index + 1}`,
          ...kp
        })),
        decisionsMade: notesData.decisionsMade.map((dm: any, index: number) => ({
          id: `dm-${index + 1}`,
          ...dm
        })),
        actionItems: notesData.actionItems.map((ai: any, index: number) => ({
          id: `ai-${index + 1}`,
          ...ai
        })),
        followUpItems: notesData.followUpItems.map((fu: any, index: number) => ({
          id: `fu-${index + 1}`,
          ...fu
        })),
        meetingSentiment: notesData.meetingSentiment,
        engagementLevel: notesData.engagementLevel,
        productivityScore: notesData.productivityScore,
        topicsDiscussed: notesData.topicsDiscussed,
        aiInsights: notesData.aiInsights,
        aiRecommendations: notesData.aiRecommendations,
        aiRiskFlags: notesData.aiRiskFlags,
        aiOpportunities: notesData.aiOpportunities,
        aiModelUsed: 'claude-3-5-sonnet-20241022',
        aiConfidenceScore: 0.88,
        createdBy: 'ai-assistant'
      };

      console.log('✅ AI meeting notes generated successfully');
      return notes;
    } catch (error) {
      console.error('AI notes generation failed:', error);
      // Return fallback notes
      return this.generateFallbackNotes(transcription);
    }
  }

  /**
   * Extract meeting highlights and key moments
   */
  private async extractMeetingHighlights(
    transcription: MeetingTranscription,
    notes: MeetingNotes
  ): Promise<MeetingHighlight[]> {
    console.log('✨ Extracting meeting highlights...');
    
    try {
      const highlightsPrompt = `Extract key highlights from this meeting:

TRANSCRIPTION SEGMENTS:
${transcription.transcriptSegments.map(seg => 
  `[${seg.startTime}s-${seg.endTime}s] ${seg.speakerName}: ${seg.text}`
).join('\n')}

MEETING NOTES CONTEXT:
- Key Points: ${notes.keyPoints.map(kp => kp.point).join('; ')}
- Decisions: ${notes.decisionsMade.map(dm => dm.decision).join('; ')}
- Action Items: ${notes.actionItems.map(ai => ai.task).join('; ')}

Extract 5-8 highlights with these types:
- decision: Important decisions made
- action_item: Specific tasks assigned
- key_point: Critical discussion points
- opportunity: Business opportunities identified
- concern: Risks or concerns raised
- question: Important questions asked

Return JSON array:
[
  {
    "highlightType": "decision",
    "title": "Budget Increase Approved",
    "description": "Approved 15% marketing budget increase for Q4",
    "startTimeSeconds": 32,
    "endTimeSeconds": 48,
    "transcriptExcerpt": "Relevant transcript portion",
    "speakers": ["Mike Chen", "John Smith"],
    "importanceScore": 0.9,
    "sentiment": "positive",
    "confidenceScore": 0.85,
    "tags": ["budget", "marketing", "Q4"],
    "businessImpact": "high",
    "requiresAction": true
  }
]`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: highlightsPrompt }],
        temperature: 0.4,
        max_tokens: 2500
      });

      const highlightsData = JSON.parse(aiResponse);
      
      const highlights: MeetingHighlight[] = highlightsData.map((highlight: any, index: number) => ({
        id: `highlight-${Date.now()}-${index}`,
        meetingId: transcription.meetingId,
        recordingId: transcription.recordingId,
        transcriptionId: transcription.id,
        tenantId: transcription.tenantId,
        highlightType: highlight.highlightType,
        title: highlight.title,
        description: highlight.description,
        startTimeSeconds: highlight.startTimeSeconds,
        endTimeSeconds: highlight.endTimeSeconds,
        durationSeconds: highlight.endTimeSeconds - highlight.startTimeSeconds,
        transcriptExcerpt: highlight.transcriptExcerpt,
        contextBefore: '',
        contextAfter: '',
        speakers: highlight.speakers || [],
        participantsMentioned: [],
        importanceScore: highlight.importanceScore,
        sentiment: highlight.sentiment,
        confidenceScore: highlight.confidenceScore,
        tags: highlight.tags || [],
        relatedTopics: [],
        businessImpact: highlight.businessImpact,
        requiresAction: highlight.requiresAction || false,
        completionStatus: 'open',
        aiGenerated: true
      }));

      console.log(`✅ Extracted ${highlights.length} meeting highlights`);
      return highlights;
    } catch (error) {
      console.error('Highlight extraction failed:', error);
      return [];
    }
  }

  /**
   * Search meeting content across transcriptions and notes
   */
  async searchMeetingContent(
    tenantId: string,
    query: string,
    filters: {
      dateRange?: { start: Date; end: Date };
      meetingIds?: string[];
      contentTypes?: string[];
      speakers?: string[];
      tags?: string[];
    } = {}
  ): Promise<{
    results: Array<{
      meetingId: string;
      meetingTitle: string;
      contentType: string;
      excerpt: string;
      relevanceScore: number;
      timestamp?: number;
      speakers?: string[];
      highlights: string[];
    }>;
    totalResults: number;
    searchTime: number;
  }> {
    console.log('🔍 Searching meeting content:', query);
    
    const startTime = Date.now();
    
    // Mock search results - in production, this would use full-text search with PostgreSQL or Elasticsearch
    const mockResults = [
      {
        meetingId: 'meeting-1',
        meetingTitle: 'Q4 Planning Session',
        contentType: 'transcription',
        excerpt: 'Our Q3 results exceeded expectations with a 23% increase in revenue compared to Q2. The new client acquisition strategy has been particularly effective.',
        relevanceScore: 0.92,
        timestamp: 15,
        speakers: ['Sarah Johnson'],
        highlights: ['Q3 results', 'revenue increase', 'client acquisition']
      },
      {
        meetingId: 'meeting-1',
        meetingTitle: 'Q4 Planning Session',
        contentType: 'notes',
        excerpt: 'Decision made to increase marketing budget by 15% to capitalize on Q3 momentum and support Q4 growth objectives.',
        relevanceScore: 0.87,
        speakers: ['Mike Chen', 'John Smith'],
        highlights: ['marketing budget', '15% increase', 'Q4 growth']
      },
      {
        meetingId: 'meeting-2',
        meetingTitle: 'Client Presentation Review',
        contentType: 'highlights',
        excerpt: 'Key opportunity identified to expand into European markets based on client feedback and competitive analysis.',
        relevanceScore: 0.78,
        timestamp: 1245,
        speakers: ['Lisa Wang'],
        highlights: ['European markets', 'client feedback', 'competitive analysis']
      }
    ];

    const searchTime = Date.now() - startTime;
    
    return {
      results: mockResults,
      totalResults: mockResults.length,
      searchTime
    };
  }

  /**
   * Get meeting content analytics
   */
  async getMeetingContentAnalytics(
    tenantId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalMeetingsRecorded: number;
    totalRecordingHours: number;
    totalTranscriptionWords: number;
    averageTranscriptionConfidence: number;
    averageProcessingTime: number;
    mostDiscussedTopics: Array<{ topic: string; frequency: number; trend: string }>;
    speakerAnalytics: Array<{ speaker: string; totalSpeakingTime: number; meetingCount: number; averageEngagement: number }>;
    contentQualityMetrics: {
      transcriptionAccuracy: number;
      aiConfidenceScore: number;
      completionRate: number;
    };
    actionItemMetrics: {
      totalGenerated: number;
      completionRate: number;
      averageTimeToComplete: number;
    };
    insights: string[];
    recommendations: string[];
  }> {
    console.log('📊 Generating meeting content analytics...');
    
    // Mock analytics - in production, this would aggregate from actual data
    return {
      totalMeetingsRecorded: 89,
      totalRecordingHours: 267.5,
      totalTranscriptionWords: 425600,
      averageTranscriptionConfidence: 0.91,
      averageProcessingTime: 42, // seconds
      mostDiscussedTopics: [
        { topic: 'Q4 Planning', frequency: 34, trend: 'increasing' },
        { topic: 'Client Strategy', frequency: 28, trend: 'stable' },
        { topic: 'Budget Allocation', frequency: 22, trend: 'increasing' },
        { topic: 'Team Performance', frequency: 19, trend: 'stable' },
        { topic: 'Market Analysis', frequency: 15, trend: 'decreasing' }
      ],
      speakerAnalytics: [
        { speaker: 'John Smith', totalSpeakingTime: 14520, meetingCount: 45, averageEngagement: 0.87 },
        { speaker: 'Sarah Johnson', totalSpeakingTime: 12890, meetingCount: 38, averageEngagement: 0.92 },
        { speaker: 'Mike Chen', totalSpeakingTime: 11200, meetingCount: 33, averageEngagement: 0.84 }
      ],
      contentQualityMetrics: {
        transcriptionAccuracy: 0.91,
        aiConfidenceScore: 0.88,
        completionRate: 0.94
      },
      actionItemMetrics: {
        totalGenerated: 156,
        completionRate: 0.78,
        averageTimeToComplete: 4.2 // days
      },
      insights: [
        'Meeting transcription accuracy has improved by 8% over the past quarter',
        'Q4 planning discussions are trending upward with 34% increase in frequency',
        'Action item completion rate is above target at 78%',
        'AI confidence scores are consistently high across all meeting types'
      ],
      recommendations: [
        'Consider implementing automatic action item tracking integration',
        'Expand transcription to include more technical meetings for better coverage',
        'Set up automated follow-up reminders for incomplete action items',
        'Create topic-based meeting templates to improve discussion structure'
      ]
    };
  }

  /**
   * Generate speaker voice profile for recognition
   */
  async generateSpeakerProfile(
    userId: string,
    tenantId: string,
    voiceSamples: string[]
  ): Promise<{
    voiceSignatureId: string;
    recognitionConfidence: number;
    voiceCharacteristics: Record<string, any>;
    speakingPatterns: {
      averagePace: number;
      commonPhrases: string[];
      speakingStyle: string;
    };
  }> {
    console.log('🎙️ Generating speaker voice profile for user:', userId);
    
    // Mock voice profile generation - in production, this would use voice recognition AI
    return {
      voiceSignatureId: `voice-${userId}-${Date.now()}`,
      recognitionConfidence: 0.89,
      voiceCharacteristics: {
        fundamentalFrequency: 145.2,
        spectralCentroid: 2100.5,
        voiceQuality: 'clear',
        accentDetected: 'neutral'
      },
      speakingPatterns: {
        averagePace: 165, // words per minute
        commonPhrases: ['Let me think about that', 'That\'s a great point', 'Moving forward'],
        speakingStyle: 'professional'
      }
    };
  }

  // Helper methods
  private async updateRecordingStatus(
    recordingId: string,
    status: {
      processingStatus?: string;
      transcriptionStatus?: string;
      aiAnalysisStatus?: string;
    }
  ): Promise<void> {
    console.log('📝 Updating recording status:', recordingId, status);
    // In production, this would update the database
  }

  private generateFallbackNotes(transcription: MeetingTranscription): MeetingNotes {
    return {
      id: `notes-fallback-${Date.now()}`,
      meetingId: transcription.meetingId,
      recordingId: transcription.recordingId,
      transcriptionId: transcription.id,
      tenantId: transcription.tenantId,
      title: 'Meeting Notes (Basic)',
      executiveSummary: 'Meeting transcription completed. AI analysis was not available.',
      detailedNotes: transcription.fullTranscript,
      keyPoints: [],
      decisionsMade: [],
      actionItems: [],
      followUpItems: [],
      meetingSentiment: 'neutral',
      engagementLevel: 'medium',
      productivityScore: 0.5,
      topicsDiscussed: [],
      aiInsights: ['AI analysis unavailable - manual review recommended'],
      aiRecommendations: ['Review transcript for key points and action items'],
      aiRiskFlags: [],
      aiOpportunities: [],
      aiModelUsed: 'fallback',
      aiConfidenceScore: 0.1,
      createdBy: 'system'
    };
  }
}

export default new MeetingTranscriptionService();
