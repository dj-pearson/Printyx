/**
 * Print Cost Calculator Service
 * Comprehensive algorithms for calculating TCO, benchmarking, and identifying savings opportunities
 */

// ==================== Types ====================

export interface FleetInputs {
  deviceCount: number;
  deviceTypes: string[];
  fleetAge: string;
  monthlyPageVolume: number;
  colorRatio: number; // 0-100
  employeeCount: number;
  industry: string;
  painPoints: string[];

  // Optional user-provided costs
  monthlySupplieCost?: number;
  monthlyServiceCost?: number;
  monthlyDowntimeHours?: number;
  monthlyEnergyCost?: number;
}

export interface CalculationResults {
  costPerPageBW: number;
  costPerPageColor: number;
  annualTCO: number;
  hiddenCosts: {
    supplyWaste: number;
    laborCost: number;
    downtimeCost: number;
    energyCost: number;
    serviceFrequency: number;
  };
  benchmarking: {
    industryAverageCostPerPage: number;
    percentageAboveIndustry: number;
    costPerEmployee: number;
    industryAverageCostPerEmployee: number;
    utilizationScore: number;
  };
  savingsOpportunities: {
    consolidation: number;
    upgradeEquipment: number;
    printPolicies: number;
    supplyManagement: number;
    managedPrintServices: number;
    total: number;
  };
  breakdown: {
    supplies: number;
    service: number;
    energy: number;
    labor: number;
    downtime: number;
  };
}

// ==================== Industry Cost Benchmarks ====================

const INDUSTRY_BENCHMARKS: Record<
  string,
  {
    avgCostPerPageBW: number;
    avgCostPerPageColor: number;
    avgCostPerEmployee: number;
    avgUtilizationRate: number;
    avgDowntimeHoursPerMonth: number;
    avgDevicePerEmployee: number;
  }
> = {
  healthcare: {
    avgCostPerPageBW: 0.025,
    avgCostPerPageColor: 0.12,
    avgCostPerEmployee: 180,
    avgUtilizationRate: 65,
    avgDowntimeHoursPerMonth: 3.2,
    avgDevicePerEmployee: 0.12,
  },
  legal: {
    avgCostPerPageBW: 0.03,
    avgCostPerPageColor: 0.15,
    avgCostPerEmployee: 320,
    avgUtilizationRate: 78,
    avgDowntimeHoursPerMonth: 2.1,
    avgDevicePerEmployee: 0.15,
  },
  education: {
    avgCostPerPageBW: 0.018,
    avgCostPerPageColor: 0.09,
    avgCostPerEmployee: 95,
    avgUtilizationRate: 58,
    avgDowntimeHoursPerMonth: 4.5,
    avgDevicePerEmployee: 0.08,
  },
  financial_services: {
    avgCostPerPageBW: 0.028,
    avgCostPerPageColor: 0.14,
    avgCostPerEmployee: 240,
    avgUtilizationRate: 70,
    avgDowntimeHoursPerMonth: 2.8,
    avgDevicePerEmployee: 0.1,
  },
  manufacturing: {
    avgCostPerPageBW: 0.022,
    avgCostPerPageColor: 0.11,
    avgCostPerEmployee: 150,
    avgUtilizationRate: 62,
    avgDowntimeHoursPerMonth: 3.8,
    avgDevicePerEmployee: 0.09,
  },
  retail: {
    avgCostPerPageBW: 0.02,
    avgCostPerPageColor: 0.1,
    avgCostPerEmployee: 85,
    avgUtilizationRate: 55,
    avgDowntimeHoursPerMonth: 4.2,
    avgDevicePerEmployee: 0.07,
  },
  government: {
    avgCostPerPageBW: 0.026,
    avgCostPerPageColor: 0.13,
    avgCostPerEmployee: 210,
    avgUtilizationRate: 60,
    avgDowntimeHoursPerMonth: 3.5,
    avgDevicePerEmployee: 0.11,
  },
  technology: {
    avgCostPerPageBW: 0.024,
    avgCostPerPageColor: 0.12,
    avgCostPerEmployee: 140,
    avgUtilizationRate: 68,
    avgDowntimeHoursPerMonth: 2.5,
    avgDevicePerEmployee: 0.08,
  },
  professional_services: {
    avgCostPerPageBW: 0.027,
    avgCostPerPageColor: 0.13,
    avgCostPerEmployee: 190,
    avgUtilizationRate: 72,
    avgDowntimeHoursPerMonth: 2.9,
    avgDevicePerEmployee: 0.12,
  },
  non_profit: {
    avgCostPerPageBW: 0.019,
    avgCostPerPageColor: 0.09,
    avgCostPerEmployee: 75,
    avgUtilizationRate: 52,
    avgDowntimeHoursPerMonth: 5.0,
    avgDevicePerEmployee: 0.08,
  },
  other: {
    avgCostPerPageBW: 0.023,
    avgCostPerPageColor: 0.11,
    avgCostPerEmployee: 160,
    avgUtilizationRate: 62,
    avgDowntimeHoursPerMonth: 3.5,
    avgDevicePerEmployee: 0.1,
  },
};

