const CRMWorkflowManager = require('./crm-workflow-system');
const CRMRoleManager = require('./crm-role-management');

// Example usage demonstrating the complete CRM workflow system

console.log('🚀 Initializing CRM Workflow Management System\n');

// Initialize the system
const workflowManager = new CRMWorkflowManager();
const roleManager = new CRMRoleManager(workflowManager);

// Create sample users for different roles
console.log('👥 Creating sample users...');
const users = [
    { id: 'user_001', name: 'Sarah Johnson', role: 'lead_processor', email: 'sarah@company.com', department: 'Marketing' },
    { id: 'user_002', name: 'Mike Chen', role: 'sales_manager', email: 'mike@company.com', department: 'Sales' },
    { id: 'user_003', name: 'Jessica Brown', role: 'sales_rep', email: 'jessica@company.com', department: 'Sales' },
    { id: 'user_004', name: 'David Wilson', role: 'contracts_admin', email: 'david@company.com', department: 'Legal' },
    { id: 'user_005', name: 'Lisa Garcia', role: 'production_manager', email: 'lisa@company.com', department: 'Manufacturing' },
    { id: 'user_006', name: 'Tom Anderson', role: 'field_technician', email: 'tom@company.com', department: 'Field Service' },
    { id: 'user_007', name: 'Amy Davis', role: 'customer_success', email: 'amy@company.com', department: 'Customer Success' }
];

users.forEach(user => {
    roleManager.createUser(user.id, user.name, user.role, user.email, user.department);
    console.log(`  ✅ Created user: ${user.name} (${user.role})`);
});

// Create sample workflows for different customers
console.log('\n📝 Creating sample customer workflows...');
const customers = [
    { id: 'cust_001', name: 'ABC Manufacturing', type: 'lead_submission', priority: 'high' },
    { id: 'cust_002', name: 'XYZ Corp', type: 'demo_scheduled', priority: 'medium' },
    { id: 'cust_003', name: 'TechStart Inc', type: 'contract_signed', priority: 'high' },
    { id: 'cust_004', name: 'Global Industries', type: 'delivered', priority: 'normal' }
];

const workflows = customers.map(customer => {
    const workflowId = workflowManager.createWorkflow(customer.id, {
        customerName: customer.name,
        priority: customer.priority,
        initialInquiry: `Initial inquiry from ${customer.name}`
    });
    
    console.log(`  ✅ Created workflow: ${workflowId} for ${customer.name}`);
    
    // Advance some workflows to different stages for demonstration
    if (customer.type !== 'lead_submission') {
        simulateWorkflowProgress(workflowManager, roleManager, workflowId, customer.type);
    }
    
    return workflowId;
});

function simulateWorkflowProgress(workflowManager, roleManager, workflowId, targetStage) {
    const stageProgression = {
        'demo_scheduled': ['lead_validation', 'lead_scoring', 'sales_assignment', 'discovery_scheduled', 'discovery_completed', 'demo_scheduled'],
        'contract_signed': ['lead_validation', 'lead_scoring', 'sales_assignment', 'discovery_scheduled', 'discovery_completed', 'demo_scheduled', 'demo_delivered', 'proposal_development', 'proposal_sent', 'contract_negotiation', 'contract_sent', 'contract_signed'],
        'delivered': ['lead_validation', 'lead_scoring', 'sales_assignment', 'discovery_scheduled', 'discovery_completed', 'demo_scheduled', 'demo_delivered', 'proposal_development', 'proposal_sent', 'contract_negotiation', 'contract_sent', 'contract_signed', 'payment_confirmed', 'order_processing', 'production_scheduled', 'device_configuration', 'quality_assurance', 'warehouse_receipt', 'delivery_planning', 'delivery_scheduled', 'in_transit', 'delivered']
    };

    const stages = stageProgression[targetStage] || [];
    stages.forEach((stage, index) => {
        try {
            workflowManager.advanceWorkflow(workflowId, stage, {
                [`${stage}_completed`]: true,
                notes: `Stage ${stage} completed successfully`
            }, `Progressed to ${stage}`);
            
            // Execute handoff for automatic transitions
            if (index < stages.length - 1) {
                const nextStage = stages[index + 1];
                roleManager.executeHandoff(workflowId, stage, nextStage);
            }
        } catch (error) {
            console.log(`    ⚠️  Handoff from ${stage} requires manual approval`);
        }
    });
}

// Demonstrate system functionality
console.log('\n📊 System Status Dashboard:');
console.log('=' .repeat(50));

// Generate overall dashboard
const dashboard = workflowManager.generateDashboard();
console.log(`Total Workflows: ${dashboard.totalWorkflows}`);
console.log(`Blocked Workflows: ${dashboard.blockedWorkflows.length}`);
console.log(`Upcoming Deadlines: ${dashboard.upcomingDeadlines.length}`);

// Show stage distribution
console.log('\n📈 Workflows by Stage:');
Object.entries(dashboard.stageDistribution).forEach(([stage, count]) => {
    console.log(`  ${stage.replace(/_/g, ' ').toUpperCase()}: ${count}`);
});

// Show role workload
console.log('\n👥 Role Workload:');
Object.entries(dashboard.roleWorkload).forEach(([role, count]) => {
    console.log(`  ${role.replace(/_/g, ' ').toUpperCase()}: ${count} workflows`);
});

