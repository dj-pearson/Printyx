class CRMWorkflowManager {
    constructor() {
        this.workflows = new Map();
        this.stageDefinitions = this.initializeStageDefinitions();
        this.roleAssignments = this.initializeRoleAssignments();
    }

    initializeStageDefinitions() {
        return {
            // Stage 1: Lead Acquisition & Qualification
            'lead_submission': {
                stage: 1,
                name: 'Lead Submission',
                description: 'Initial lead captured from various sources',
                nextActions: ['lead_validation'],
                requiredFields: ['contact_info', 'initial_inquiry'],
                estimatedDuration: '1-2 hours',
                assignedRole: 'lead_processor'
            },
            'lead_validation': {
                stage: 1,
                name: 'Lead Validation & Data Enrichment',
                description: 'Verify lead information and enrich data',
                nextActions: ['lead_scoring'],
                requiredFields: ['validated_contact', 'company_details'],
                estimatedDuration: '2-4 hours',
                assignedRole: 'lead_processor'
            },
            'lead_scoring': {
                stage: 1,
                name: 'Lead Scoring & Qualification',
                description: 'Score lead based on qualification criteria',
                nextActions: ['sales_assignment'],
                requiredFields: ['qualification_score', 'budget_qualification'],
                estimatedDuration: '1 hour',
                assignedRole: 'sales_manager'
            },
            'sales_assignment': {
                stage: 1,
                name: 'Sales Rep Assignment',
                description: 'Assign qualified lead to appropriate sales rep',
                nextActions: ['discovery_scheduled'],
                requiredFields: ['assigned_sales_rep', 'territory_match'],
                estimatedDuration: '30 minutes',
                assignedRole: 'sales_manager'
            },

            // Stage 2: Sales Process
            'discovery_scheduled': {
                stage: 2,
                name: 'Discovery Call Scheduled',
                description: 'Initial discovery call scheduled with prospect',
                nextActions: ['discovery_completed'],
                requiredFields: ['call_datetime', 'attendees'],
                estimatedDuration: '24-48 hours',
                assignedRole: 'sales_rep'
            },
            'discovery_completed': {
                stage: 2,
                name: 'Discovery Call Completed',
                description: 'Initial discovery call completed and documented',
                nextActions: ['demo_scheduled', 'proposal_development'],
                requiredFields: ['call_notes', 'requirements_captured'],
                estimatedDuration: '1 hour',
                assignedRole: 'sales_rep'
            },
            'demo_scheduled': {
                stage: 2,
                name: 'Demo Scheduled',
                description: 'Product demonstration scheduled',
                nextActions: ['demo_delivered'],
                requiredFields: ['demo_datetime', 'demo_requirements'],
                estimatedDuration: '3-7 days',
                assignedRole: 'sales_rep'
            },
            'demo_delivered': {
                stage: 2,
                name: 'Demo Delivered',
                description: 'Product demonstration completed',
                nextActions: ['proposal_development'],
                requiredFields: ['demo_feedback', 'technical_requirements'],
                estimatedDuration: '1 hour',
                assignedRole: 'sales_rep'
            },
            'proposal_development': {
                stage: 2,
                name: 'Proposal Development',
                description: 'Custom proposal being developed',
                nextActions: ['proposal_sent'],
                requiredFields: ['pricing_details', 'solution_specs'],
                estimatedDuration: '2-5 days',
                assignedRole: 'sales_rep'
            },
            'proposal_sent': {
                stage: 2,
                name: 'Proposal Sent',
                description: 'Proposal sent to prospect for review',
                nextActions: ['contract_negotiation'],
                requiredFields: ['proposal_sent_date', 'follow_up_scheduled'],
                estimatedDuration: '5-14 days',
                assignedRole: 'sales_rep'
            },

            // Stage 3: Contract Management
            'contract_negotiation': {
                stage: 3,
                name: 'Contract Negotiation',
                description: 'Contract terms being negotiated',
                nextActions: ['contract_sent'],
                requiredFields: ['negotiation_notes', 'final_terms'],
                estimatedDuration: '3-10 days',
                assignedRole: 'sales_rep'
            },
            'contract_sent': {
                stage: 3,
                name: 'Contract Sent for Signature',
                description: 'Final contract sent for customer signature',
                nextActions: ['contract_signed'],
                requiredFields: ['contract_sent_date', 'signature_method'],
                estimatedDuration: '2-7 days',
                assignedRole: 'contracts_admin'
            },
            'contract_signed': {
                stage: 3,
                name: 'Contract Signed & Closed',
                description: 'Contract fully executed and deal closed',
                nextActions: ['payment_confirmed'],
                requiredFields: ['signed_contract', 'deal_value'],
                estimatedDuration: '1 day',
                assignedRole: 'contracts_admin'
            },
            'payment_confirmed': {
                stage: 3,
                name: 'Payment Terms Confirmed',
                description: 'Payment setup and terms confirmed',
                nextActions: ['order_processing'],
                requiredFields: ['payment_method', 'billing_schedule'],
                estimatedDuration: '1-2 days',
                assignedRole: 'accounting'
            },

            // Stage 4: Production & Fulfillment
            'order_processing': {
                stage: 4,
                name: 'Order Processing & Specification Confirmation',
                description: 'Order details processed and specs confirmed',
                nextActions: ['production_scheduled'],
                requiredFields: ['final_specifications', 'build_requirements'],
                estimatedDuration: '1-3 days',
                assignedRole: 'production_coordinator'
            },
            'production_scheduled': {
                stage: 4,
                name: 'Production Scheduled',
                description: 'Device production scheduled in manufacturing queue',
                nextActions: ['device_configuration'],
                requiredFields: ['production_slot', 'estimated_completion'],
                estimatedDuration: '2-5 days',
                assignedRole: 'production_manager'
            },
            'device_configuration': {
                stage: 4,
                name: 'Device Configuration & Testing',
                description: 'Device being built with specified options',
                nextActions: ['quality_assurance'],
                requiredFields: ['build_progress', 'configuration_details'],
                estimatedDuration: '3-10 days',
                assignedRole: 'technician'
            },
            'quality_assurance': {
                stage: 4,
                name: 'Quality Assurance Complete',
                description: 'Device testing and QA completed',
                nextActions: ['warehouse_receipt'],
                requiredFields: ['qa_checklist', 'test_results'],
                estimatedDuration: '1-2 days',
                assignedRole: 'qa_technician'
            },
            'warehouse_receipt': {
                stage: 4,
                name: 'Warehouse Receipt & Inventory',
                description: 'Completed device received in warehouse',
                nextActions: ['delivery_planning'],
                requiredFields: ['inventory_location', 'serial_numbers'],
                estimatedDuration: '1 day',
                assignedRole: 'warehouse_manager'
            },

            // Stage 5: Logistics & Delivery
            'delivery_planning': {
                stage: 5,
                name: 'Delivery Route Planning',
                description: 'Delivery logistics being planned',
                nextActions: ['delivery_scheduled'],
                requiredFields: ['delivery_route', 'logistics_requirements'],
                estimatedDuration: '1-3 days',
                assignedRole: 'logistics_coordinator'
            },
            'delivery_scheduled': {
                stage: 5,
                name: 'Delivery Scheduled',
                description: 'Delivery date and time confirmed with customer',
                nextActions: ['in_transit'],
                requiredFields: ['delivery_datetime', 'customer_confirmation'],
                estimatedDuration: '2-7 days',
                assignedRole: 'logistics_coordinator'
            },
            'in_transit': {
                stage: 5,
                name: 'In Transit',
                description: 'Device en route to customer location',
                nextActions: ['delivered'],
                requiredFields: ['tracking_info', 'estimated_arrival'],
                estimatedDuration: '1-2 days',
                assignedRole: 'delivery_driver'
            },
            'delivered': {
                stage: 5,
                name: 'Delivered to Customer Site',
                description: 'Device delivered to customer location',
                nextActions: ['installation_scheduled'],
                requiredFields: ['delivery_confirmation', 'condition_notes'],
                estimatedDuration: '1 day',
                assignedRole: 'delivery_driver'
            },

            // Stage 6: Installation & Setup
            'installation_scheduled': {
                stage: 6,
                name: 'Installation Scheduled',
                description: 'On-site installation scheduled with customer',
                nextActions: ['installation_in_progress'],
                requiredFields: ['install_datetime', 'technician_assigned'],
                estimatedDuration: '1-5 days',
                assignedRole: 'service_coordinator'
            },
            'installation_in_progress': {
                stage: 6,
                name: 'On-Site Installation',
                description: 'Technician performing on-site installation',
                nextActions: ['network_configuration'],
                requiredFields: ['installation_notes', 'site_conditions'],
                estimatedDuration: '2-6 hours',
                assignedRole: 'field_technician'
            },
            'network_configuration': {
                stage: 6,
                name: 'Network Configuration',
                description: 'Network and connectivity setup in progress',
                nextActions: ['system_testing'],
                requiredFields: ['network_settings', 'connectivity_verified'],
                estimatedDuration: '1-3 hours',
                assignedRole: 'field_technician'
            },
            'system_testing': {
                stage: 6,
                name: 'System Testing & Validation',
                description: 'Full system testing and validation',
                nextActions: ['customer_training'],
                requiredFields: ['test_results', 'system_validation'],
                estimatedDuration: '1-2 hours',
                assignedRole: 'field_technician'
            },
            'customer_training': {
                stage: 6,
                name: 'Customer Training Delivered',
                description: 'Customer training on device operation',
                nextActions: ['acceptance_signed'],
                requiredFields: ['training_completed', 'customer_questions'],
                estimatedDuration: '1-2 hours',
                assignedRole: 'field_technician'
            },
            'acceptance_signed': {
                stage: 6,
                name: 'Signed Acceptance Delivered',
                description: 'Customer acceptance and satisfaction confirmed',
                nextActions: ['maintenance_monitoring'],
                requiredFields: ['acceptance_signature', 'satisfaction_score'],
                estimatedDuration: '30 minutes',
                assignedRole: 'field_technician'
            },

            // Stage 7: Ongoing Customer Management
            'maintenance_monitoring': {
                stage: 7,
                name: 'Regular Meter Reading Schedule',
                description: 'Ongoing monitoring and meter reading schedule',
                nextActions: ['preventive_maintenance', 'service_call_management'],
                requiredFields: ['reading_schedule', 'monitoring_setup'],
                estimatedDuration: 'Ongoing',
                assignedRole: 'customer_success'
            },
            'preventive_maintenance': {
                stage: 7,
                name: 'Preventive Maintenance Planning',
                description: 'Scheduled maintenance planning and execution',
                nextActions: ['maintenance_monitoring'],
                requiredFields: ['maintenance_schedule', 'service_history'],
                estimatedDuration: 'Scheduled',
                assignedRole: 'service_coordinator'
            },
            'service_call_management': {
                stage: 7,
                name: 'Service Call Management',
                description: 'Managing customer service requests and issues',
                nextActions: ['maintenance_monitoring'],
                requiredFields: ['service_request', 'resolution_status'],
                estimatedDuration: 'As needed',
                assignedRole: 'customer_service'
            },
            'supply_ordering': {
                stage: 7,
                name: 'Supply Ordering & Fulfillment',
                description: 'Managing ongoing supply needs',
                nextActions: ['maintenance_monitoring'],
                requiredFields: ['supply_requirements', 'order_status'],
                estimatedDuration: 'As needed',
                assignedRole: 'customer_success'
            },
            'account_review': {
                stage: 7,
                name: 'Account Review & Upselling',
                description: 'Regular account reviews and growth opportunities',
                nextActions: ['maintenance_monitoring'],
                requiredFields: ['review_notes', 'upsell_opportunities'],
                estimatedDuration: 'Quarterly',
                assignedRole: 'account_manager'
            }
        };
    }

    initializeRoleAssignments() {
        return {
            'lead_processor': {
                name: 'Lead Processor',
                department: 'Marketing',
                permissions: ['lead_management', 'data_enrichment']
            },
            'sales_manager': {
                name: 'Sales Manager',
                department: 'Sales',
                permissions: ['lead_assignment', 'team_management', 'pipeline_oversight']
            },
            'sales_rep': {
                name: 'Sales Representative',
                department: 'Sales',
                permissions: ['opportunity_management', 'customer_communication']
            },
            'contracts_admin': {
                name: 'Contracts Administrator',
                department: 'Legal/Contracts',
                permissions: ['contract_management', 'legal_review']
            },
            'accounting': {
                name: 'Accounting',
                department: 'Finance',
                permissions: ['payment_processing', 'billing_management']
            },
            'production_coordinator': {
                name: 'Production Coordinator',
                department: 'Manufacturing',
                permissions: ['order_processing', 'production_planning']
            },
            'production_manager': {
                name: 'Production Manager',
                department: 'Manufacturing',
                permissions: ['production_scheduling', 'resource_allocation']
            },
            'technician': {
                name: 'Manufacturing Technician',
                department: 'Manufacturing',
                permissions: ['device_building', 'configuration']
            },
            'qa_technician': {
                name: 'QA Technician',
                department: 'Quality Assurance',
                permissions: ['quality_testing', 'compliance_verification']
            },
            'warehouse_manager': {
                name: 'Warehouse Manager',
                department: 'Logistics',
                permissions: ['inventory_management', 'shipping_coordination']
            },
            'logistics_coordinator': {
                name: 'Logistics Coordinator',
                department: 'Logistics',
                permissions: ['delivery_planning', 'route_optimization']
            },
            'delivery_driver': {
                name: 'Delivery Driver',
                department: 'Logistics',
                permissions: ['delivery_execution', 'customer_interaction']
            },
            'service_coordinator': {
                name: 'Service Coordinator',
                department: 'Field Service',
                permissions: ['installation_scheduling', 'technician_dispatch']
            },
            'field_technician': {
                name: 'Field Service Technician',
                department: 'Field Service',
                permissions: ['installation', 'technical_support', 'customer_training']
            },
            'customer_success': {
                name: 'Customer Success Manager',
                department: 'Customer Success',
                permissions: ['account_management', 'ongoing_support']
            },
            'customer_service': {
                name: 'Customer Service Representative',
                department: 'Customer Service',
                permissions: ['issue_resolution', 'customer_communication']
            },
            'account_manager': {
                name: 'Account Manager',
                department: 'Sales',
                permissions: ['account_growth', 'relationship_management']
            }
        };
    }

    createWorkflow(customerId, initialData = {}) {
        const workflowId = `workflow_${customerId}_${Date.now()}`;
        const workflow = {
            id: workflowId,
            customerId: customerId,
            currentStage: 'lead_submission',
            createdAt: new Date(),
            updatedAt: new Date(),
            stageHistory: [],
            nextActions: ['lead_validation'],
            assignedTo: 'lead_processor',
            priority: 'normal',
            data: initialData,
            milestones: [],
            blockers: [],
            estimatedCompletion: this.calculateEstimatedCompletion('lead_submission')
        };
        
        this.workflows.set(workflowId, workflow);
        this.logStageTransition(workflowId, null, 'lead_submission', 'Workflow created');
        
        return workflowId;
    }

    advanceWorkflow(workflowId, nextStage, completionData = {}, notes = '') {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }

        const currentStageInfo = this.stageDefinitions[workflow.currentStage];
        const nextStageInfo = this.stageDefinitions[nextStage];

        if (!currentStageInfo.nextActions.includes(nextStage)) {
            throw new Error(`Invalid stage transition from ${workflow.currentStage} to ${nextStage}`);
        }

        // Log the stage transition
        this.logStageTransition(workflowId, workflow.currentStage, nextStage, notes);

        // Update workflow
        workflow.currentStage = nextStage;
        workflow.nextActions = nextStageInfo.nextActions;
        workflow.assignedTo = nextStageInfo.assignedRole;
        workflow.updatedAt = new Date();
        workflow.data = { ...workflow.data, ...completionData };
        workflow.estimatedCompletion = this.calculateEstimatedCompletion(nextStage);

        // Check for milestone completion
        this.checkMilestones(workflowId, nextStage);

        return workflow;
    }

    logStageTransition(workflowId, fromStage, toStage, notes) {
        const workflow = this.workflows.get(workflowId);
        const transition = {
            timestamp: new Date(),
            fromStage: fromStage,
            toStage: toStage,
            notes: notes,
            duration: fromStage ? this.calculateStageDuration(workflow, fromStage) : null
        };
        
        workflow.stageHistory.push(transition);
    }

    calculateStageDuration(workflow, stage) {
        const stageEntry = workflow.stageHistory
            .reverse()
            .find(h => h.toStage === stage);
        
        if (stageEntry) {
            return new Date() - stageEntry.timestamp;
        }
        return null;
    }

    calculateEstimatedCompletion(currentStage) {
        const stageInfo = this.stageDefinitions[currentStage];
        // This would implement more sophisticated calculation based on stage durations
        const estimatedDays = this.getEstimatedDaysFromStage(currentStage);
        const completion = new Date();
        completion.setDate(completion.getDate() + estimatedDays);
        return completion;
    }

    getEstimatedDaysFromStage(stage) {
        // Simplified estimation - would be more sophisticated in real implementation
        const estimations = {
            'lead_submission': 45,
            'discovery_scheduled': 35,
            'contract_signed': 25,
            'production_scheduled': 20,
            'delivery_scheduled': 10,
            'installation_scheduled': 5,
            'maintenance_monitoring': 0
        };
        return estimations[stage] || 30;
    }

    checkMilestones(workflowId, stage) {
        const workflow = this.workflows.get(workflowId);
        const milestones = {
            'sales_assignment': 'Lead Qualified',
            'contract_signed': 'Deal Closed',
            'warehouse_receipt': 'Production Complete',
            'delivered': 'Delivery Complete',
            'acceptance_signed': 'Installation Complete',
            'maintenance_monitoring': 'Customer Onboarded'
        };

        if (milestones[stage]) {
            workflow.milestones.push({
                name: milestones[stage],
                stage: stage,
                completedAt: new Date()
            });
        }
    }

    getNextActions(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) return [];

        const currentStageInfo = this.stageDefinitions[workflow.currentStage];
        return currentStageInfo.nextActions.map(action => ({
            stage: action,
            name: this.stageDefinitions[action].name,
            description: this.stageDefinitions[action].description,
            assignedRole: this.stageDefinitions[action].assignedRole,
            estimatedDuration: this.stageDefinitions[action].estimatedDuration
        }));
    }

    getWorkflowsByRole(role) {
        return Array.from(this.workflows.values())
            .filter(workflow => workflow.assignedTo === role);
    }

    getWorkflowsByStage(stage) {
        return Array.from(this.workflows.values())
            .filter(workflow => workflow.currentStage === stage);
    }

    addBlocker(workflowId, description, severity = 'medium') {
        const workflow = this.workflows.get(workflowId);
        if (workflow) {
            workflow.blockers.push({
                id: `blocker_${Date.now()}`,
                description: description,
                severity: severity,
                createdAt: new Date(),
                resolved: false
            });
        }
    }

    resolveBlocker(workflowId, blockerId, resolution) {
        const workflow = this.workflows.get(workflowId);
        if (workflow) {
            const blocker = workflow.blockers.find(b => b.id === blockerId);
            if (blocker) {
                blocker.resolved = true;
                blocker.resolution = resolution;
                blocker.resolvedAt = new Date();
            }
        }
    }

    getWorkflowProgress(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) return null;

        const currentStageInfo = this.stageDefinitions[workflow.currentStage];
        const totalStages = 7;
        const completedStages = currentStageInfo.stage - 1;
        const progressPercentage = (completedStages / totalStages) * 100;

        return {
            workflowId: workflowId,
            customerId: workflow.customerId,
            currentStage: workflow.currentStage,
            currentStageName: currentStageInfo.name,
            completedStages: completedStages,
            totalStages: totalStages,
            progressPercentage: progressPercentage,
            estimatedCompletion: workflow.estimatedCompletion,
            nextActions: this.getNextActions(workflowId),
            milestones: workflow.milestones,
            blockers: workflow.blockers.filter(b => !b.resolved),
            assignedTo: workflow.assignedTo,
            assignedRole: this.roleAssignments[workflow.assignedTo]
        };
    }

    generateDashboard() {
        const allWorkflows = Array.from(this.workflows.values());
        
        const stageDistribution = {};
        const roleWorkload = {};
        const blockedWorkflows = [];
        const upcomingDeadlines = [];

        allWorkflows.forEach(workflow => {
            // Stage distribution
            stageDistribution[workflow.currentStage] = 
                (stageDistribution[workflow.currentStage] || 0) + 1;

            // Role workload
            roleWorkload[workflow.assignedTo] = 
                (roleWorkload[workflow.assignedTo] || 0) + 1;

            // Blocked workflows
            if (workflow.blockers.some(b => !b.resolved)) {
                blockedWorkflows.push(workflow.id);
            }

            // Upcoming deadlines (within 7 days)
            const daysUntilDeadline = (workflow.estimatedCompletion - new Date()) / (1000 * 60 * 60 * 24);
            if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
                upcomingDeadlines.push({
                    workflowId: workflow.id,
                    customerId: workflow.customerId,
                    daysRemaining: Math.ceil(daysUntilDeadline),
                    currentStage: workflow.currentStage
                });
            }
        });

        return {
            totalWorkflows: allWorkflows.length,
            stageDistribution: stageDistribution,
            roleWorkload: roleWorkload,
            blockedWorkflows: blockedWorkflows,
            upcomingDeadlines: upcomingDeadlines,
            averageCompletionTime: this.calculateAverageCompletionTime(),
            bottlenecks: this.identifyBottlenecks(stageDistribution)
        };
    }

    calculateAverageCompletionTime() {
        const completedWorkflows = Array.from(this.workflows.values())
            .filter(w => w.currentStage === 'maintenance_monitoring');
        
        if (completedWorkflows.length === 0) return null;

        const totalDuration = completedWorkflows.reduce((sum, workflow) => {
            const duration = workflow.updatedAt - workflow.createdAt;
            return sum + duration;
        }, 0);

        return totalDuration / completedWorkflows.length;
    }

    identifyBottlenecks(stageDistribution) {
        const bottlenecks = [];
        const avgWorkflowsPerStage = Object.values(stageDistribution).reduce((a, b) => a + b, 0) / Object.keys(stageDistribution).length;

        Object.entries(stageDistribution).forEach(([stage, count]) => {
            if (count > avgWorkflowsPerStage * 1.5) {
                bottlenecks.push({
                    stage: stage,
                    stageName: this.stageDefinitions[stage].name,
                    workflowCount: count,
                    assignedRole: this.stageDefinitions[stage].assignedRole
                });
            }
        });

        return bottlenecks;
    }
}

module.exports = CRMWorkflowManager;