// ==================== Fleet Age Multipliers ====================

const FLEET_AGE_MULTIPLIERS: Record<
  string,
  {
    serviceCostMultiplier: number;
    energyCostMultiplier: number;
    downtimeMultiplier: number;
    reliabilityScore: number;
  }
> = {
  under_2_years: {
    serviceCostMultiplier: 1.0,
    energyCostMultiplier: 1.0,
    downtimeMultiplier: 1.0,
    reliabilityScore: 95,
  },
  '2_4_years': {
    serviceCostMultiplier: 1.25,
    energyCostMultiplier: 1.15,
    downtimeMultiplier: 1.4,
    reliabilityScore: 85,
  },
  '5_7_years': {
    serviceCostMultiplier: 1.8,
    energyCostMultiplier: 1.35,
    downtimeMultiplier: 2.1,
    reliabilityScore: 70,
  },
  '8_plus_years': {
    serviceCostMultiplier: 2.5,
    energyCostMultiplier: 1.6,
    downtimeMultiplier: 3.2,
    reliabilityScore: 55,
  },
};

// ==================== Device Type Cost Factors ====================

const DEVICE_TYPE_FACTORS: Record<
  string,
  {
    avgSupplyCostPerPage: number;
    avgServiceCostPerMonth: number;
    avgEnergyKwhPerMonth: number;
  }
> = {
  desktop_printer: {
    avgSupplyCostPerPage: 0.035,
    avgServiceCostPerMonth: 25,
    avgEnergyKwhPerMonth: 15,
  },
  copier: {
    avgSupplyCostPerPage: 0.02,
    avgServiceCostPerMonth: 85,
    avgEnergyKwhPerMonth: 45,
  },
  mfp: {
    avgSupplyCostPerPage: 0.022,
    avgServiceCostPerMonth: 75,
    avgEnergyKwhPerMonth: 40,
  },
  production_printer: {
    avgSupplyCostPerPage: 0.015,
    avgServiceCostPerMonth: 250,
    avgEnergyKwhPerMonth: 120,
  },
};

// ==================== Constants ====================

const AVERAGE_HOURLY_EMPLOYEE_COST = 42; // Average loaded cost per employee hour
const AVERAGE_KWH_COST = 0.14; // Average commercial electricity cost per kWh
const TONER_WASTE_FACTOR = 0.15; // 15% of supplies go to waste
const LABOR_HOURS_PER_MONTH_SUPPLY_MANAGEMENT = 4; // Hours spent managing supplies
const MANAGED_PRINT_SERVICES_SAVINGS_PERCENT = 0.25; // 25% average savings with MPS

// ==================== Main Calculation Function ====================

