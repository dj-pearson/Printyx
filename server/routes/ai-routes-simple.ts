/**
 * AI Routes - Motion AI Integration API Endpoints
 */

import express from 'express';
import ClaudeAIService from '../services/claude-ai-service';

const router = express.Router();

/**
 * GET /api/ai/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const response = await ClaudeAIService.generateCompletion({
      messages: [{ role: 'user', content: 'Health check' }],
      max_tokens: 10,
    });
    res.json({ status: 'healthy', ai: 'available', response: response.substring(0, 50) });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: 'Claude API unavailable' });
  }
});

/**
 * POST /api/ai/leads/analyze
 * Analyze lead data and generate AI insights
 */
router.post('/leads/analyze', async (req, res) => {
  try {
    const { leadData } = req.body;

    const mockLeadData = leadData || {
      companyName: 'Sample Company',
      industry: 'Manufacturing',
      employeeCount: 100,
    };

    const analysis = await ClaudeAIService.analyzeLeadData(mockLeadData);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing lead:', error);
    res.status(500).json({ error: 'Failed to analyze lead' });
  }
});

export default router;
