class CRMRoleManager {
    constructor(workflowManager) {
        this.workflowManager = workflowManager;
        this.users = new Map();
        this.rolePermissions = this.initializeRolePermissions();
        this.handoffRules = this.initializeHandoffRules();
        this.notifications = new Map();
    }

    initializeRolePermissions() {
        return {
            'lead_processor': {
                canView: ['lead_submission', 'lead_validation', 'lead_scoring'],
                canEdit: ['lead_submission', 'lead_validation'],
                canAdvance: ['lead_submission', 'lead_validation'],
                canAssign: false,
                dashboard: 'lead_management'
            },
            'sales_manager': {
                canView: ['lead_scoring', 'sales_assignment', 'discovery_scheduled', 'discovery_completed', 'demo_scheduled', 'demo_delivered', 'proposal_development', 'proposal_sent'],
                canEdit: ['lead_scoring', 'sales_assignment'],
                canAdvance: ['lead_scoring', 'sales_assignment'],
                canAssign: true,
                dashboard: 'sales_pipeline'
            },
            'sales_rep': {
                canView: ['discovery_scheduled', 'discovery_completed', 'demo_scheduled', 'demo_delivered', 'proposal_development', 'proposal_sent', 'contract_negotiation'],
                canEdit: ['discovery_scheduled', 'discovery_completed', 'demo_scheduled', 'demo_delivered', 'proposal_development', 'proposal_sent', 'contract_negotiation'],
                canAdvance: ['discovery_scheduled', 'discovery_completed', 'demo_scheduled', 'demo_delivered', 'proposal_development', 'proposal_sent', 'contract_negotiation'],
                canAssign: false,
                dashboard: 'sales_activities'
            },
            'contracts_admin': {
                canView: ['contract_negotiation', 'contract_sent', 'contract_signed'],
                canEdit: ['contract_sent', 'contract_signed'],
                canAdvance: ['contract_sent', 'contract_signed'],
                canAssign: false,
                dashboard: 'contract_management'
            },
            'accounting': {
                canView: ['contract_signed', 'payment_confirmed'],
                canEdit: ['payment_confirmed'],
                canAdvance: ['payment_confirmed'],
                canAssign: false,
                dashboard: 'financial_tracking'
            },
            'production_coordinator': {
                canView: ['payment_confirmed', 'order_processing', 'production_scheduled'],
                canEdit: ['order_processing'],
                canAdvance: ['order_processing'],
                canAssign: true,
                dashboard: 'production_queue'
            },
            'production_manager': {
                canView: ['order_processing', 'production_scheduled', 'device_configuration', 'quality_assurance', 'warehouse_receipt'],
                canEdit: ['production_scheduled'],
                canAdvance: ['production_scheduled'],
                canAssign: true,
                dashboard: 'production_oversight'
            },
            'technician': {
                canView: ['production_scheduled', 'device_configuration', 'quality_assurance'],
                canEdit: ['device_configuration'],
                canAdvance: ['device_configuration'],
                canAssign: false,
                dashboard: 'build_queue'
            },
            'qa_technician': {
                canView: ['device_configuration', 'quality_assurance'],
                canEdit: ['quality_assurance'],
                canAdvance: ['quality_assurance'],
                canAssign: false,
                dashboard: 'quality_control'
            },
            'warehouse_manager': {
                canView: ['quality_assurance', 'warehouse_receipt', 'delivery_planning'],
                canEdit: ['warehouse_receipt'],
                canAdvance: ['warehouse_receipt'],
                canAssign: true,
                dashboard: 'inventory_management'
            },
            'logistics_coordinator': {
                canView: ['warehouse_receipt', 'delivery_planning', 'delivery_scheduled', 'in_transit', 'delivered'],
                canEdit: ['delivery_planning', 'delivery_scheduled'],
                canAdvance: ['delivery_planning', 'delivery_scheduled'],
                canAssign: true,
                dashboard: 'logistics_tracking'
            },
            'delivery_driver': {
                canView: ['delivery_scheduled', 'in_transit', 'delivered'],
                canEdit: ['in_transit', 'delivered'],
                canAdvance: ['in_transit', 'delivered'],
                canAssign: false,
                dashboard: 'delivery_routes'
            },
            'service_coordinator': {
                canView: ['delivered', 'installation_scheduled', 'installation_in_progress', 'network_configuration', 'system_testing', 'customer_training', 'acceptance_signed'],
                canEdit: ['installation_scheduled'],
                canAdvance: ['installation_scheduled'],
                canAssign: true,
                dashboard: 'service_scheduling'
            },
            'field_technician': {
                canView: ['installation_scheduled', 'installation_in_progress', 'network_configuration', 'system_testing', 'customer_training', 'acceptance_signed'],
                canEdit: ['installation_in_progress', 'network_configuration', 'system_testing', 'customer_training', 'acceptance_signed'],
                canAdvance: ['installation_in_progress', 'network_configuration', 'system_testing', 'customer_training', 'acceptance_signed'],
                canAssign: false,
                dashboard: 'field_assignments'
            },
            'customer_success': {
                canView: ['acceptance_signed', 'maintenance_monitoring', 'supply_ordering'],
                canEdit: ['maintenance_monitoring', 'supply_ordering'],
                canAdvance: ['maintenance_monitoring', 'supply_ordering'],
                canAssign: false,
                dashboard: 'customer_health'
            },
            'customer_service': {
                canView: ['maintenance_monitoring', 'service_call_management'],
                canEdit: ['service_call_management'],
                canAdvance: ['service_call_management'],
                canAssign: false,
                dashboard: 'service_requests'
            },
            'account_manager': {
                canView: ['maintenance_monitoring', 'account_review'],
                canEdit: ['account_review'],
                canAdvance: ['account_review'],
                canAssign: false,
                dashboard: 'account_growth'
            }
        };
    }