export function calculatePrintCosts(inputs: FleetInputs): CalculationResults {
  // Get industry benchmarks
  const industryBenchmark = INDUSTRY_BENCHMARKS[inputs.industry] || INDUSTRY_BENCHMARKS.other;
  const fleetAgeMultiplier = FLEET_AGE_MULTIPLIERS[inputs.fleetAge];

  // Calculate B&W and color volumes
  const monthlyBWPages = inputs.monthlyPageVolume * ((100 - inputs.colorRatio) / 100);
  const monthlyColorPages = inputs.monthlyPageVolume * (inputs.colorRatio / 100);

  // ==================== Supply Costs ====================
  let monthlySupplieCost: number;
  if (inputs.monthlySupplieCost) {
    monthlySupplieCost = inputs.monthlySupplieCost;
  } else {
    // Estimate based on device types and page volume
    const avgSupplyCost = calculateAverageSupplyCost(inputs.deviceTypes);
    monthlySupplieCost =
      monthlyBWPages * avgSupplyCost * 0.6 + monthlyColorPages * avgSupplyCost * 2.5;
  }

  // ==================== Service/Maintenance Costs ====================
  let monthlyServiceCost: number;
  if (inputs.monthlyServiceCost) {
    monthlyServiceCost = inputs.monthlyServiceCost;
  } else {
    // Estimate based on device count, types, and age
    const avgServiceCost = calculateAverageServiceCost(inputs.deviceTypes);
    monthlyServiceCost =
      avgServiceCost * inputs.deviceCount * fleetAgeMultiplier.serviceCostMultiplier;
  }

  // ==================== Energy Costs ====================
  let monthlyEnergyCost: number;
  if (inputs.monthlyEnergyCost) {
    monthlyEnergyCost = inputs.monthlyEnergyCost;
  } else {
    // Estimate based on device types and age
    const avgEnergyKwh = calculateAverageEnergyConsumption(inputs.deviceTypes);
    monthlyEnergyCost =
      avgEnergyKwh *
      inputs.deviceCount *
      AVERAGE_KWH_COST *
      fleetAgeMultiplier.energyCostMultiplier;
  }

  // ==================== Downtime Costs ====================
  let monthlyDowntimeHours: number;
  if (inputs.monthlyDowntimeHours) {
    monthlyDowntimeHours = inputs.monthlyDowntimeHours;
  } else {
    // Estimate based on age and reliability
    monthlyDowntimeHours =
      industryBenchmark.avgDowntimeHoursPerMonth *
      inputs.deviceCount *
      fleetAgeMultiplier.downtimeMultiplier;
  }

  const downtimeCost =
    monthlyDowntimeHours * AVERAGE_HOURLY_EMPLOYEE_COST * (inputs.employeeCount * 0.15); // 15% of employees affected

  // ==================== Hidden Costs ====================

  // Supply waste (expired toner, overordering, etc.)
  const supplyWasteCost = monthlySupplieCost * TONER_WASTE_FACTOR;

  // Labor cost for supply management
  const laborCost = LABOR_HOURS_PER_MONTH_SUPPLY_MANAGEMENT * AVERAGE_HOURLY_EMPLOYEE_COST;

  const hiddenCosts = {
    supplyWaste: supplyWasteCost * 12,
    laborCost: laborCost * 12,
    downtimeCost: downtimeCost * 12,
    energyCost: monthlyEnergyCost * 12,
    serviceFrequency: monthlyServiceCost * 12,
  };

  // ==================== Total Costs ====================

  const monthlyTotalCost =
    monthlySupplieCost +
    monthlyServiceCost +
    monthlyEnergyCost +
    supplyWasteCost +
    laborCost +
    downtimeCost;
  const annualTCO = monthlyTotalCost * 12;

  // ==================== Cost Per Page ====================

  const costPerPageBW = (monthlyTotalCost / (inputs.monthlyPageVolume || 1)) * 0.85; // Weighted for B&W
  const costPerPageColor = (monthlyTotalCost / (inputs.monthlyPageVolume || 1)) * 1.95; // Weighted for color

  // ==================== Benchmarking ====================

  const costPerEmployee = annualTCO / inputs.employeeCount;
  const avgCostPerPage = (costPerPageBW + costPerPageColor) / 2;
  const industryAvgCostPerPage =
    (industryBenchmark.avgCostPerPageBW + industryBenchmark.avgCostPerPageColor) / 2;
  const percentageAboveIndustry =
    ((avgCostPerPage - industryAvgCostPerPage) / industryAvgCostPerPage) * 100;

  // Calculate utilization score
  const pagesPerDevicePerMonth = inputs.monthlyPageVolume / inputs.deviceCount;
  const idealPagesPerDevice = 8000; // Industry standard for optimal utilization
  const utilizationScore = Math.min((pagesPerDevicePerMonth / idealPagesPerDevice) * 100, 100);

  const benchmarking = {
    industryAverageCostPerPage: industryAvgCostPerPage,
    percentageAboveIndustry: Math.round(percentageAboveIndustry * 10) / 10,
    costPerEmployee: Math.round(costPerEmployee),
    industryAverageCostPerEmployee: industryBenchmark.avgCostPerEmployee,
    utilizationScore: Math.round(utilizationScore),
  };

  // ==================== Savings Opportunities ====================

  // Consolidation savings (underutilized devices)
  let consolidationSavings = 0;
  if (utilizationScore < 50) {
    const devicesToRemove = Math.floor(inputs.deviceCount * 0.3);
    const avgDeviceCost = (monthlyServiceCost + monthlyEnergyCost) / inputs.deviceCount;
    consolidationSavings = devicesToRemove * avgDeviceCost * 12;
  }

  // Equipment upgrade savings (older equipment)
  let upgradeEquipmentSavings = 0;
  if (inputs.fleetAge === '5_7_years' || inputs.fleetAge === '8_plus_years') {
    // Newer equipment saves on service and energy
    const serviceReduction = monthlyServiceCost * 0.45;
    const energyReduction = monthlyEnergyCost * 0.3;
    upgradeEquipmentSavings = (serviceReduction + energyReduction) * 12;
  }

  // Print policies savings (reduce unnecessary printing)
  const printPoliciesSavings = monthlySupplieCost * 0.2 * 12; // 20% reduction from policies

  // Supply management savings
  const supplyManagementSavings = supplyWasteCost * 12 + laborCost * 0.75 * 12;

  // Managed print services total savings
  const mpsSavings = annualTCO * MANAGED_PRINT_SERVICES_SAVINGS_PERCENT;

  const savingsOpportunities = {
    consolidation: Math.round(consolidationSavings),
    upgradeEquipment: Math.round(upgradeEquipmentSavings),
    printPolicies: Math.round(printPoliciesSavings),
    supplyManagement: Math.round(supplyManagementSavings),
    managedPrintServices: Math.round(mpsSavings),
    total: Math.round(
      consolidationSavings +
        upgradeEquipmentSavings +
        printPoliciesSavings +
        supplyManagementSavings,
    ),
  };

  // ==================== Cost Breakdown ====================

  const breakdown = {
    supplies: Math.round(monthlySupplieCost * 12),
    service: Math.round(monthlyServiceCost * 12),
    energy: Math.round(monthlyEnergyCost * 12),
    labor: Math.round(laborCost * 12),
    downtime: Math.round(downtimeCost * 12),
  };

  return {
    costPerPageBW: Math.round(costPerPageBW * 1000) / 1000,
    costPerPageColor: Math.round(costPerPageColor * 1000) / 1000,
    annualTCO: Math.round(annualTCO),
    hiddenCosts,
    benchmarking,
    savingsOpportunities,
    breakdown,
  };
}

