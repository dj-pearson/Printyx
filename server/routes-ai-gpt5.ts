import { Router } from 'express';
import { gpt5Service, GPT5_CONFIGS } from './services/gpt5-service';
import { z } from 'zod';

// Authentication middleware for GPT-5 routes
const requireAuth = (req: any, res: any, next: any) => {
  // Check for session-based auth (legacy) or user object (current)
  const isAuthenticated =
    req.session?.userId || req.user?.id || req.user?.claims?.sub;

  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Add user context for backwards compatibility
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || req.user?.tenantId,
    };
  } else if (!req.user.tenantId && !req.user.id) {
    // If we have user claims but no structured user object, build it
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId: req.user.tenantId || req.session?.tenantId,
    };
  }

  next();
};

const router = Router();

// Input validation schemas
const leadAnalysisSchema = z.object({
  leadData: z.record(z.any()),
  customerHistory: z.record(z.any()).optional()
});

const proposalGenerationSchema = z.object({
  customerData: z.record(z.any()),
  equipmentRequirements: z.record(z.any()),
  pricingData: z.record(z.any())
});

const serviceAnalysisSchema = z.object({
  ticketData: z.record(z.any()),
  equipmentHistory: z.record(z.any()).optional()
});

const supportResponseSchema = z.object({
  customerQuery: z.string(),
  customerContext: z.record(z.any()).optional()
});

const businessAnalyticsSchema = z.object({
  salesData: z.record(z.any()),
  serviceData: z.record(z.any()),
  timeframe: z.string()
});

const inquiryClassificationSchema = z.object({
  inquiry: z.string()
});

const codeGenerationSchema = z.object({
  requirements: z.string(),
  codeType: z.enum(['javascript', 'python', 'sql'])
});

const customPromptSchema = z.object({
  prompt: z.string(),
  configType: z.enum([
    'LEAD_ANALYSIS',
    'PROPOSAL_GENERATION', 
    'SERVICE_ANALYSIS',
    'CUSTOMER_SUPPORT',
    'BUSINESS_ANALYTICS',
    'CODE_GENERATION',
    'CLASSIFICATION'
  ]).optional(),
  previousResponseId: z.string().optional()
});

/**
 * POST /api/ai/gpt5/analyze-lead
 * Analyze customer lead for qualification and insights
 */
router.post('/analyze-lead', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = leadAnalysisSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { leadData, customerHistory } = validation.data;
    
    const result = await gpt5Service.analyzeCustomerLead(leadData, customerHistory);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      analysis: result.content,
      responseId: result.responseId,
      usage: result.usage
    });

  } catch (error) {
    console.error('Lead analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/gpt5/generate-proposal
 * Generate professional proposal content
 */
router.post('/generate-proposal', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = proposalGenerationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { customerData, equipmentRequirements, pricingData } = validation.data;
    
    const result = await gpt5Service.generateProposal(
      customerData, 
      equipmentRequirements, 
      pricingData
    );
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      proposal: result.content,
      responseId: result.responseId,
      usage: result.usage
    });

  } catch (error) {
    console.error('Proposal generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/gpt5/analyze-service
 * Analyze service ticket for predictive maintenance insights
 */
router.post('/analyze-service', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = serviceAnalysisSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { ticketData, equipmentHistory } = validation.data;
    
    const result = await gpt5Service.analyzeServiceTicket(ticketData, equipmentHistory);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      analysis: result.content,
      responseId: result.responseId,
      usage: result.usage
    });

  } catch (error) {
    console.error('Service analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/gpt5/support-response
 * Generate customer support response
 */
router.post('/support-response', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = supportResponseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { customerQuery, customerContext } = validation.data;
    
    const result = await gpt5Service.generateSupportResponse(customerQuery, customerContext);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      response: result.content,
      responseId: result.responseId,
      usage: result.usage
    });

  } catch (error) {
    console.error('Support response error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/gpt5/business-analytics
 * Perform business analytics and forecasting
 */
router.post('/business-analytics', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = businessAnalyticsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { salesData, serviceData, timeframe } = validation.data;
    
    const result = await gpt5Service.analyzeBusinessMetrics(salesData, serviceData, timeframe);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      analysis: result.content,
      responseId: result.responseId,
      usage: result.usage
    });

  } catch (error) {
    console.error('Business analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/gpt5/classify-inquiry
 * Classify and categorize customer inquiries
 */
router.post('/classify-inquiry', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = inquiryClassificationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { inquiry } = validation.data;
    
    const result = await gpt5Service.classifyInquiry(inquiry);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      classification: result.content,
      responseId: result.responseId,
      usage: result.usage
    });

  } catch (error) {
    console.error('Inquiry classification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/gpt5/generate-code
 * Generate automation code
 */
router.post('/generate-code', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = codeGenerationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { requirements, codeType } = validation.data;
    
    const result = await gpt5Service.generateAutomationCode(requirements, codeType);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      code: result.content,
      responseId: result.responseId,
      usage: result.usage
    });

  } catch (error) {
    console.error('Code generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/ai/gpt5/custom-prompt
 * Execute custom prompt with specified configuration
 */
router.post('/custom-prompt', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = customPromptSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: validation.error.errors 
      });
    }

    const { prompt, configType = 'LEAD_ANALYSIS', previousResponseId } = validation.data;
    
    const config = GPT5_CONFIGS[configType];
    const result = await gpt5Service.generateResponse(prompt, config, previousResponseId);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      response: result.content,
      responseId: result.responseId,
      reasoning: result.reasoning,
      usage: result.usage
    });

  } catch (error) {
    console.error('Custom prompt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/ai/gpt5/configs
 * Get available GPT-5 configurations
 */
router.get('/configs', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    res.json({
      configs: Object.keys(GPT5_CONFIGS),
      descriptions: {
        LEAD_ANALYSIS: 'For CRM lead analysis and customer insights',
        PROPOSAL_GENERATION: 'For quote and proposal generation',
        SERVICE_ANALYSIS: 'For service ticket analysis and predictive maintenance',
        CUSTOMER_SUPPORT: 'For quick customer support responses',
        BUSINESS_ANALYTICS: 'For complex business analytics and forecasting',
        CODE_GENERATION: 'For code generation and technical tasks',
        CLASSIFICATION: 'For high-throughput classification tasks'
      }
    });

  } catch (error) {
    console.error('Config retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;