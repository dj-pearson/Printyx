import { Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { TenantRequest } from './middleware/tenancy';
import { db } from './db';

// Sales Pipeline Schema
const pipelineOpportunitySchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().min(1),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  stage: z.string(),
  estimated_value: z.number().min(0),
  probability: z.number().min(0).max(100),
  expected_close_date: z.string(),
  lead_source: z.string().optional(),
  notes: z.string().optional()
});

const stageUpdateSchema = z.object({
  stage: z.string(),
  notes: z.string().optional()
});

const activityLogSchema = z.object({
  activity_type: z.string(),
  notes: z.string()
});

// Pipeline Stages Configuration
const PIPELINE_STAGES = [
  { id: 'lead', name: 'New Lead', order: 1 },
  { id: 'contacted', name: 'First Contact', order: 2 },
  { id: 'demo_scheduled', name: 'Demo Scheduled', order: 3 },
  { id: 'demo_completed', name: 'Demo Completed', order: 4 },
  { id: 'proposal_prep', name: 'Proposal Prep', order: 5 },
  { id: 'proposal_sent', name: 'Proposal Sent', order: 6 },
  { id: 'negotiation', name: 'Negotiation', order: 7 },
  { id: 'closed_won', name: 'Closed Won', order: 8 },
  { id: 'closed_lost', name: 'Closed Lost', order: 9 }
];