// ==================== Helper Functions ====================

function calculateAverageSupplyCost(deviceTypes: string[]): number {
  if (deviceTypes.length === 0) return 0.025;

  const total = deviceTypes.reduce((sum, type) => {
    const factor = DEVICE_TYPE_FACTORS[type];
    return sum + (factor?.avgSupplyCostPerPage || 0.025);
  }, 0);

  return total / deviceTypes.length;
}

function calculateAverageServiceCost(deviceTypes: string[]): number {
  if (deviceTypes.length === 0) return 75;

  const total = deviceTypes.reduce((sum, type) => {
    const factor = DEVICE_TYPE_FACTORS[type];
    return sum + (factor?.avgServiceCostPerMonth || 75);
  }, 0);

  return total / deviceTypes.length;
}

function calculateAverageEnergyConsumption(deviceTypes: string[]): number {
  if (deviceTypes.length === 0) return 40;

  const total = deviceTypes.reduce((sum, type) => {
    const factor = DEVICE_TYPE_FACTORS[type];
    return sum + (factor?.avgEnergyKwhPerMonth || 40);
  }, 0);

  return total / deviceTypes.length;
}

// ==================== Lead Scoring ====================

export function calculateLeadScore(inputs: FleetInputs, results: CalculationResults): number {
  let score = 0;

  // Device count scoring (more devices = higher score)
  if (inputs.deviceCount >= 20) score += 25;
  else if (inputs.deviceCount >= 10) score += 15;
  else if (inputs.deviceCount >= 5) score += 10;
  else score += 5;

  // Annual TCO scoring (higher TCO = higher value lead)
  if (results.annualTCO >= 50000) score += 25;
  else if (results.annualTCO >= 25000) score += 20;
  else if (results.annualTCO >= 10000) score += 15;
  else score += 10;

  // Savings opportunity scoring
  if (results.savingsOpportunities.total >= 15000) score += 20;
  else if (results.savingsOpportunities.total >= 7500) score += 15;
  else if (results.savingsOpportunities.total >= 3000) score += 10;

  // Fleet age scoring (older = more likely to upgrade)
  if (inputs.fleetAge === '8_plus_years') score += 15;
  else if (inputs.fleetAge === '5_7_years') score += 10;
  else if (inputs.fleetAge === '2_4_years') score += 5;

  // Pain points scoring
  if (inputs.painPoints.includes('frequent_breakdowns')) score += 10;
  if (inputs.painPoints.includes('high_costs')) score += 10;
  if (inputs.painPoints.includes('lack_of_visibility')) score += 5;

  // Employee count scoring (larger companies = higher value)
  if (inputs.employeeCount >= 250) score += 10;
  else if (inputs.employeeCount >= 100) score += 8;
  else if (inputs.employeeCount >= 50) score += 5;

  return Math.min(score, 100); // Cap at 100
}

