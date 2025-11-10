// Type definitions for Print Cost Calculator

export interface FleetInputs {
  // Section 1 - Fleet Information
  deviceCount: number;
  deviceTypes: string[];
  fleetAge: string;
  monthlyPageVolume: number;
  colorRatio: number;

  // Section 2 - Current Costs (optional)
  monthlySupplieCost?: number;
  monthlyServiceCost?: number;
  monthlyDowntimeHours?: number;
  monthlyEnergyCost?: number;

  // Section 3 - Business Context
  employeeCount: number;
  industry: string;
  painPoints: string[];
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

export interface Recommendation {
  title: string;
  description: string;
  savings: number;
  priority: 'high' | 'medium' | 'low';
  actionItems: string[];
}

export interface CalculatorSession {
  sessionKey: string;
  sessionId: string;
  results: CalculationResults;
  recommendations: Recommendation[];
}

export interface LeadCapture {
  email: string;
  companyName: string;
  fullName?: string;
  phone?: string;
  role: string;
  wantsQuarterlyUpdates: boolean;
}

export const DEVICE_TYPES = [
  { value: 'desktop_printer', label: 'Desktop Printers' },
  { value: 'copier', label: 'Copiers' },
  { value: 'mfp', label: 'Multifunction Printers (MFPs)' },
  { value: 'production_printer', label: 'Production Printers' },
];

export const FLEET_AGES = [
  { value: 'under_2_years', label: 'Less than 2 years' },
  { value: '2_4_years', label: '2-4 years' },
  { value: '5_7_years', label: '5-7 years' },
  { value: '8_plus_years', label: '8+ years' },
];

export const INDUSTRIES = [
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'education', label: 'Education' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'government', label: 'Government' },
  { value: 'technology', label: 'Technology' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'non_profit', label: 'Non-Profit' },
  { value: 'other', label: 'Other' },
];

export const PAIN_POINTS = [
  { value: 'high_costs', label: 'High print costs' },
  { value: 'frequent_breakdowns', label: 'Frequent equipment breakdowns' },
  { value: 'supply_management', label: 'Supply management challenges' },
  { value: 'lack_of_visibility', label: 'Lack of cost visibility' },
];

export const USER_ROLES = [
  { value: 'it_manager', label: 'IT Manager' },
  { value: 'office_manager', label: 'Office Manager' },
  { value: 'copier_dealer', label: 'Copier Dealer' },
  { value: 'owner', label: 'Business Owner/Executive' },
  { value: 'other', label: 'Other' },
];
