import { db } from '../../db';
import { serviceContracts, tasks, businessRecords } from '../../shared/schema';
import { eq, and, sql, lte, gte } from 'drizzle-orm';
import { emailService } from './email-service';

/**
 * Contract Renewal Workflow Automation
 *
 * Automatically triggers renewal workflows at key contract milestones:
 * - 180 days: Initial renewal planning
 * - 90 days: Sales outreach initiation
 * - 60 days: Follow-up and proposal preparation
 * - 30 days: Final outreach and urgency escalation
 */

interface RenewalMilestone {
  daysBeforeExpiration: number;
  taskTitle: string;
  taskDescription: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notificationSubject: string;
  notificationMessage: string;
}

const RENEWAL_MILESTONES: RenewalMilestone[] = [
  {
    daysBeforeExpiration: 180,
    taskTitle: 'Contract Renewal Planning',
    taskDescription: 'Review contract terms and customer relationship. Plan renewal strategy and pricing.',
    priority: 'low',
    notificationSubject: 'Contract Renewal Planning - 6 Months Out',
    notificationMessage: 'Contract expiring in 6 months. Time to review relationship and plan renewal approach.',
  },
  {
    daysBeforeExpiration: 90,
    taskTitle: 'Initiate Renewal Outreach',
    taskDescription: 'Contact customer to discuss renewal. Schedule meeting to review service and terms.',
    priority: 'medium',
    notificationSubject: 'Action Required: Contract Renewal Outreach - 90 Days',
    notificationMessage: 'Contract expiring in 90 days. Begin renewal conversations now to ensure retention.',
  },
  {
    daysBeforeExpiration: 60,
    taskTitle: 'Renewal Proposal Follow-up',
    taskDescription: 'Follow up on renewal discussions. Prepare and send renewal proposal with updated terms.',
    priority: 'high',
    notificationSubject: 'Urgent: Renewal Proposal Required - 60 Days',
    notificationMessage: 'Contract expiring in 60 days. Customer proposal must be prepared and sent.',
  },
  {
    daysBeforeExpiration: 30,
    taskTitle: 'Final Renewal Escalation',
    taskDescription: 'URGENT: Final attempt to secure renewal. Escalate to management if necessary.',
    priority: 'urgent',
    notificationSubject: 'CRITICAL: Contract Expiring in 30 Days',
    notificationMessage: 'Contract expiring in 30 days. Immediate action required to prevent customer loss.',
  },
];

interface ProcessedContract {
  contractId: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  daysUntilExpiration: number;
  annualValue: number;
  tasksCreated: number;
  notificationsSent: boolean;
}

export class ContractRenewalWorkflow {
  /**
   * Process contracts and trigger renewal workflows at appropriate milestones
   */
  async processRenewalMilestones(tenantId: string): Promise<ProcessedContract[]> {
    const processedContracts: ProcessedContract[] = [];

    try {
      // Process each milestone
      for (const milestone of RENEWAL_MILESTONES) {
        const contracts = await this.getContractsAtMilestone(
          tenantId,
          milestone.daysBeforeExpiration
        );

        for (const contract of contracts) {
          const result = await this.triggerRenewalWorkflow(
            tenantId,
            contract,
            milestone
          );
          processedContracts.push(result);
        }
      }

      console.log(
        `[RENEWAL WORKFLOW] Processed ${processedContracts.length} contracts for tenant ${tenantId}`
      );

      return processedContracts;
    } catch (error) {
      console.error('[RENEWAL WORKFLOW] Error processing milestones:', error);
      throw error;
    }
  }

  /**
   * Get contracts at a specific milestone (within 1 day window)
   */
  private async getContractsAtMilestone(
    tenantId: string,
    daysBeforeExpiration: number
  ) {
    const contracts = await db
      .select({
        id: serviceContracts.id,
        contractNumber: serviceContracts.contractNumber,
        customerId: serviceContracts.customerId,
        customerName: businessRecords.companyName,
        endDate: serviceContracts.endDate,
        monthlyBaseRate: serviceContracts.monthlyBaseRate,
        assignedSalesRepId: serviceContracts.assignedSalesRepId,
        daysUntilExpiration: sql<number>`DATE_PART('day', ${serviceContracts.endDate}::timestamp - NOW())`.as('days'),
      })
      .from(serviceContracts)
      .leftJoin(businessRecords, eq(serviceContracts.customerId, businessRecords.id))
      .where(
        and(
          eq(serviceContracts.tenantId, tenantId),
          eq(serviceContracts.contractStatus, 'active'),
          // Contract expires in (days ± 1 day) - catches today's milestone
          lte(
            sql`DATE_PART('day', ${serviceContracts.endDate}::timestamp - NOW())`,
            daysBeforeExpiration + 1
          ),
          gte(
            sql`DATE_PART('day', ${serviceContracts.endDate}::timestamp - NOW())`,
            daysBeforeExpiration - 1
          )
        )
      );

    return contracts;
  }