// Show bottlenecks if any
if (dashboard.bottlenecks.length > 0) {
    console.log('\n⚠️  Bottlenecks Detected:');
    dashboard.bottlenecks.forEach(bottleneck => {
        console.log(`  ${bottleneck.stageName}: ${bottleneck.workflowCount} workflows (${bottleneck.assignedRole})`);
    });
}

// Show upcoming deadlines
if (dashboard.upcomingDeadlines.length > 0) {
    console.log('\n📅 Upcoming Deadlines:');
    dashboard.upcomingDeadlines.forEach(deadline => {
        console.log(`  Customer ${deadline.customerId}: ${deadline.daysRemaining} days remaining (${deadline.currentStage})`);
    });
}

// Demonstrate user-specific dashboard
console.log('\n👤 Individual User Dashboard - Jessica Brown (Sales Rep):');
console.log('=' .repeat(50));
const userDashboard = roleManager.getUserDashboard('user_003');
if (userDashboard) {
    console.log(`Name: ${userDashboard.user.name}`);
    console.log(`Role: ${userDashboard.user.role} - ${userDashboard.user.department}`);
    console.log(`Total Assigned: ${userDashboard.workload.total}`);
    console.log(`Overdue: ${userDashboard.workload.overdue}`);
    console.log(`Urgent: ${userDashboard.workload.urgent}`);
    console.log(`Blocked: ${userDashboard.workload.blocked}`);
    console.log(`Completed Workflows: ${userDashboard.performance.completedWorkflows}`);
    console.log(`Unread Notifications: ${userDashboard.notifications.length}`);
    
    if (userDashboard.workflows.length > 0) {
        console.log('\nAssigned Workflows:');
        userDashboard.workflows.forEach(workflow => {
            console.log(`  • Customer: ${workflow.customerId} - Stage: ${workflow.currentStageName} (${Math.round(workflow.progressPercentage)}%)`);
            if (workflow.nextActions.length > 0) {
                console.log(`    Next Actions: ${workflow.nextActions.map(a => a.name).join(', ')}`);
            }
        });
    }
}

// Demonstrate workflow advancement
console.log('\n🔄 Demonstrating Workflow Advancement:');
console.log('=' .repeat(50));
const sampleWorkflow = workflows[0];
const workflowProgress = workflowManager.getWorkflowProgress(sampleWorkflow);

if (workflowProgress) {
    console.log(`Workflow: ${workflowProgress.workflowId}`);
    console.log(`Customer: ${workflowProgress.customerId}`);
    console.log(`Current Stage: ${workflowProgress.currentStageName}`);
    console.log(`Progress: ${Math.round(workflowProgress.progressPercentage)}% complete`);
    console.log(`Assigned To: ${workflowProgress.assignedRole.name} (${workflowProgress.assignedRole.department})`);
    console.log(`Estimated Completion: ${workflowProgress.estimatedCompletion.toLocaleDateString()}`);
    
    if (workflowProgress.nextActions.length > 0) {
        console.log('\nAvailable Next Actions:');
        workflowProgress.nextActions.forEach(action => {
            console.log(`  • ${action.name} (${action.estimatedDuration})`);
            console.log(`    ${action.description}`);
            console.log(`    Assigned to: ${action.assignedRole}`);
        });
    }
    
    if (workflowProgress.milestones.length > 0) {
        console.log('\nCompleted Milestones:');
        workflowProgress.milestones.forEach(milestone => {
            console.log(`  ✅ ${milestone.name} - ${milestone.completedAt.toLocaleDateString()}`);
        });
    }
}

// Add a blocker to demonstrate issue tracking
console.log('\n🚫 Demonstrating Blocker Management:');
workflowManager.addBlocker(sampleWorkflow, 'Customer requested changes to specifications', 'high');
console.log('Added blocker: Customer requested changes to specifications');

const updatedProgress = workflowManager.getWorkflowProgress(sampleWorkflow);
if (updatedProgress && updatedProgress.blockers.length > 0) {
    console.log('Active Blockers:');
    updatedProgress.blockers.forEach(blocker => {
        console.log(`  🚫 ${blocker.description} (Severity: ${blocker.severity})`);
    });
}

// Demonstrate handoff queue
console.log('\n📤 Manual Handoff Queue:');
console.log('=' .repeat(50));
const handoffQueue = roleManager.getHandoffQueue();
if (handoffQueue.length > 0) {
    handoffQueue.forEach(handoff => {
        console.log(`  Workflow: ${handoff.workflowId} (Customer: ${handoff.customerId})`);
        console.log(`  From: ${handoff.fromStage} (${handoff.fromRole}) → To: ${handoff.toStage} (${handoff.toRole})`);
        console.log(`  Waiting: ${Math.round(handoff.waitingTime / (1000 * 60 * 60))} hours`);
        console.log('');
    });
} else {
    console.log('No manual handoffs pending');
}

console.log('\n✅ CRM Workflow System Demonstration Complete!');
console.log('\nKey Features Demonstrated:');
console.log('• Complete workflow from lead submission to ongoing maintenance');
console.log('• Role-based access control and task assignment');
console.log('• Automatic and manual handoff management');
console.log('• Progress tracking and milestone completion');
console.log('• Bottleneck identification and performance metrics');
console.log('• User-specific dashboards and notifications');
console.log('• Issue tracking with blockers');
console.log('• Comprehensive reporting and analytics');

// Export the initialized system for use in other modules
module.exports = {
    workflowManager,
    roleManager,
    sampleWorkflows: workflows
};