export function setupSalesPipelineRoutes(app: any, storage: any, requireAuth: any) {
  
  // Get all pipeline opportunities
  app.get('/api/sales-pipeline/opportunities', requireAuth, async (req: TenantRequest, res: Response) => {
    try {
      const { stage, rep } = req.query;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Build query with filters
      let query = `
        SELECT 
          br.*,
          br.id as id,
          br.company_name as company_name,
          br.primary_contact_name as contact_name,
          br.primary_contact_email as contact_email,
          br.primary_contact_phone as contact_phone,
          br.status as stage,
          COALESCE(br.estimated_deal_value, 0) as estimated_value,
          COALESCE(br.probability, 50) as probability,
          COALESCE(br.close_date, NOW() + INTERVAL '30 days') as expected_close_date,
          br.source as lead_source,
          br.notes,
          br.owner_id as assigned_rep,
          br.last_contact_date as last_activity,
          COALESCE(EXTRACT(DAY FROM NOW() - br.updated_at), 0) as days_in_stage,
          br.created_at as created_at,
          CASE 
            WHEN br.next_follow_up_date IS NOT NULL THEN 
              'Follow up on ' || TO_CHAR(br.next_follow_up_date, 'Mon DD')
            ELSE 'Update required'
          END as next_action
        FROM business_records br
        WHERE br.tenant_id = $1 
          AND br.record_type = 'lead'
          AND br.status NOT IN ('closed_won', 'closed_lost')
      `;

      const params = [tenantId];
      let paramIndex = 2;

      if (stage && stage !== 'all') {
        query += ` AND br.status = $${paramIndex}`;
        params.push(stage);
        paramIndex++;
      }

      if (rep && rep !== 'all') {
        query += ` AND br.owner_id = $${paramIndex}`;
        params.push(rep);
        paramIndex++;
      }

      query += ` ORDER BY br.updated_at DESC`;

      const result = await db.execute(sql.raw(query, params));
      
      // Transform the results to match the expected format
      const opportunities = result.rows.map((row: any) => ({
        id: row.id,
        company_name: row.company_name,
        contact_name: row.contact_name,
        contact_email: row.contact_email,
        contact_phone: row.contact_phone,
        stage: row.stage || 'lead',
        estimated_value: parseFloat(row.estimated_value) || 0,
        probability: parseInt(row.probability) || 50,
        expected_close_date: row.expected_close_date || new Date().toISOString(),
        assigned_rep: row.assigned_rep,
        last_activity: row.last_activity || row.created_at,
        next_action: row.next_action,
        days_in_stage: parseInt(row.days_in_stage) || 0,
        created_at: row.created_at,
        notes: row.notes || '',
        lead_source: row.lead_source || 'Unknown'
      }));

      res.json(opportunities);
    } catch (error) {
      console.error('Error fetching pipeline opportunities:', error);
      res.status(500).json({ message: 'Failed to fetch pipeline opportunities' });
    }
  });

  // Update opportunity stage
  app.patch('/api/sales-pipeline/opportunities/:id/stage', requireAuth, async (req: TenantRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { stage, notes } = stageUpdateSchema.parse(req.body);
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Update the business record
      const updateQuery = `
        UPDATE business_records 
        SET 
          status = $1,
          notes = COALESCE(notes, '') || $2,
          updated_at = NOW(),
          last_contact_date = NOW()
        WHERE id = $3 AND tenant_id = $4
        RETURNING *
      `;

      const notesText = notes ? `\n[${new Date().toISOString()}] Stage moved to ${stage}: ${notes}` : '';
      
      const result = await db.execute(sql.raw(updateQuery, [stage, notesText, id, tenantId]));

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Opportunity not found' });
      }

      // Log the stage change activity
      const activityQuery = `
        INSERT INTO business_record_activities (
          business_record_id,
          activity_type,
          subject,
          description,
          created_by,
          tenant_id,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;

      await db.execute(sql.raw(activityQuery, [
        id,
        'stage_change',
        `Stage changed to ${PIPELINE_STAGES.find(s => s.id === stage)?.name || stage}`,
        notes || `Moved to ${stage} stage`,
        userId,
        tenantId
      ]));

      res.json({ success: true, opportunity: result.rows[0] });
    } catch (error) {
      console.error('Error updating opportunity stage:', error);
      res.status(500).json({ message: 'Failed to update opportunity stage' });
    }
  });

  // Log activity for opportunity
  app.post('/api/sales-pipeline/opportunities/:id/activity', requireAuth, async (req: TenantRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { activity_type, notes } = activityLogSchema.parse(req.body);
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Log the activity
      const activityQuery = `
        INSERT INTO business_record_activities (
          business_record_id,
          activity_type,
          subject,
          description,
          created_by,
          tenant_id,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;

      await db.execute(sql.raw(activityQuery, [
        id,
        activity_type,
        `${activity_type.charAt(0).toUpperCase() + activity_type.slice(1)} Activity`,
        notes,
        userId,
        tenantId
      ]));

      // Update last contact date on the business record
      const updateQuery = `
        UPDATE business_records 
        SET last_contact_date = NOW(), updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `;

      await db.execute(sql.raw(updateQuery, [id, tenantId]));

      res.json({ success: true });
    } catch (error) {
      console.error('Error logging activity:', error);
      res.status(500).json({ message: 'Failed to log activity' });
    }
  });

  // Get sales rep metrics
  app.get('/api/sales-pipeline/rep-metrics', requireAuth, async (req: TenantRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const metricsQuery = `
        WITH rep_stats AS (
          SELECT 
            u.id as rep_id,
            CONCAT(u.first_name, ' ', u.last_name) as rep_name,
            u.manager_id as manager_id,
            
            -- Lead metrics
            COUNT(br.id) FILTER (WHERE br.record_type = 'lead') as total_leads,
            COUNT(br.id) FILTER (WHERE br.record_type = 'lead' AND br.status IN ('qualified', 'demo_scheduled', 'demo_completed', 'proposal_prep', 'proposal_sent', 'negotiation')) as qualified_leads,
            COUNT(br.id) FILTER (WHERE br.status = 'demo_scheduled') as demos_scheduled,
            COUNT(br.id) FILTER (WHERE br.status = 'demo_completed') as demos_completed,
            COUNT(br.id) FILTER (WHERE br.status = 'proposal_sent') as proposals_sent,
            COUNT(br.id) FILTER (WHERE br.status = 'closed_won') as deals_closed,
            
            -- Revenue metrics
            COALESCE(SUM(br.estimated_deal_value) FILTER (WHERE br.status = 'closed_won'), 0) as total_revenue,
            COALESCE(AVG(br.estimated_deal_value) FILTER (WHERE br.status = 'closed_won'), 0) as avg_deal_size,
            
            -- Calculate average sales cycle (days from created to closed)
            COALESCE(AVG(EXTRACT(DAY FROM br.updated_at - br.created_at)) FILTER (WHERE br.status = 'closed_won'), 30) as avg_sales_cycle,
            
            -- Activity score based on recent activities
            CASE 
              WHEN MAX(br.last_contact_date) >= NOW() - INTERVAL '3 days' THEN 100
              WHEN MAX(br.last_contact_date) >= NOW() - INTERVAL '7 days' THEN 80
              WHEN MAX(br.last_contact_date) >= NOW() - INTERVAL '14 days' THEN 60
              WHEN MAX(br.last_contact_date) >= NOW() - INTERVAL '30 days' THEN 40
              ELSE 20
            END as activity_score,
            
            -- Last activity
            TO_CHAR(MAX(br.last_contact_date), 'MM/DD/YY') as last_activity
            
          FROM users u
          LEFT JOIN business_records br ON u.id = br.owner_id AND br.tenant_id = u.tenant_id
          WHERE u.tenant_id = $1 
            AND u.role IN ('sales_rep', 'sales_manager', 'account_manager')
          GROUP BY u.id, u.first_name, u.last_name, u.manager_id
        ),
        goals AS (
          SELECT 
            user_id,
            COALESCE(monthly_revenue_goal, 50000) as revenue_goal,
            COALESCE(monthly_deals_goal, 5) as deals_goal
          FROM crm_goals 
          WHERE tenant_id = $2 
            AND goal_type = 'monthly'
            AND is_active = true
        )
        SELECT 
          rs.*,
          COALESCE(g.revenue_goal, 50000) as revenue_goal,
          COALESCE(g.deals_goal, 5) as deals_goal,
          
          -- Goal achievement calculation
          CASE 
            WHEN COALESCE(g.revenue_goal, 50000) > 0 THEN 
              ROUND((rs.total_revenue / COALESCE(g.revenue_goal, 50000)) * 100, 1)
            ELSE 0 
          END as goal_achievement,
          
          -- Conversion rate
          CASE 
            WHEN rs.total_leads > 0 THEN 
              ROUND((rs.deals_closed::numeric / rs.total_leads::numeric) * 100, 1)
            ELSE 0 
          END as conversion_rate
          
        FROM rep_stats rs
        LEFT JOIN goals g ON rs.rep_id = g.user_id
        ORDER BY rs.rep_name
      `;

      const result = await db.execute(sql.raw(metricsQuery, [tenantId, tenantId]));
      
      const metrics = result.rows.map((row: any) => ({
        rep_id: row.rep_id,
        rep_name: row.rep_name,
        manager_id: row.manager_id,
        total_leads: parseInt(row.total_leads) || 0,
        qualified_leads: parseInt(row.qualified_leads) || 0,
        demos_scheduled: parseInt(row.demos_scheduled) || 0,
        demos_completed: parseInt(row.demos_completed) || 0,
        proposals_sent: parseInt(row.proposals_sent) || 0,
        deals_closed: parseInt(row.deals_closed) || 0,
        total_revenue: parseFloat(row.total_revenue) || 0,
        conversion_rate: parseFloat(row.conversion_rate) || 0,
        avg_deal_size: parseFloat(row.avg_deal_size) || 0,
        avg_sales_cycle: parseFloat(row.avg_sales_cycle) || 30,
        goal_achievement: parseFloat(row.goal_achievement) || 0,
        activity_score: parseInt(row.activity_score) || 0,
        last_activity: row.last_activity || 'No recent activity'
      }));

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching rep metrics:', error);
      res.status(500).json({ message: 'Failed to fetch rep metrics' });
    }
  });

  // Get pipeline summary
  app.get('/api/sales-pipeline/summary', requireAuth, async (req: TenantRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const summaryQuery = `
        WITH pipeline_metrics AS (
          SELECT 
            -- Total pipeline value
            COALESCE(SUM(br.estimated_deal_value) FILTER (WHERE br.record_type = 'lead' AND br.status NOT IN ('closed_won', 'closed_lost')), 0) as total_value,
            
            -- Active opportunities
            COUNT(br.id) FILTER (WHERE br.record_type = 'lead' AND br.status NOT IN ('closed_won', 'closed_lost')) as active_opportunities,
            
            -- Qualified opportunities
            COUNT(br.id) FILTER (WHERE br.status IN ('qualified', 'demo_scheduled', 'demo_completed', 'proposal_prep', 'proposal_sent', 'negotiation')) as qualified_opportunities,
            
            -- This month closed revenue
            COALESCE(SUM(br.estimated_deal_value) FILTER (WHERE br.status = 'closed_won' AND br.updated_at >= DATE_TRUNC('month', NOW())), 0) as monthly_revenue,
            
            -- Conversion rate
            CASE 
              WHEN COUNT(br.id) FILTER (WHERE br.record_type = 'lead') > 0 THEN
                ROUND((COUNT(br.id) FILTER (WHERE br.status = 'closed_won')::numeric / COUNT(br.id) FILTER (WHERE br.record_type = 'lead')::numeric) * 100, 1)
              ELSE 0
            END as conversion_rate,
            
            -- Average sales cycle
            COALESCE(AVG(EXTRACT(DAY FROM br.updated_at - br.created_at)) FILTER (WHERE br.status = 'closed_won'), 30) as avg_sales_cycle,
            
            -- Growth rate (this month vs last month)
            CASE 
              WHEN LAG(SUM(br.estimated_deal_value) FILTER (WHERE br.status = 'closed_won' AND br.updated_at >= DATE_TRUNC('month', NOW()))) OVER () > 0 THEN
                ROUND(((SUM(br.estimated_deal_value) FILTER (WHERE br.status = 'closed_won' AND br.updated_at >= DATE_TRUNC('month', NOW())) / 
                       LAG(SUM(br.estimated_deal_value) FILTER (WHERE br.status = 'closed_won' AND br.updated_at >= DATE_TRUNC('month', NOW()))) OVER ()) - 1) * 100, 1)
              ELSE 0
            END as growth_rate
            
          FROM business_records br
          WHERE br.tenant_id = $1
        ),
        goals_summary AS (
          SELECT 
            COALESCE(SUM(monthly_revenue_goal), 200000) as total_revenue_goal
          FROM crm_goals 
          WHERE tenant_id = $2 
            AND goal_type = 'monthly'
            AND is_active = true
        )
        SELECT 
          pm.*,
          gs.total_revenue_goal,
          CASE 
            WHEN gs.total_revenue_goal > 0 THEN
              ROUND((pm.monthly_revenue / gs.total_revenue_goal) * 100, 1)
            ELSE 0
          END as goal_achievement
        FROM pipeline_metrics pm
        CROSS JOIN goals_summary gs
      `;

      const result = await db.execute(sql.raw(summaryQuery, [tenantId, tenantId]));
      
      if (result.rows.length === 0) {
        return res.json({
          totalValue: 0,
          activeOpportunities: 0,
          qualifiedOpportunities: 0,
          monthlyRevenue: 0,
          conversionRate: 0,
          avgSalesCycle: 30,
          growthRate: 0,
          goalAchievement: 0
        });
      }

      const summary = result.rows[0];
      res.json({
        totalValue: parseFloat(summary.total_value) || 0,
        activeOpportunities: parseInt(summary.active_opportunities) || 0,
        qualifiedOpportunities: parseInt(summary.qualified_opportunities) || 0,
        monthlyRevenue: parseFloat(summary.monthly_revenue) || 0,
        conversionRate: parseFloat(summary.conversion_rate) || 0,
        avgSalesCycle: parseFloat(summary.avg_sales_cycle) || 30,
        growthRate: parseFloat(summary.growth_rate) || 0,
        goalAchievement: parseFloat(summary.goal_achievement) || 0
      });
    } catch (error) {
      console.error('Error fetching pipeline summary:', error);
      res.status(500).json({ message: 'Failed to fetch pipeline summary' });
    }
  });

  // Create new opportunity
  app.post('/api/sales-pipeline/opportunities', requireAuth, async (req: TenantRequest, res: Response) => {
    try {
      const data = pipelineOpportunitySchema.parse(req.body);
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const insertQuery = `
        INSERT INTO business_records (
          tenant_id,
          record_type,
          company_name,
          primary_contact_name,
          primary_contact_email,
          primary_contact_phone,
          status,
          estimated_deal_value,
          probability,
          close_date,
          source,
          owner_id,
          created_by,
          notes,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING *
      `;

      const result = await db.execute(sql.raw(insertQuery, [
        tenantId,
        'lead',
        data.company_name,
        data.contact_name,
        data.contact_email,
        data.contact_phone || null,
        data.stage,
        data.estimated_value,
        data.probability,
        data.expected_close_date,
        data.lead_source || 'Manual Entry',
        userId, // Assign to creator by default
        userId,
        data.notes || ''
      ]));

      res.status(201).json({ success: true, opportunity: result.rows[0] });
    } catch (error) {
      console.error('Error creating opportunity:', error);
      res.status(500).json({ message: 'Failed to create opportunity' });
    }
  });
}