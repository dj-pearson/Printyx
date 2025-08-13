import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, Info, Timer } from "lucide-react";

type ContextualPageKey =
  | "advanced-billing"
  | "service-dispatch"
  | "service-hub"
  | "product-catalog"
  | "deals-management"
  | "purchase-orders"
  | "quote-builder"
  | "task-management"
  | "quotes-management"
  | "quote-proposal-generation"
  | "advanced-analytics"
  | "enhanced-onboarding"
  | "service-dispatch-optimization"
  | "product-catalog-optimization"
  | "deals-management-optimization"
  | "purchase-orders-optimization"
  | "quote-builder-optimization";

interface ContextualHelpProps {
  page: ContextualPageKey;
  className?: string;
}

const contentMap: Record<ContextualPageKey, {
  title: string;
  industryContext?: string;
  quickTips?: string[];
  seasonal?: string;
}> = {
  "advanced-billing": {
    title: "Advanced Billing Engine",
    industryContext: "Most copier dealers lose 15-20% revenue to billing errors and missed recurring charges.",
    quickTips: [
      "Set up automated billing cycles to reduce manual work by 80%",
      "Review AI anomaly alerts to catch billing issues early",
      "Use contract renewal automation for 90-day advance notifications",
      "Monitor billing health score to maintain 89%+ accuracy",
    ],
    seasonal: "Q4 reminder: Review annual contracts for renewal opportunities",
  },
  "service-dispatch": {
    title: "Service Dispatch Optimization",
    industryContext: "Optimized routing can save 30+ minutes per technician per day.",
    quickTips: [
      "Use AI route optimization to consider traffic and technician skills",
      "Enable arrival notifications to improve customer satisfaction",
    ],
    seasonal: "Traffic patterns updated every 5 minutes",
  },
  "service-hub": {
    title: "Service Hub",
    industryContext: "First-call resolution above 85% significantly improves retention.",
    quickTips: [
      "Phone-in tickets convert 73% faster with pre-populated data",
      "Enable mobile access for technicians to complete 23% more jobs/day",
    ],
  },
  "product-catalog": {
    title: "Product Catalog",
    industryContext: "This model is trending 23% above competitors this quarter.",
    quickTips: [
      "Use natural language search (e.g., ‘color laser under $3000’)",
      "Compare products side-by-side before enabling",
    ],
    seasonal: "Monitor competitor price changes weekly",
  },
  "deals-management": {
    title: "Deals Management",
    industryContext: "Your average deal cycle is 23 days - 12% faster than industry standard.",
    quickTips: [
      "Demos increase close rates by 34%",
      "Automated follow-ups by stage improve conversion",
    ],
  },
  "purchase-orders": {
    title: "Purchase Orders",
    industryContext: "Vendor on-time delivery rates drive cash flow stability.",
    quickTips: [
      "Use templates and historical auto-population",
      "Set approval workflows with status indicators",
    ],
  },
  "quote-builder": {
    title: "Quote Builder",
    industryContext: "Bundled services yield 28% higher acceptance rates.",
    quickTips: [
      "Send Tue–Thu for 15% better response rates",
      "Add financing options to increase close rates by 22%",
    ],
  },
  "task-management": {
    title: "Task Management",
    industryContext: "Proper task breakdown accelerates projects by 18%.",
    quickTips: [
      "Prioritize by business impact",
      "Use dependencies to clarify workflow order",
    ],
  },
  "quotes-management": {
    title: "Quotes Management",
    industryContext: "Quote-to-close rate benchmark is 28%.",
    quickTips: [
      "Follow up on day 3 to raise acceptance by ~19%",
      "Track open/view time to guide next actions",
    ],
  },
  "quote-proposal-generation": {
    title: "Quote & Proposal Generation",
    industryContext: "Proposals with ROI calcs see 40% higher acceptance.",
    quickTips: [
      "Use templates with proven success rates",
      "Auto-populate with relevant case studies",
    ],
  },
  "advanced-analytics": {
    title: "Advanced Analytics",
    industryContext: "Predictive insights identify growth opportunities.",
    quickTips: [
      "Use natural language queries to find answers",
      "Set alerts for anomalies and KPI thresholds",
    ],
  },
  "enhanced-onboarding": {
    title: "Enhanced Onboarding",
    industryContext: "Thorough onboarding reduces support calls by 45%.",
    quickTips: [
      "Complete network configuration to prevent connectivity issues",
      "Use the guided wizard with validation checks",
    ],
  },
  "service-dispatch-optimization": {
    title: "Service Dispatch Optimization",
    industryContext: "Optimized routing can save 30+ minutes per technician per day and improve customer satisfaction by 18%.",
    quickTips: [
      "Enable AI route optimization to reduce travel time by 23%",
      "Use real-time tracking to monitor technician locations and traffic",
      "Check smart dispatch alerts for proactive issue resolution",
      "Review technician workload distribution for balanced assignments",
    ],
    seasonal: "Traffic conditions updated every 5 minutes for optimal routing",
  },
  "product-catalog-optimization": {
    title: "Product Catalog Intelligence",
    industryContext: "AI-powered pricing optimization can increase profit margins by 5-15% while maintaining competitiveness.",
    quickTips: [
      "Monitor competitor pricing daily for market positioning insights",
      "Apply AI pricing recommendations to maximize revenue opportunities",
      "Review product lifecycle alerts for inventory optimization",
      "Use demand forecasting to guide purchasing decisions",
    ],
    seasonal: "Market analysis shows 23% seasonal demand variance",
  },
  "deals-management-optimization": {
    title: "AI Deals Intelligence",
    industryContext: "Predictive deal scoring can improve win rates by 15-25% and reduce sales cycles by 12% on average.",
    quickTips: [
      "Monitor deal health scores daily to identify at-risk opportunities",
      "Apply AI next-best-action recommendations to accelerate deals",
      "Use competitive battle cards for strategic positioning",
      "Review pipeline forecasting for accurate revenue predictions",
    ],
    seasonal: "Q4 typically sees 15% higher deal volumes - prepare inventory",
  },
  "purchase-orders-optimization": {
    title: "Smart Procurement Intelligence",
    industryContext: "AI-powered procurement optimization can reduce costs by 8-12% while improving vendor performance and compliance.",
    quickTips: [
      "Review vendor performance scores monthly to optimize partnerships",
      "Use predictive inventory management to prevent stockouts",
      "Apply AI cost optimization recommendations for bulk purchasing",
      "Monitor compliance tracking to maintain vendor relationships",
    ],
    seasonal: "Q4 procurement: Secure pricing before year-end budget allocations",
  },
  "quote-builder-optimization": {
    title: "AI Quote Intelligence",
    industryContext: "Dynamic pricing optimization and AI-powered quote building can increase win rates by 15-25% and boost average deal value by 12%.",
    quickTips: [
      "Apply dynamic pricing recommendations for competitive advantage",
      "Use AI bundle suggestions to increase average deal size",
      "Follow optimal timing insights for better response rates",
      "Monitor quote performance analytics for continuous improvement",
    ],
    seasonal: "Q4 timing: Tuesday-Thursday quotes show 18% better response rates",
  },
};

export default function ContextualHelp({ page, className = "" }: ContextualHelpProps) {
  const cfg = contentMap[page];
  if (!cfg) return null;

  return (
    <Alert className={`bg-blue-50 border-blue-200 ${className}`}>
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-blue-800">{cfg.title}</h4>
            {cfg.seasonal && (
              <Badge variant="outline" className="text-xs">
                <Timer className="h-3 w-3 mr-1" />
                {cfg.seasonal}
              </Badge>
            )}
          </div>
          {cfg.industryContext && (
            <AlertDescription className="text-blue-800 mb-2">
              <TrendingUp className="inline-block h-4 w-4 mr-1 align-middle text-blue-600" />
              <span className="align-middle">{cfg.industryContext}</span>
            </AlertDescription>
          )}
          {cfg.quickTips && cfg.quickTips.length > 0 && (
            <ul className="mt-1 space-y-1">
              {cfg.quickTips.map((tip, idx) => (
                <li key={idx} className="text-sm text-blue-900 flex items-center">
                  <Lightbulb className="h-4 w-4 mr-2 text-blue-600" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Alert>
  );
}


