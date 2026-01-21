# Workflow Automation System - Technical Documentation

## Overview

The Workflow Automation System enables copier dealers to create, manage, and execute automated business workflows. This comprehensive platform eliminates manual processes, reduces errors, and ensures consistent execution of routine tasks across customer management, service operations, financial processes, and sales activities.

## System Architecture

### Database Schema (13 Tables)

#### Core Workflow Tables

**1. workflows**

- Primary workflow definitions and metadata
- Fields: id, tenant_id, name, description, category, status (draft/active/paused/archived), is_template, current_version_id
- Tracks: created_by, last_modified_by, created_at, updated_at

**2. workflow_versions**

- Immutable version history for workflows
- Fields: id, workflow_id, version (integer), definition (JSONB), schema_hash, changelog
- Enables: rollback, version comparison, audit trails

**3. workflow_triggers**

- Event-based and scheduled workflow triggers
- Types: event (business events), schedule (cron), webhook (external systems), manual
- Fields: workflow_id, type, event_name, webhook_path, payload_mapping, enabled

**4. trigger_schedules**

- Cron-based scheduling configuration
- Fields: trigger_id, cron_expression, timezone, next_run_at, last_run_at, run_count, enabled

**5. workflow_conditions**

- Business logic conditions for triggers and steps
- Supports: AND/OR logic, data type validation, complex expressions
- Fields: trigger_id/step_id, condition_group, logical_operator, left_operand, operator, right_operand, data_type

**6. workflow_steps_automation**

- Individual workflow actions and operations
- Action types: email, sms, create_task, update_crm, database_update, call_integration, transform_data, etc.
- Fields: workflow_id, name, action_type, config (JSONB), order_index, retry settings, timeout_seconds

**7. workflow_step_transitions**

- Step routing logic based on outcomes
- Supports: conditional branching, error handling, success paths
- Fields: from_step_id, to_step_id, condition_type, condition_expression

#### Execution & Monitoring Tables

**8. workflow_executions**

- Runtime execution tracking
- Statuses: queued, running, completed, failed, cancelled, timeout
- Fields: workflow_id, workflow_version_id, trigger_id, tenant_id, status, context, result, error, started_at, completed_at

**9. workflow_execution_steps**

- Individual step execution tracking
- Fields: execution_id, step_id, status, input_data, output_data, error_details, retry_count, started_at, completed_at

**10. workflow_execution_events**

- Complete audit trail of execution lifecycle
- Event types: execution_started, step_started, step_completed, step_failed, execution_completed, execution_failed
- Fields: execution_id, step_execution_id, event_type, message, event_data, created_at

#### Template & Event Management

**11. workflow_templates**

- Pre-built workflow blueprints
- Categories: Customer Management, Service Management, Financial Operations, Sales, etc.
- Fields: name, description, category, version, definition (JSONB), complexity, estimated_time_saved, featured, usage_count

**12. template_variables**

- Configurable template parameters
- Fields: template_id, variable_name, variable_type, default_value, is_required, validation_rules, description

**13. workflow_event_registry**

- Available business events catalog
- Fields: event_name, display_name, description, category, payload_schema, example_payload, is_active

### Storage Layer (35+ Methods)

#### Workflow Operations

- `createWorkflow(data)` - Create new workflow
- `getWorkflow(id)` - Get workflow by ID
- `getWorkflows(tenantId, status?)` - List workflows
- `updateWorkflow(id, data)` - Update workflow
- `deleteWorkflow(id)` - Delete workflow

#### Version Management

- `createWorkflowVersion(data)` - Create new version
- `getWorkflowVersions(workflowId)` - Get all versions
- `getWorkflowVersion(id)` - Get specific version
- `getLatestWorkflowVersion(workflowId)` - Get current version

#### Trigger Management

- `createWorkflowTrigger(data)` - Create trigger
- `getWorkflowTriggers(workflowId)` - List triggers
- `getWorkflowTrigger(id)` - Get trigger
- `updateWorkflowTrigger(id, data)` - Update trigger
- `deleteWorkflowTrigger(id)` - Delete trigger
- `getTriggersByEventName(eventName)` - Find triggers by event

#### Schedule Management

- `createTriggerSchedule(data)` - Create schedule
- `getTriggerSchedule(triggerId)` - Get schedule
- `updateTriggerSchedule(id, data)` - Update schedule
- `getDueScheduledTriggers()` - Get due triggers

#### Step Management

- `createWorkflowStep(data)` - Create step
- `getWorkflowSteps(workflowId)` - List steps
- `updateWorkflowStep(id, data)` - Update step
- `deleteWorkflowStep(id)` - Delete step

