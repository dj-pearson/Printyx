import { storage } from './storage';

async function seedLeadScoring() {
  console.log('🎯 Seeding lead scoring data...');

  try {
    // Get test tenant and user
    const tenants = await storage.getAllTenants();
    if (tenants.length === 0) {
      console.error('❌ No tenants found. Please create a tenant first.');
      return;
    }

    const tenantId = tenants[0].id;
    const users = await storage.getUsers(tenantId);
    const userId = users.length > 0 ? users[0].id : 'system';

    console.log(`✅ Using tenant: ${tenantId}`);

    // ==================== Seed Lead Scoring Rules ====================
    console.log('📋 Seeding lead scoring rules...');

    const scoringRules = [
      // Demographic Rules
      {
        ruleName: 'Large Enterprise',
        ruleDescription: 'Companies with more than 500 employees',
        category: 'demographic',
        field: 'employeeCount',
        operator: 'greater_than',
        value: 500,
        scorePoints: 15,
        maxScore: 15,
        priority: 10,
      },
      {
        ruleName: 'Mid-Market Company',
        ruleDescription: 'Companies with 100-500 employees',
        category: 'demographic',
        field: 'employeeCount',
        operator: 'greater_than',
        value: 100,
        scorePoints: 10,
        maxScore: 10,
        priority: 9,
      },
      {
        ruleName: 'Target Industry - Legal',
        ruleDescription: 'Legal services industry',
        category: 'demographic',
        field: 'industry',
        operator: 'equals',
        value: 'Legal',
        scorePoints: 10,
        maxScore: 10,
        priority: 8,
      },
      {
        ruleName: 'Target Industry - Healthcare',
        ruleDescription: 'Healthcare industry',
        category: 'demographic',
        field: 'industry',
        operator: 'equals',
        value: 'Healthcare',
        scorePoints: 10,
        maxScore: 10,
        priority: 8,
      },
      {
        ruleName: 'Target Industry - Financial Services',
        ruleDescription: 'Financial services industry',
        category: 'demographic',
        field: 'industry',
        operator: 'equals',
        value: 'Finance',
        scorePoints: 10,
        maxScore: 10,
        priority: 8,
      },
      // Firmographic Rules
      {
        ruleName: 'High Annual Revenue',
        ruleDescription: 'Companies with annual revenue over $10M',
        category: 'firmographic',
        field: 'annualRevenue',
        operator: 'greater_than',
        value: 10000000,
        scorePoints: 15,
        maxScore: 15,
        priority: 10,
      },
      {
        ruleName: 'Medium Annual Revenue',
        ruleDescription: 'Companies with annual revenue $1M-$10M',
        category: 'firmographic',
        field: 'annualRevenue',
        operator: 'greater_than',
        value: 1000000,
        scorePoints: 10,
        maxScore: 10,
        priority: 9,
      },
      {
        ruleName: 'Has Website',
        ruleDescription: 'Company has a website listed',
        category: 'firmographic',
        field: 'website',
        operator: 'is_not_null',
        value: null,
        scorePoints: 5,
        maxScore: 5,
        priority: 5,
      },
      // Behavioral Rules
      {
        ruleName: 'Assigned to Sales Rep',
        ruleDescription: 'Lead has been assigned to a sales representative',
        category: 'behavioral',
        field: 'assignedSalesRep',
        operator: 'is_not_null',
        value: null,
        scorePoints: 10,
        maxScore: 10,
        priority: 7,
      },
      {
        ruleName: 'High Priority Lead',
        ruleDescription: 'Lead manually marked as high priority',
        category: 'behavioral',
        field: 'priority',
        operator: 'equals',
        value: 'high',
        scorePoints: 15,
        maxScore: 15,
        priority: 10,
      },
      // Engagement Rules
      {
        ruleName: 'Lead Status - Qualified',
        ruleDescription: 'Lead has reached qualified status',
        category: 'engagement',
        field: 'status',
        operator: 'equals',
        value: 'qualified',
        scorePoints: 20,
        maxScore: 20,
        priority: 10,
      },
      {
        ruleName: 'Lead Status - Proposal',
        ruleDescription: 'Lead has reached proposal stage',
        category: 'engagement',
        field: 'status',
        operator: 'equals',
        value: 'proposal',
        scorePoints: 15,
        maxScore: 15,
        priority: 9,
      },
      {
        ruleName: 'Lead Status - Contacted',
        ruleDescription: 'Lead has been contacted',
        category: 'engagement',
        field: 'status',
        operator: 'equals',
        value: 'contacted',
        scorePoints: 10,
        maxScore: 10,
        priority: 8,
      },
    ];

    for (const rule of scoringRules) {
      await storage.createLeadScoringRule({
        ...rule,
        tenantId,
        createdBy: userId,
        isActive: true,
      });
    }

    console.log(`✅ Created ${scoringRules.length} lead scoring rules`);

    // ==================== Create Sample Leads with Scores ====================
    console.log('📋 Creating sample leads with scores...');

    // Get existing leads or create sample ones
    const existingLeads = await storage.getBusinessRecords(tenantId, 'lead');

    if (existingLeads.length === 0) {
      // Create sample leads
      const sampleLeads = [
        {
          companyName: 'Acme Legal Services LLP',
          industry: 'Legal',
          employeeCount: 750,
          annualRevenue: 15000000,
          status: 'qualified',
          priority: 'high',
          website: 'https://acmelegal.example.com',
        },
        {
          companyName: 'Springfield Medical Center',
          industry: 'Healthcare',
          employeeCount: 450,
          annualRevenue: 8500000,
          status: 'proposal',
          priority: 'high',
          website: 'https://springfieldmedical.example.com',
        },
        {
          companyName: 'Downtown Financial Group',
          industry: 'Finance',
          employeeCount: 320,
          annualRevenue: 6200000,
          status: 'contacted',
          priority: 'medium',
          website: 'https://downtownfinancial.example.com',
        },
        {
          companyName: 'Tech Startup Inc',
          industry: 'Technology',
          employeeCount: 85,
          annualRevenue: 1200000,
          status: 'contacted',
          priority: 'medium',
          website: 'https://techstartup.example.com',
        },
        {
          companyName: 'Small Business LLC',
          industry: 'Retail',
          employeeCount: 25,
          annualRevenue: 500000,
          status: 'new',
          priority: 'low',
          website: null,
        },
      ];

      for (const leadData of sampleLeads) {
        const lead = await storage.createBusinessRecord({
          ...leadData,
          tenantId,
          recordType: 'lead',
          email: `contact@${leadData.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
          phone: '555-0100',
          ownerId: userId,
          leadScore: 0, // Will be calculated below
        });

        // Create BANT qualification for top leads
        if (leadData.status === 'qualified' || leadData.status === 'proposal') {
          await storage.createBantQualification({
            leadId: lead.id,
            tenantId,
            // Budget
            budgetIdentified: true,
            budgetAmount: leadData.annualRevenue * 0.02, // 2% of annual revenue
            budgetTimeframe: 'current_quarter',
            budgetApproved: leadData.status === 'proposal',
            budgetScore: leadData.status === 'proposal' ? 25 : 15,
            budgetNotes: 'Budget allocated for office equipment upgrade',
            // Authority
            decisionMakerIdentified: true,
            decisionMakerName: 'John Smith',
            decisionMakerTitle: 'Operations Director',
            decisionMakerContact: 'jsmith@company.com',
            decisionProcess: 'Board approval required for purchases over $50k',
            authorityScore: 25,
            authorityNotes: 'Direct contact with decision maker established',
            // Need
            needIdentified: true,
            needType: leadData.status === 'proposal' ? 'replacement' : 'new_equipment',
            needUrgency: leadData.status === 'proposal' ? 'high' : 'medium',
            needDescription: 'Current equipment is aging and experiencing frequent service issues',
            painPoints: ['high_maintenance_costs', 'equipment_downtime', 'poor_quality_output'],
            needScore: leadData.status === 'proposal' ? 20 : 15,
            needNotes: 'Multiple pain points identified',
            // Timeline
            timelineIdentified: true,
            expectedCloseDate: new Date(
              Date.now() + (leadData.status === 'proposal' ? 30 : 90) * 24 * 60 * 60 * 1000,
            ),
            decisionTimeline: leadData.status === 'proposal' ? '30_days' : '90_days',
            implementationTimeline: '2_weeks',
            blockers: leadData.status === 'proposal' ? [] : ['budget_approval_pending'],
            timelineScore: leadData.status === 'proposal' ? 20 : 15,
            timelineNotes: 'Timeline confirmed with decision maker',
            // Overall
            totalBantScore: leadData.status === 'proposal' ? 90 : 70,
            qualificationStatus: leadData.status === 'proposal' ? 'highly_qualified' : 'qualified',
            qualifiedDate: new Date(),
            assessedBy: userId,
            lastAssessedAt: new Date(),
          });
        }

        // Create engagement tracking for active leads
        if (leadData.status !== 'new') {
          const engagementTypes = [
            { type: 'email_open', channel: 'email', value: 2 },
            { type: 'email_click', channel: 'email', value: 5 },
            { type: 'website_visit', channel: 'website', value: 3 },
            { type: 'call_answered', channel: 'phone', value: 10 },
          ];

          for (const engagement of engagementTypes.slice(
            0,
            leadData.status === 'proposal' ? 4 : 2,
          )) {
            await storage.createLeadEngagement({
              leadId: lead.id,
              tenantId,
              engagementType: engagement.type,
              engagementChannel: engagement.channel,
              engagementSource: 'outreach_campaign_001',
              engagementValue: engagement.value,
              userId,
            });
          }
        }

        console.log(`✅ Created lead: ${leadData.companyName}`);
      }
    } else {
      console.log(`✅ Using ${existingLeads.length} existing leads`);
    }

    // ==================== Calculate Scores for All Leads ====================
    console.log('📋 Calculating scores for all leads...');

    const allLeads = await storage.getBusinessRecords(tenantId, 'lead');
    let scoredCount = 0;

    for (const lead of allLeads) {
      try {
        // Get active scoring rules
        const rules = await storage.getActiveLeadScoringRules(tenantId);

        let demographicScore = 0;
        let firmographicScore = 0;
        let behavioralScore = 0;
        let engagementScore = 0;
        let bantScore = 0;

        // Apply scoring rules
        for (const rule of rules) {
          const fieldValue = (lead as any)[rule.field];
          let ruleMatches = false;

          switch (rule.operator) {
            case 'equals':
              ruleMatches = fieldValue === rule.value;
              break;
            case 'greater_than':
              ruleMatches = Number(fieldValue) > Number(rule.value);
              break;
            case 'is_not_null':
              ruleMatches = fieldValue !== null && fieldValue !== undefined;
              break;
          }

          if (ruleMatches) {
            // Track factor
            await storage.createLeadScoringFactor({
              leadId: lead.id,
              ruleId: rule.id,
              tenantId,
              factorName: rule.ruleName,
              factorCategory: rule.category,
              pointsAwarded: rule.scorePoints,
              evaluatedField: rule.field,
              evaluatedValue: fieldValue,
              ruleCondition: { operator: rule.operator, value: rule.value },
            });

            // Add points to category
            switch (rule.category) {
              case 'demographic':
                demographicScore += rule.scorePoints;
                break;
              case 'firmographic':
                firmographicScore += rule.scorePoints;
                break;
              case 'behavioral':
                behavioralScore += rule.scorePoints;
                break;
              case 'engagement':
                engagementScore += rule.scorePoints;
                break;
            }
          }
        }

        // Get BANT score
        const bantQualification = await storage.getBantQualification(lead.id);
        if (bantQualification) {
          bantScore = bantQualification.totalBantScore;
        }

        // Get engagement score
        const recentEngagementScore = await storage.getEngagementScore(lead.id, 30);
        engagementScore += recentEngagementScore;

        // Cap components
        demographicScore = Math.min(demographicScore, 20);
        firmographicScore = Math.min(firmographicScore, 20);
        behavioralScore = Math.min(behavioralScore, 20);
        engagementScore = Math.min(engagementScore, 20);
        bantScore = Math.min(bantScore, 25);

        // Calculate total
        const totalScore = Math.min(
          Math.round(
            demographicScore +
              firmographicScore +
              behavioralScore +
              engagementScore +
              bantScore * 0.8,
          ),
          100,
        );

        // Determine grade
        let leadGrade: string;
        if (totalScore >= 90) leadGrade = 'A+';
        else if (totalScore >= 80) leadGrade = 'A';
        else if (totalScore >= 70) leadGrade = 'B+';
        else if (totalScore >= 60) leadGrade = 'B';
        else if (totalScore >= 50) leadGrade = 'C+';
        else if (totalScore >= 40) leadGrade = 'C';
        else leadGrade = 'D';

        // Determine tier
        let leadTier: string;
        if (totalScore >= 75) leadTier = 'hot';
        else if (totalScore >= 50) leadTier = 'warm';
        else leadTier = 'cold';

        // Determine action
        let recommendedAction: string;
        if (totalScore >= 75) recommendedAction = 'contact_immediately';
        else if (totalScore >= 50) recommendedAction = 'nurture';
        else if (totalScore >= 30) recommendedAction = 'request_more_info';
        else recommendedAction = 'disqualify';

        // Save calculation
        await storage.createLeadScoreCalculation({
          leadId: lead.id,
          tenantId,
          demographicScore,
          firmographicScore,
          behavioralScore,
          engagementScore,
          bantScore: Math.round(bantScore),
          totalScore,
          previousScore: 0,
          scoreChange: totalScore,
          leadGrade,
          leadTier,
          predictionScore: null,
          confidenceLevel: 'medium',
          recommendedAction,
          calculationMethod: 'rule_based',
          rulesApplied: [],
          calculationDuration: 100,
        });

        // Update lead score
        await storage.updateBusinessRecord(lead.id, {
          leadScore: totalScore,
          priority: leadTier === 'hot' ? 'high' : leadTier === 'warm' ? 'medium' : 'low',
        });

        scoredCount++;
      } catch (error) {
        console.error(`Error scoring lead ${lead.companyName}:`, error);
      }
    }

    console.log(`✅ Scored ${scoredCount} leads`);

    console.log('✅ Lead scoring seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding lead scoring:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedLeadScoring()
    .then(() => {
      console.log('✅ Seeding complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export { seedLeadScoring };