  /**
   * Trigger renewal workflow for a specific contract
   */
  private async triggerRenewalWorkflow(
    tenantId: string,
    contract: any,
    milestone: RenewalMilestone
  ): Promise<ProcessedContract> {
    let tasksCreated = 0;
    let notificationsSent = false;

    try {
      // Check if task already exists for this milestone
      const existingTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.tenantId, tenantId),
            eq(tasks.relatedRecordId, contract.id),
            sql`${tasks.title} LIKE ${milestone.taskTitle}%`
          )
        )
        .limit(1);

      // Create task if it doesn't exist
      if (existingTasks.length === 0) {
        const annualValue = (contract.monthlyBaseRate || 0) * 12;

        await db.insert(tasks).values({
          id: sql`gen_random_uuid()`,
          tenantId,
          title: `${milestone.taskTitle} - ${contract.customerName}`,
          description: `${milestone.taskDescription}\n\nContract: ${contract.contractNumber}\nAnnual Value: $${annualValue.toFixed(0)}\nExpires: ${contract.endDate}`,
          taskType: 'renewal',
          priority: milestone.priority,
          status: 'pending',
          relatedRecordType: 'contract',
          relatedRecordId: contract.id,
          assignedUserId: contract.assignedSalesRepId || null,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
          createdBy: 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        tasksCreated++;
        console.log(
          `[RENEWAL WORKFLOW] Created task for contract ${contract.contractNumber} at ${milestone.daysBeforeExpiration}-day milestone`
        );
      }

      // Send notification to assigned sales rep if available
      if (contract.assignedSalesRepId) {
        // In production, fetch user email and send notification
        // For now, just log the intent
        notificationsSent = true;
        console.log(
          `[RENEWAL WORKFLOW] Notification triggered for sales rep ${contract.assignedSalesRepId}`
        );

        // Optional: Send email notification (if email service is configured)
        // const salesRepEmail = await getUserEmail(contract.assignedSalesRepId);
        // if (salesRepEmail) {
        //   await emailService.send({
        //     to: salesRepEmail,
        //     subject: milestone.notificationSubject,
        //     html: this.generateRenewalNotificationEmail(contract, milestone),
        //   });
        // }
      }

      return {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        customerId: contract.customerId,
        customerName: contract.customerName || 'Unknown',
        daysUntilExpiration: Math.round(contract.daysUntilExpiration),
        annualValue: (contract.monthlyBaseRate || 0) * 12,
        tasksCreated,
        notificationsSent,
      };
    } catch (error) {
      console.error(
        `[RENEWAL WORKFLOW] Error processing contract ${contract.contractNumber}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Generate email notification HTML
   */
  private generateRenewalNotificationEmail(
    contract: any,
    milestone: RenewalMilestone
  ): string {
    const annualValue = (contract.monthlyBaseRate || 0) * 12;

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${milestone.notificationSubject}</h2>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">Contract Details</h3>
          <p style="margin: 10px 0;"><strong>Customer:</strong> ${contract.customerName}</p>
          <p style="margin: 10px 0;"><strong>Contract Number:</strong> ${contract.contractNumber}</p>
          <p style="margin: 10px 0;"><strong>Annual Value:</strong> $${annualValue.toFixed(0)}</p>
          <p style="margin: 10px 0;"><strong>Expiration Date:</strong> ${new Date(contract.endDate).toLocaleDateString()}</p>
          <p style="margin: 10px 0;"><strong>Days Until Expiration:</strong> ${Math.round(contract.daysUntilExpiration)}</p>
        </div>

        <div style="background-color: ${milestone.priority === 'urgent' ? '#fee2e2' : milestone.priority === 'high' ? '#fef3c7' : '#f3f4f6'}; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">Action Required</h3>
          <p><strong>${milestone.taskTitle}</strong></p>
          <p>${milestone.taskDescription}</p>
        </div>

        <p style="margin: 20px 0;">
          A task has been created in your task list. Please log in to Printyx to view details and take action.
        </p>

        <p style="text-align: center; margin: 30px 0;">
          <a href="https://printyx.net/contracts" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Contract Details
          </a>
        </p>

        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This is an automated notification from Printyx Contract Renewal Management.
        </p>
      </div>
    `;
  }

  /**
   * Get renewal workflow status summary for a tenant
   */
  async getRenewalWorkflowSummary(tenantId: string) {
    const summary = await Promise.all(
      RENEWAL_MILESTONES.map(async (milestone) => {
        const contracts = await this.getContractsAtMilestone(
          tenantId,
          milestone.daysBeforeExpiration
        );

        return {
          milestone: `${milestone.daysBeforeExpiration} days`,
          contractCount: contracts.length,
          totalValue: contracts.reduce(
            (sum, c) => sum + (c.monthlyBaseRate || 0) * 12,
            0
          ),
          priority: milestone.priority,
        };
      })
    );

    return {
      milestones: summary,
      totalContracts: summary.reduce((sum, m) => sum + m.contractCount, 0),
      totalAtRiskValue: summary.reduce((sum, m) => sum + m.totalValue, 0),
    };
  }
}

// Singleton instance
export const contractRenewalWorkflow = new ContractRenewalWorkflow();