#### Execution Management

- `createWorkflowExecution(data)` - Start execution
- `getWorkflowExecution(id)` - Get execution
- `getWorkflowExecutions(workflowId, limit)` - List executions
- `getWorkflowExecutionsByTenant(tenantId, limit)` - Tenant executions
- `updateWorkflowExecution(id, data)` - Update execution
- `getQueuedExecutions(limit)` - Get queued executions

#### Execution Step Tracking

- `createExecutionStep(data)` - Track step execution
- `getExecutionSteps(executionId)` - Get all step executions
- `updateExecutionStep(id, data)` - Update step execution

#### Execution Events (Audit Trail)

- `createExecutionEvent(data)` - Log execution event
- `getExecutionEvents(executionId)` - Get execution audit trail

#### Condition Management

- `createWorkflowCondition(data)` - Create condition
- `getWorkflowConditions(triggerId?, stepId?)` - List conditions
- `deleteWorkflowCondition(id)` - Delete condition

#### Template Operations

- `createWorkflowTemplate(data)` - Create template
- `getWorkflowTemplate(id)` - Get template
- `getWorkflowTemplates(category?)` - List templates
- `updateWorkflowTemplate(id, data)` - Update template
- `incrementTemplateUsage(id)` - Track usage

#### Template Variables

- `createTemplateVariable(data)` - Define variable
- `getTemplateVariables(templateId)` - Get variables

#### Event Registry

- `createEventRegistryEntry(data)` - Register event
- `getEventRegistryEntries(category?)` - List events
- `getEventRegistryEntry(eventName)` - Get event

#### Analytics

- `getWorkflowExecutionStats(workflowId)` - Get workflow statistics

### API Endpoints (25+)

#### Workflow CRUD

- `POST /api/workflows` - Create workflow
- `GET /api/workflows` - List workflows (filtered by status)
- `GET /api/workflows/:id` - Get workflow details (with triggers, steps, versions)
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow

#### Trigger Management

- `POST /api/workflows/:workflowId/triggers` - Create trigger
- `GET /api/workflows/:workflowId/triggers` - List triggers (with schedules)
- `PUT /api/triggers/:id` - Update trigger
- `DELETE /api/triggers/:id` - Delete trigger

#### Step Management

- `POST /api/workflows/:workflowId/steps` - Create step
- `GET /api/workflows/:workflowId/steps` - List steps
- `PUT /api/steps/:id` - Update step
- `DELETE /api/steps/:id` - Delete step

#### Workflow Execution

- `POST /api/workflows/:id/execute` - Manually trigger workflow
- `GET /api/workflows/:id/executions` - List workflow executions
- `GET /api/executions/:id` - Get execution details (with steps and events)
- `GET /api/executions` - List recent tenant executions

#### Templates

- `GET /api/workflow-templates` - List all templates (filtered by category)
- `GET /api/workflow-templates/:id` - Get template details (with variables)
- `POST /api/workflow-templates/:id/clone` - Clone template as new workflow

#### Event Registry

- `GET /api/workflow-events` - List available business events (filtered by category)

#### Analytics & Monitoring

- `GET /api/workflows/:id/stats` - Get workflow execution statistics
- `GET /api/dashboard` - Get workflow automation dashboard overview

## Pre-Built Workflow Templates

### 1. Customer Onboarding Automation

**Category:** Customer Management  
**Complexity:** Moderate  
**Time Saved:** 3 hours per customer

**Workflow:**

1. **Trigger:** Customer Created (contractValue > $1,000)
2. **Steps:**
   - Send welcome email to customer
   - Create onboarding checklist task (7-day due date)
   - Schedule equipment installation appointment (2 hours)
   - Update CRM status to "onboarding_in_progress"

**Benefits:**

- Consistent onboarding experience
- No missed steps
- Automatic team coordination
- Customer engagement from day one

### 2. Equipment Maintenance Alert Workflow

**Category:** Service Management  
**Complexity:** Simple  
**Time Saved:** 2 hours per maintenance cycle

**Workflow:**

1. **Trigger:** Maintenance Due event
2. **Steps:**
   - Check equipment status (meter readings, error logs)
   - Generate preventive maintenance service ticket
   - Notify customer via email and SMS
   - Auto-order parts if needed (based on inventory check)

**Benefits:**

- Proactive maintenance scheduling
- Reduced equipment downtime
- Customer satisfaction
- Parts availability

### 3. Invoice Processing Automation

