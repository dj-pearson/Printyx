import { CheckCircle2, TrendingUp, Star, Target, Award, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface PerformanceMetricsProps {
  callsData: any;
  partsData: any;
  timeData: any;
}

export default function PerformanceMetrics({ callsData, partsData, timeData }: PerformanceMetricsProps) {
  // Extract key metrics
  const firstTimeFixRate = callsData?.summary?.firstTimeFixRate || 0;
  const averageSatisfaction = callsData?.summary?.averageSatisfaction || 0;
  const productivity = callsData?.performance?.productivity || 0;
  const utilizationRate = timeData?.summary?.utilizationRate || 0;
  const productivityRate = timeData?.metrics?.productivityRate || 0;
  const billablePercentage = partsData?.metrics?.billablePercentage || 0;

  // Calculate overall performance score (weighted average)
  const overallScore = (
    firstTimeFixRate * 0.3 +
    (averageSatisfaction / 5) * 100 * 0.2 +
    productivity * 100 * 0.2 +
    utilizationRate * 0.15 +
    productivityRate * 0.15
  );

  // Get performance grade
  const getGrade = (score: number) => {
    if (score >= 90) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900', border: 'border-green-500' };
    if (score >= 80) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900', border: 'border-blue-500' };
    if (score >= 70) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900', border: 'border-yellow-500' };
    if (score >= 60) return { grade: 'D', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900', border: 'border-orange-500' };
    return { grade: 'F', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900', border: 'border-red-500' };
  };

  const performanceGrade = getGrade(overallScore);

  // Metric components
  const MetricCard = ({
    icon: Icon,
    label,
    value,
    target,
    unit = '%',
    description,
  }: {
    icon: any;
    label: string;
    value: number;
    target: number;
    unit?: string;
    description: string;
  }) => {
    const percentage = (value / target) * 100;
    const isOnTarget = value >= target;

    return (
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${isOnTarget ? 'text-green-600' : 'text-orange-600'}`} />
            <span className="font-semibold text-sm">{label}</span>
          </div>
          {isOnTarget ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          )}
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <div className="text-3xl font-bold">{value.toFixed(1)}</div>
          <div className="text-sm text-muted-foreground">{unit}</div>
          <div className="text-xs text-muted-foreground ml-auto">/ {target}{unit}</div>
        </div>
        <Progress value={Math.min(percentage, 100)} className="h-2 mb-2" />
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overall Performance Score */}
      <div className={`p-6 rounded-lg border-2 ${performanceGrade.border} ${performanceGrade.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Overall Performance
            </h3>
            <div className="flex items-baseline gap-3">
              <div className="text-5xl font-bold">{overallScore.toFixed(1)}</div>
              <div className="text-2xl text-muted-foreground">/ 100</div>
            </div>
            <div className="mt-2 text-sm">
              <span className="font-medium">Grade: </span>
              <span className={`text-2xl font-bold ${performanceGrade.color}`}>
                {performanceGrade.grade}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <Award className={`h-16 w-16 ${performanceGrade.color}`} />
            <div className={`text-xs font-medium mt-2 ${performanceGrade.color}`}>
              {overallScore >= 90 ? 'Outstanding' :
               overallScore >= 80 ? 'Excellent' :
               overallScore >= 70 ? 'Good' :
               overallScore >= 60 ? 'Fair' : 'Needs Improvement'}
            </div>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Key Performance Indicators</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <MetricCard
            icon={CheckCircle2}
            label="First Time Fix Rate"
            value={firstTimeFixRate}
            target={85}
            description="Percentage of issues resolved on first visit"
          />
          <MetricCard
            icon={Star}
            label="Customer Satisfaction"
            value={(averageSatisfaction / 5) * 100}
            target={80}
            description="Average customer rating (1-5 scale)"
          />
          <MetricCard
            icon={Target}
            label="Utilization Rate"
            value={utilizationRate}
            target={75}
            description="Percentage of billable hours"
          />
          <MetricCard
            icon={TrendingUp}
            label="Productivity Rate"
            value={productivityRate}
            target={70}
            description="Percentage of productive hours (diagnostic + repair)"
          />
        </div>
      </div>

      {/* Performance Breakdown */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Performance Breakdown</h3>
        <div className="space-y-4">
          {/* Service Quality */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Service Quality</span>
              <span className="text-sm font-bold">
                {((firstTimeFixRate * 0.6 + (averageSatisfaction / 5) * 100 * 0.4)).toFixed(0)}%
              </span>
            </div>
            <Progress value={(firstTimeFixRate * 0.6 + (averageSatisfaction / 5) * 100 * 0.4)} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Based on first-time fix rate (60%) and customer satisfaction (40%)
            </div>
          </div>

          {/* Time Management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Time Management</span>
              <span className="text-sm font-bold">
                {((utilizationRate * 0.6 + productivityRate * 0.4)).toFixed(0)}%
              </span>
            </div>
            <Progress value={(utilizationRate * 0.6 + productivityRate * 0.4)} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Based on utilization (60%) and productivity (40%)
            </div>
          </div>

          {/* Resource Management */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Resource Management</span>
              <span className="text-sm font-bold">{billablePercentage.toFixed(0)}%</span>
            </div>
            <Progress value={billablePercentage} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Percentage of parts costs that are billable
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">Total Service Calls</div>
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
            {callsData?.summary?.totalCalls || 0}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {callsData?.summary?.completed || 0} completed,{' '}
            {callsData?.summary?.inProgress || 0} in progress
          </div>
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">Total Hours</div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-300">
            {timeData?.summary?.totalHours?.toFixed(1) || 0}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            {timeData?.summary?.billableHours?.toFixed(1) || 0} billable,{' '}
            {timeData?.summary?.nonBillableHours?.toFixed(1) || 0} non-billable
          </div>
        </div>

        <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">Parts Cost</div>
          <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
            ${(partsData?.summary?.totalCost || 0).toLocaleString()}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            ${(partsData?.summary?.billableCost || 0).toLocaleString()} billable
          </div>
        </div>
      </div>

      {/* Improvement Suggestions */}
      {overallScore < 80 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
            Areas for Improvement
          </h4>
          <ul className="space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
            {firstTimeFixRate < 85 && (
              <li>• Improve first-time fix rate through better diagnostics and preparation</li>
            )}
            {averageSatisfaction < 4 && (
              <li>• Focus on customer communication and service quality</li>
            )}
            {utilizationRate < 75 && (
              <li>• Increase billable hours through better time management</li>
            )}
            {productivityRate < 70 && (
              <li>• Reduce travel time and non-productive activities</li>
            )}
            {billablePercentage < 80 && (
              <li>• Ensure proper parts usage tracking and billing</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