    initializeHandoffRules() {
        return {
            'lead_validation_to_lead_scoring': {
                fromRole: 'lead_processor',
                toRole: 'sales_manager',
                requiredFields: ['validated_contact', 'company_details'],
                autoHandoff: true,
                notificationTemplate: 'lead_qualified_handoff'
            },
            'sales_assignment_to_discovery': {
                fromRole: 'sales_manager',
                toRole: 'sales_rep',
                requiredFields: ['assigned_sales_rep', 'territory_match'],
                autoHandoff: true,
                notificationTemplate: 'lead_assigned_handoff'
            },
            'contract_negotiation_to_contract_sent': {
                fromRole: 'sales_rep',
                toRole: 'contracts_admin',
                requiredFields: ['negotiation_notes', 'final_terms'],
                autoHandoff: false,
                notificationTemplate: 'contract_ready_handoff'
            },
            'payment_confirmed_to_order_processing': {
                fromRole: 'accounting',
                toRole: 'production_coordinator',
                requiredFields: ['payment_method', 'billing_schedule'],
                autoHandoff: true,
                notificationTemplate: 'production_ready_handoff'
            },
            'production_scheduled_to_device_configuration': {
                fromRole: 'production_manager',
                toRole: 'technician',
                requiredFields: ['production_slot', 'estimated_completion'],
                autoHandoff: true,
                notificationTemplate: 'build_assignment_handoff'
            },
            'warehouse_receipt_to_delivery_planning': {
                fromRole: 'warehouse_manager',
                toRole: 'logistics_coordinator',
                requiredFields: ['inventory_location', 'serial_numbers'],
                autoHandoff: true,
                notificationTemplate: 'ready_for_delivery_handoff'
            },
            'delivered_to_installation_scheduled': {
                fromRole: 'delivery_driver',
                toRole: 'service_coordinator',
                requiredFields: ['delivery_confirmation', 'condition_notes'],
                autoHandoff: true,
                notificationTemplate: 'installation_needed_handoff'
            },
            'acceptance_signed_to_maintenance_monitoring': {
                fromRole: 'field_technician',
                toRole: 'customer_success',
                requiredFields: ['acceptance_signature', 'satisfaction_score'],
                autoHandoff: true,
                notificationTemplate: 'customer_onboarded_handoff'
            }
        };
    }

    createUser(userId, name, role, email, department) {
        const user = {
            id: userId,
            name: name,
            role: role,
            email: email,
            department: department,
            permissions: this.rolePermissions[role],
            active: true,
            createdAt: new Date(),
            lastActive: new Date(),
            assignedWorkflows: new Set(),
            completedWorkflows: 0,
            averageCompletionTime: 0
        };

        this.users.set(userId, user);
        return user;
    }