// ==================== Lead Temperature ====================

export function determineLeadTemperature(leadScore: number): 'hot' | 'warm' | 'cold' {
  if (leadScore >= 70) return 'hot';
  if (leadScore >= 40) return 'warm';
  return 'cold';
}

// ==================== Recommendation Generator ====================

export function generateRecommendations(
  inputs: FleetInputs,
  results: CalculationResults,
): Array<{
  title: string;
  description: string;
  savings: number;
  priority: 'high' | 'medium' | 'low';
  actionItems: string[];
}> {
  const recommendations: Array<{
    title: string;
    description: string;
    savings: number;
    priority: 'high' | 'medium' | 'low';
    actionItems: string[];
  }> = [];

  // Consolidation recommendation
  if (
    results.benchmarking.utilizationScore < 50 &&
    results.savingsOpportunities.consolidation > 0
  ) {
    recommendations.push({
      title: 'Consolidate Underutilized Devices',
      description: `Your fleet utilization is only ${results.benchmarking.utilizationScore}%. Consolidating devices can reduce costs without impacting productivity.`,
      savings: results.savingsOpportunities.consolidation,
      priority: 'high',
      actionItems: [
        'Audit device usage patterns over 30 days',
        'Identify devices with <2,000 pages/month',
        'Plan centralized print stations',
        'Remove 30% of underutilized devices',
      ],
    });
  }

  // Equipment upgrade recommendation
  if (
    (inputs.fleetAge === '5_7_years' || inputs.fleetAge === '8_plus_years') &&
    results.savingsOpportunities.upgradeEquipment > 0
  ) {
    recommendations.push({
      title: 'Upgrade Aging Equipment',
      description:
        'Your aging fleet is costing significantly more in service and energy. Modern devices pay for themselves in 18-24 months.',
      savings: results.savingsOpportunities.upgradeEquipment,
      priority: 'high',
      actionItems: [
        'Calculate ROI for replacing oldest 50% of devices',
        'Request quotes for energy-efficient MFPs',
        'Consider leasing for predictable costs',
        'Plan phased replacement over 12 months',
      ],
    });
  }

  // Print policies recommendation
  if (results.savingsOpportunities.printPolicies > 5000) {
    recommendations.push({
      title: 'Implement Print Management Policies',
      description:
        'Reduce waste and unnecessary printing with smart policies. Most companies reduce volume by 20-30%.',
      savings: results.savingsOpportunities.printPolicies,
      priority: 'medium',
      actionItems: [
        'Enable duplex (double-sided) printing by default',
        'Require authentication for color printing',
        'Set department-level quotas',
        'Implement follow-me printing',
      ],
    });
  }

  // Supply management recommendation
  if (results.savingsOpportunities.supplyManagement > 3000) {
    recommendations.push({
      title: 'Centralize Supply Management',
      description:
        'Eliminate supply waste and reduce labor costs with automated supply ordering based on actual usage.',
      savings: results.savingsOpportunities.supplyManagement,
      priority: 'medium',
      actionItems: [
        'Audit current supply inventory for waste',
        'Implement just-in-time supply ordering',
        'Consolidate vendors for better pricing',
        'Use automated monitoring for reorders',
      ],
    });
  }

  // Managed print services recommendation
  if (inputs.deviceCount >= 10 && results.annualTCO >= 15000) {
    recommendations.push({
      title: 'Evaluate Managed Print Services',
      description:
        'Transfer the burden of print management to experts. Average savings of 25% plus predictable monthly costs.',
      savings: results.savingsOpportunities.managedPrintServices,
      priority: inputs.painPoints.includes('lack_of_visibility') ? 'high' : 'medium',
      actionItems: [
        'Request MPS proposals from 3 vendors',
        'Compare all-inclusive pricing vs current costs',
        'Ensure SLA includes response times',
        'Negotiate contract terms and exit clauses',
      ],
    });
  }

  // Sort by priority and savings
  return recommendations.sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.savings - a.savings;
  });
}
