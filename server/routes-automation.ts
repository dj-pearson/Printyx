/**
 * Automation Routes Module
 * Handles automation-related endpoints:
 * - /api/automation/rules - Automation rules CRUD
 * - /api/automation/tasks - Automated tasks CRUD
 *
 * Phase 3 Routes Refactor - Migrated from routes.ts
 */

import type { Express } from 'express';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { resolveTenant, requireTenant } from './middleware/tenancy';
import { getUserId, getTenantId } from './utils/auth-helpers';

export function registerAutomationRoutes(app: Express) {
  // Apply authentication to all automation routes
  app.use('/api/automation', isAuthenticated);

  // ============================================
  // Automation Rules API routes
  // ============================================

  // GET /api/automation/rules - List automation rules
  app.get('/api/automation/rules', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const query = `
        SELECT *
        FROM automation_rules
        WHERE tenant_id = $1
        ORDER BY is_active DESC, priority DESC, created_at DESC
      `;

      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching automation rules:', error);
      res.status(500).json({ error: 'Failed to fetch automation rules' });
    }
  });

  // POST /api/automation/rules - Create automation rule
  app.post('/api/automation/rules', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || getTenantId(req);
      const userId = req.user?.id || getUserId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const {
        rule_name,
        rule_description,
        rule_category,
        priority,
        is_critical,
        delay_before_action,
        max_executions_per_day,
        bypass_business_hours,
      } = req.body;

      // Create basic rule configuration
      const triggerEvents = ['entity_created', 'entity_updated'];
      const conditions = { logic: 'AND', rules: [] };
      const actions = [{ type: 'notify', target: 'admin' }];

      const query = `
        INSERT INTO automation_rules (
          tenant_id, rule_name, rule_description, rule_category, priority,
          is_critical, delay_before_action, max_executions_per_day,
          bypass_business_hours, trigger_events, conditions, actions, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const result = await db.$client.query(query, [
        tenantId,
        rule_name,
        rule_description,
        rule_category,
        priority,
        is_critical,
        delay_before_action,
        max_executions_per_day,
        bypass_business_hours,
        JSON.stringify(triggerEvents),
        JSON.stringify(conditions),
        JSON.stringify(actions),
        userId,
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating automation rule:', error);
      res.status(500).json({ error: 'Failed to create automation rule' });
    }
  });

  // PUT /api/automation/rules/:id - Update automation rule
  app.put('/api/automation/rules/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const {
        rule_name,
        rule_description,
        rule_category,
        priority,
        is_active,
        is_critical,
        delay_before_action,
        max_executions_per_day,
        bypass_business_hours,
        trigger_events,
        conditions,
        actions,
      } = req.body;

      const query = `
        UPDATE automation_rules
        SET
          rule_name = COALESCE($1, rule_name),
          rule_description = COALESCE($2, rule_description),
          rule_category = COALESCE($3, rule_category),
          priority = COALESCE($4, priority),
          is_active = COALESCE($5, is_active),
          is_critical = COALESCE($6, is_critical),
          delay_before_action = COALESCE($7, delay_before_action),
          max_executions_per_day = COALESCE($8, max_executions_per_day),
          bypass_business_hours = COALESCE($9, bypass_business_hours),
          trigger_events = COALESCE($10, trigger_events),
          conditions = COALESCE($11, conditions),
          actions = COALESCE($12, actions),
          updated_at = NOW()
        WHERE id = $13 AND tenant_id = $14
        RETURNING *
      `;

      const result = await db.$client.query(query, [
        rule_name,
        rule_description,
        rule_category,
        priority,
        is_active,
        is_critical,
        delay_before_action,
        max_executions_per_day,
        bypass_business_hours,
        trigger_events ? JSON.stringify(trigger_events) : null,
        conditions ? JSON.stringify(conditions) : null,
        actions ? JSON.stringify(actions) : null,
        id,
        tenantId,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Automation rule not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating automation rule:', error);
      res.status(500).json({ error: 'Failed to update automation rule' });
    }
  });

  // DELETE /api/automation/rules/:id - Delete automation rule
  app.delete('/api/automation/rules/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const query = `
        DELETE FROM automation_rules
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `;

      const result = await db.$client.query(query, [id, tenantId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Automation rule not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting automation rule:', error);
      res.status(500).json({ error: 'Failed to delete automation rule' });
    }
  });

  // ============================================
  // Automated Tasks API routes
  // ============================================

  // GET /api/automation/tasks - List automated tasks
  app.get('/api/automation/tasks', resolveTenant, async (req: any, res) => {
    try {
      const priority = String((req.query as any)?.priority || '');
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      let whereConditions = ['tenant_id = $1'];
      const queryParams: any[] = [tenantId];

      if (priority && priority !== 'all') {
        whereConditions.push(`priority = $${queryParams.length + 1}`);
        queryParams.push(priority);
      }

      const query = `
        SELECT *
        FROM automated_tasks
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY urgency_score DESC, created_at DESC
      `;

      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching automated tasks:', error);
      res.status(500).json({ error: 'Failed to fetch automated tasks' });
    }
  });

  // POST /api/automation/tasks - Create automated task
  app.post('/api/automation/tasks', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const {
        task_title,
        task_description,
        task_type,
        task_category,
        priority,
        urgency_score,
        estimated_duration_minutes,
        due_date,
        assigned_to,
      } = req.body;

      const query = `
        INSERT INTO automated_tasks (
          tenant_id, task_title, task_description, task_type, task_category,
          priority, urgency_score, estimated_duration_minutes, due_date,
          assigned_to, automation_trigger
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const result = await db.$client.query(query, [
        tenantId,
        task_title,
        task_description,
        task_type,
        task_category,
        priority,
        urgency_score,
        estimated_duration_minutes,
        due_date,
        assigned_to,
        'manual_creation',
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating automated task:', error);
      res.status(500).json({ error: 'Failed to create automated task' });
    }
  });

  // PUT /api/automation/tasks/:id - Update automated task
  app.put('/api/automation/tasks/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const {
        task_title,
        task_description,
        status,
        priority,
        urgency_score,
        due_date,
        assigned_to,
        completed_at,
      } = req.body;

      const query = `
        UPDATE automated_tasks
        SET
          task_title = COALESCE($1, task_title),
          task_description = COALESCE($2, task_description),
          status = COALESCE($3, status),
          priority = COALESCE($4, priority),
          urgency_score = COALESCE($5, urgency_score),
          due_date = COALESCE($6, due_date),
          assigned_to = COALESCE($7, assigned_to),
          completed_at = COALESCE($8, completed_at),
          updated_at = NOW()
        WHERE id = $9 AND tenant_id = $10
        RETURNING *
      `;

      const result = await db.$client.query(query, [
        task_title,
        task_description,
        status,
        priority,
        urgency_score,
        due_date,
        assigned_to,
        completed_at,
        id,
        tenantId,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Automated task not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating automated task:', error);
      res.status(500).json({ error: 'Failed to update automated task' });
    }
  });

  // DELETE /api/automation/tasks/:id - Delete automated task
  app.delete('/api/automation/tasks/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || getTenantId(req);

      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const query = `
        DELETE FROM automated_tasks
        WHERE id = $1 AND tenant_id = $2
        RETURNING id
      `;

      const result = await db.$client.query(query, [id, tenantId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Automated task not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting automated task:', error);
      res.status(500).json({ error: 'Failed to delete automated task' });
    }
  });
}

export default { registerAutomationRoutes };