    assignWorkflow(workflowId, userId) {
        const user = this.users.get(userId);
        const workflow = this.workflowManager.workflows.get(workflowId);
        
        if (!user || !workflow) {
            throw new Error('User or workflow not found');
        }

        if (!user.permissions.canView.includes(workflow.currentStage)) {
            throw new Error(`User ${userId} does not have permission to work on stage ${workflow.currentStage}`);
        }

        user.assignedWorkflows.add(workflowId);
        workflow.assignedTo = userId;
        workflow.assignedRole = user.role;
        
        this.sendNotification(userId, 'workflow_assigned', {
            workflowId: workflowId,
            customerId: workflow.customerId,
            stage: workflow.currentStage
        });

        return true;
    }

    executeHandoff(workflowId, fromStage, toStage, handoffData = {}) {
        const handoffKey = `${fromStage}_to_${toStage}`;
        const handoffRule = this.handoffRules[handoffKey];
        
        if (!handoffRule) {
            return this.manualHandoff(workflowId, fromStage, toStage, handoffData);
        }

        const workflow = this.workflowManager.workflows.get(workflowId);
        
        // Validate required fields
        const missingFields = handoffRule.requiredFields.filter(
            field => !workflow.data[field] && !handoffData[field]
        );

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields for handoff: ${missingFields.join(', ')}`);
        }

        // Find available user in target role
        const targetUser = this.findAvailableUser(handoffRule.toRole);
        if (!targetUser) {
            throw new Error(`No available user found for role: ${handoffRule.toRole}`);
        }

        // Execute handoff
        const currentUser = this.getUserByWorkflow(workflowId);
        if (currentUser) {
            currentUser.assignedWorkflows.delete(workflowId);
            this.updateUserStats(currentUser.id, workflow);
        }

        this.assignWorkflow(workflowId, targetUser.id);

        // Send notifications
        this.sendHandoffNotifications(workflowId, currentUser, targetUser, handoffRule.notificationTemplate);

        return {
            success: true,
            fromUser: currentUser?.id,
            toUser: targetUser.id,
            handoffType: 'automatic'
        };
    }

    manualHandoff(workflowId, fromStage, toStage, handoffData) {
        const workflow = this.workflowManager.workflows.get(workflowId);
        const currentUser = this.getUserByWorkflow(workflowId);
        
        // Create handoff request for manual review
        const handoffRequest = {
            id: `handoff_${Date.now()}`,
            workflowId: workflowId,
            fromStage: fromStage,
            toStage: toStage,
            fromUser: currentUser?.id,
            requestedAt: new Date(),
            data: handoffData,
            status: 'pending',
            reason: 'Manual handoff required - no automatic rule defined'
        };

        // Notify appropriate manager or coordinator
        const targetRole = this.workflowManager.stageDefinitions[toStage].assignedRole;
        const manager = this.findManagerForRole(targetRole);
        
        if (manager) {
            this.sendNotification(manager.id, 'handoff_approval_needed', handoffRequest);
        }

        return {
            success: true,
            handoffType: 'manual',
            requestId: handoffRequest.id,
            awaitingApproval: true
        };
    }

    findAvailableUser(role) {
        const usersInRole = Array.from(this.users.values())
            .filter(user => user.role === role && user.active);

        if (usersInRole.length === 0) return null;

        // Find user with least assigned workflows
        return usersInRole.reduce((prev, current) => 
            prev.assignedWorkflows.size <= current.assignedWorkflows.size ? prev : current
        );
    }

    findManagerForRole(role) {
        const managerRoles = {
            'lead_processor': 'sales_manager',
            'sales_rep': 'sales_manager',
            'technician': 'production_manager',
            'qa_technician': 'production_manager',
            'delivery_driver': 'logistics_coordinator',
            'field_technician': 'service_coordinator'
        };

        const managerRole = managerRoles[role];
        if (managerRole) {
            return Array.from(this.users.values())
                .find(user => user.role === managerRole && user.active);
        }

        return null;
    }

    getUserByWorkflow(workflowId) {
        return Array.from(this.users.values())
            .find(user => user.assignedWorkflows.has(workflowId));
    }

    updateUserStats(userId, workflow) {
        const user = this.users.get(userId);
        if (user) {
            user.completedWorkflows++;
            const completionTime = new Date() - workflow.createdAt;
            user.averageCompletionTime = 
                (user.averageCompletionTime * (user.completedWorkflows - 1) + completionTime) / user.completedWorkflows;
            user.lastActive = new Date();
        }
    }

    sendNotification(userId, type, data) {
        const notification = {
            id: `notif_${Date.now()}`,
            userId: userId,
            type: type,
            data: data,
            createdAt: new Date(),
            read: false
        };

        if (!this.notifications.has(userId)) {
            this.notifications.set(userId, []);
        }

        this.notifications.get(userId).push(notification);
        
        // In real implementation, this would trigger email, SMS, or real-time notifications
        console.log(`Notification sent to ${userId}: ${type}`);
    }

    sendHandoffNotifications(workflowId, fromUser, toUser, template) {
        const workflow = this.workflowManager.workflows.get(workflowId);
        
        if (fromUser) {
            this.sendNotification(fromUser.id, 'workflow_handed_off', {
                workflowId: workflowId,
                toUser: toUser.name,
                stage: workflow.currentStage
            });
        }

        this.sendNotification(toUser.id, 'workflow_received', {
            workflowId: workflowId,
            fromUser: fromUser?.name || 'System',
            stage: workflow.currentStage,
            priority: workflow.priority
        });
    }

    getUserDashboard(userId) {
        const user = this.users.get(userId);
        if (!user) return null;

        const assignedWorkflows = Array.from(user.assignedWorkflows)
            .map(workflowId => this.workflowManager.getWorkflowProgress(workflowId))
            .filter(Boolean);

        const overdue = assignedWorkflows.filter(w => 
            w.estimatedCompletion < new Date()
        );

        const urgent = assignedWorkflows.filter(w => 
            (w.estimatedCompletion - new Date()) / (1000 * 60 * 60 * 24) <= 3
        );

        const blocked = assignedWorkflows.filter(w => 
            w.blockers.length > 0
        );

        return {
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                department: user.department
            },
            workload: {
                total: assignedWorkflows.length,
                overdue: overdue.length,
                urgent: urgent.length,
                blocked: blocked.length
            },
            workflows: assignedWorkflows,
            performance: {
                completedWorkflows: user.completedWorkflows,
                averageCompletionTime: user.averageCompletionTime,
                lastActive: user.lastActive
            },
            notifications: this.getUnreadNotifications(userId)
        };
    }

    getUnreadNotifications(userId) {
        const userNotifications = this.notifications.get(userId) || [];
        return userNotifications.filter(n => !n.read);
    }

    markNotificationRead(userId, notificationId) {
        const userNotifications = this.notifications.get(userId) || [];
        const notification = userNotifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
        }
    }

    getRoleWorkloadReport() {
        const roleStats = {};
        
        Array.from(this.users.values()).forEach(user => {
            if (!roleStats[user.role]) {
                roleStats[user.role] = {
                    roleName: user.role,
                    userCount: 0,
                    totalWorkflows: 0,
                    averageWorkload: 0,
                    overloaded: 0
                };
            }

            roleStats[user.role].userCount++;
            roleStats[user.role].totalWorkflows += user.assignedWorkflows.size;
            
            if (user.assignedWorkflows.size > 5) { // Configurable threshold
                roleStats[user.role].overloaded++;
            }
        });

        Object.values(roleStats).forEach(stats => {
            stats.averageWorkload = stats.totalWorkflows / stats.userCount;
        });

        return roleStats;
    }

    canUserAdvanceWorkflow(userId, workflowId, targetStage) {
        const user = this.users.get(userId);
        const workflow = this.workflowManager.workflows.get(workflowId);
        
        if (!user || !workflow) return false;
        
        return user.permissions.canAdvance.includes(workflow.currentStage) &&
               user.permissions.canView.includes(targetStage);
    }

    getHandoffQueue() {
        const queue = [];
        
        Array.from(this.workflowManager.workflows.values()).forEach(workflow => {
            const currentStageInfo = this.workflowManager.stageDefinitions[workflow.currentStage];
            const nextStages = currentStageInfo.nextActions;
            
            nextStages.forEach(nextStage => {
                const handoffKey = `${workflow.currentStage}_to_${nextStage}`;
                const handoffRule = this.handoffRules[handoffKey];
                
                if (handoffRule && !handoffRule.autoHandoff) {
                    queue.push({
                        workflowId: workflow.id,
                        customerId: workflow.customerId,
                        fromStage: workflow.currentStage,
                        toStage: nextStage,
                        fromRole: handoffRule.fromRole,
                        toRole: handoffRule.toRole,
                        priority: workflow.priority,
                        waitingTime: new Date() - workflow.updatedAt
                    });
                }
            });
        });

        return queue.sort((a, b) => b.waitingTime - a.waitingTime);
    }
}

module.exports = CRMRoleManager;