**Category:** Financial Operations  
**Complexity:** Moderate  
**Time Saved:** 4 hours per billing cycle

**Workflow:**

1. **Trigger:** Monthly schedule (1st of each month at midnight)
2. **Steps:**
   - Gather billing data (meter readings, service calls, contracts)
   - Calculate charges (tiered pricing, service fees, discounts)
   - Generate PDF invoice
   - Email invoice to customer with attachment
   - Sync to QuickBooks Online

**Benefits:**

- Error-free invoicing
- Timely billing cycles
- Accounting synchronization
- Professional invoice delivery

### 4. Quote Follow-up Automation

**Category:** Sales  
**Complexity:** Simple  
**Time Saved:** 1.5 hours per quote

**Workflow:**

1. **Trigger:** Quote Approved event
2. **Steps:**
   - Send thank you email to customer
   - Convert quote to contract
   - Create implementation task list
   - Update CRM to "closed_won" status

**Benefits:**

- Fast quote-to-contract conversion
- No lost opportunities
- Smooth handoff to implementation
- Accurate sales pipeline

## Business Event Registry

The system provides 8 pre-configured business events:

### Customer Management Events

- **customer_created** - New customer added
- **customer_updated** - Customer information modified

### Service Management Events

- **ticket_created** - New service ticket
- **maintenance_due** - Equipment maintenance scheduled

### Financial Operations Events

- **invoice_generated** - New invoice created

### Sales Events

- **quote_approved** - Customer approved quote

### Lease Management Events

- **lease_renewal_pending** - Lease approaching renewal date

### Equipment Monitoring Events

- **meter_anomaly_detected** - Unusual meter readings

Each event includes:

- Payload schema definition
- Example payload
- Category classification
- Active/inactive status

## Workflow Definition Structure

### Workflow Configuration (JSONB)

```json
{
  "triggers": [
    {
      "type": "event|schedule|webhook|manual",
      "eventName": "customer_created",
      "conditions": [
        {
          "field": "contractValue",
          "operator": "greater_than",
          "value": 1000
        }
      ]
    }
  ],
  "steps": [
    {
      "orderIndex": 0,
      "name": "Send Welcome Email",
      "actionType": "email",
      "config": {
        "template": "welcome_customer",
        "to": "{{customer.email}}",
        "subject": "Welcome to {{company.name}}!"
      }
    }
  ]
}
```

### Action Types

**Communication:**

- `email` - Send email message
- `sms` - Send SMS notification
- `send_notification` - Multi-channel notification

**Task Management:**

- `create_task` - Create task/checklist
- `schedule_appointment` - Schedule calendar event

**Data Operations:**

- `database_update` - Update database records
- `update_crm` - Update CRM system
- `transform_data` - Data transformation

**Integration:**

- `call_integration` - External API call
- `generate_invoice` - Create invoice
- `order_parts` - Inventory/parts order

### Condition Operators

- `equals`, `not_equals`
- `greater_than`, `less_than`
- `greater_than_or_equal`, `less_than_or_equal`
- `contains`, `not_contains`
- `starts_with`, `ends_with`
- `in_list`, `not_in_list`
- `is_null`, `is_not_null`
- `matches_regex`

### Data Types

- `string`
- `number`
- `boolean`
- `date`
- `datetime`
- `json`

## Execution Model

### Workflow Lifecycle

1. **Queued** - Execution created, waiting to start
2. **Running** - Steps being processed
3. **Completed** - All steps successful
4. **Failed** - Error occurred
5. **Cancelled** - Manually stopped
6. **Timeout** - Exceeded time limit

### Step Execution

Each step tracks:

- Input data (context variables)
- Output data (step results)
- Retry count (automatic retries on failure)
- Error details (if failed)
- Execution time (started_at, completed_at)

### Retry Logic

Steps support automatic retry with:

- `retryEnabled` - Enable/disable retries
- `maxRetries` - Maximum retry attempts (default: 3)
- `retryDelaySeconds` - Delay between retries (default: 60)
- `continueOnError` - Continue workflow on step failure

### Audit Trail

Every execution event is logged:

- Execution started/completed/failed
- Step started/completed/failed
- Retry attempts
- Condition evaluations
- Error details

## Analytics & Monitoring

### Workflow Statistics

For each workflow, track:

- Total executions
- Successful executions
- Failed executions
- Average execution time (milliseconds)
- Success rate (percentage)

### Dashboard Overview

Tenant-level metrics:

- Total workflows
- Active workflows
- Paused/draft workflows
- Total executions
- Success/failure counts
- Running executions
- Recent execution history

## Security & Access Control

### Tenant Isolation

All workflow data is tenant-scoped:

- Workflows isolated by `tenant_id`
- Executions scoped to tenant
- Templates available across all tenants
- Event registry shared globally

### Authentication

All API endpoints require:

- Valid session (`req.session?.user`)
- Returns 401 Unauthorized if missing
- Validates tenant ownership for operations

### Audit Logging

Complete audit trail includes:

- Who created/modified workflows
- Execution history with timestamps
- Step-level execution details
- Event logs with context data

## Future Enhancements (Deferred)

### Workflow Execution Engine

A dedicated execution engine service will provide:

- Real-time workflow orchestration
- Parallel step execution
- Dynamic condition evaluation
- Action handler registry
- Error recovery mechanisms

### Event Bus System

A message queue system for:

- Async business event processing
- Reliable event delivery
- Event replay capabilities
- Dead letter queues
- Event transformations

## Technical Implementation

### Database Indexes

Critical indexes for performance:

- `workflows` - (tenant_id, status), (created_at)
- `workflow_executions` - (workflow_id, created_at), (tenant_id, status)
- `workflow_triggers` - (workflow_id), (event_name, enabled)
- `workflow_steps_automation` - (workflow_id, order_index)

### Data Retention

- Workflow definitions: Permanent
- Execution history: 90 days (configurable)
- Execution events: 90 days (configurable)
- Template definitions: Permanent

## Usage Examples

### Creating a Workflow from Template

```typescript
// 1. List available templates
GET /api/workflow-templates?category=Customer%20Management

// 2. Clone template
POST /api/workflow-templates/:templateId/clone
{
  "name": "Customer Onboarding - Enterprise",
  "variableValues": {
    "minimumContractValue": 5000,
    "assignToTeam": "enterprise_success"
  }
}

// 3. Customize workflow steps, triggers, conditions as needed

// 4. Activate workflow
PUT /api/workflows/:id
{
  "status": "active"
}
```

### Manual Workflow Execution

```typescript
POST /api/workflows/:id/execute
{
  "context": {
    "customer": {
      "id": "cust_12345",
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "contractValue": 25000
    }
  }
}
```

### Monitoring Execution

```typescript
// Get execution details
GET /api/executions/:executionId

// Response includes:
{
  "id": "exec_...",
  "status": "running",
  "context": { ... },
  "steps": [
    {
      "stepId": "step_1",
      "name": "Send Welcome Email",
      "status": "completed",
      "startedAt": "...",
      "completedAt": "..."
    }
  ],
  "events": [
    {
      "eventType": "execution_started",
      "message": "...",
      "createdAt": "..."
    }
  ]
}
```

## Best Practices

### Workflow Design

- Keep workflows focused on single business processes
- Use descriptive names and documentation
- Test with sample data before activating
- Version workflows for major changes

### Error Handling

- Enable retries for transient failures
- Use `continueOnError` for non-critical steps
- Monitor failed executions regularly
- Set appropriate timeout values

### Performance

- Minimize step count for faster execution
- Use efficient database queries in conditions
- Batch similar operations
- Consider async patterns for long operations

### Maintenance

- Review workflow statistics monthly
- Archive inactive workflows
- Clean up old execution history
- Update templates as business processes evolve

## Support & Troubleshooting

### Common Issues

**Workflow not triggering:**

- Check trigger enabled status
- Verify event name matches registry
- Review trigger conditions
- Confirm workflow status is "active"

**Step failures:**

- Check step configuration
- Review error details in execution events
- Verify integration credentials
- Check timeout settings

**Performance issues:**

- Review execution times in statistics
- Optimize condition logic
- Reduce unnecessary steps
- Check for external API latency

### Monitoring Best Practices

1. Set up alerts for failed executions
2. Monitor success rates weekly
3. Review average execution times
4. Track template usage patterns
5. Audit workflow modifications

## Conclusion

The Workflow Automation System provides a comprehensive platform for automating copier dealer business processes. With 13 database tables, 35+ storage methods, 25+ API endpoints, and 4 pre-built templates, it delivers immediate value while providing a foundation for future enhancements.

**Current Implementation Status:**

- ✅ Complete database schema with indexes
- ✅ Full storage layer with CRUD operations
- ✅ Comprehensive API endpoints
- ✅ Pre-built workflow templates
- ✅ Business event registry
- ✅ Sample data and executions
- ⏳ Workflow execution engine (deferred)
- ⏳ Event bus system (deferred)

The system is production-ready for workflow design, template management, and manual execution, with automated execution capabilities planned for a future release.
