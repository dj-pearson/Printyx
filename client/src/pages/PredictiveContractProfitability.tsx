import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Target,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Mock data - in production, this would come from API
const contractData = [
  {
    id: 'C-2401',
    customer: 'Acme Corporation',
    equipment: 'Canon imageRUNNER ADVANCE DX C5870i',
    monthlyRevenue: 2400,
    actualCost: 1950,
    predictedCost: 2100,
    margin: 18.75,
    predictedMargin: 12.5,
    risk: 'medium',
    recommendation: 'Reprice at renewal (+12%)',
    renewalDate: '2025-03-15',
    serviceFrequency: 'High',
    emergencyCalls: 8,
    predictedEmergencyCalls: 12,
  },
  {
    id: 'C-2402',
    customer: 'TechStart Industries',
    equipment: 'Ricoh IM C6000',
    monthlyRevenue: 1800,
    actualCost: 950,
    predictedCost: 975,
    margin: 47.2,
    predictedMargin: 45.8,
    risk: 'low',
    recommendation: 'Maintain pricing',
    renewalDate: '2025-06-20',
    serviceFrequency: 'Low',
    emergencyCalls: 2,
    predictedEmergencyCalls: 2,
  },
  {
    id: 'C-2403',
    customer: 'Global Logistics LLC',
    equipment: 'Konica Minolta bizhub C459',
    monthlyRevenue: 3200,
    actualCost: 3450,
    predictedCost: 3800,
    margin: -7.8,
    predictedMargin: -18.75,
    risk: 'high',
    recommendation: 'Urgent: Reprice or exit (+25% minimum)',
    renewalDate: '2025-02-28',
    serviceFrequency: 'Very High',
    emergencyCalls: 15,
    predictedEmergencyCalls: 18,
  },
  {
    id: 'C-2404',
    customer: 'Healthcare Partners',
    equipment: 'HP LaserJet Managed E82550',
    monthlyRevenue: 2850,
    actualCost: 1900,
    predictedCost: 1950,
    margin: 33.3,
    predictedMargin: 31.6,
    risk: 'low',
    recommendation: 'Maintain pricing',
    renewalDate: '2025-08-10',
    serviceFrequency: 'Normal',
    emergencyCalls: 4,
    predictedEmergencyCalls: 4,
  },
  {
    id: 'C-2405',
    customer: 'Metro Print Services',
    equipment: 'Xerox VersaLink C7030',
    monthlyRevenue: 1950,
    actualCost: 1650,
    predictedCost: 1800,
    margin: 15.4,
    predictedMargin: 7.7,
    risk: 'medium',
    recommendation: 'Monitor closely, consider +10% at renewal',
    renewalDate: '2025-04-05',
    serviceFrequency: 'Normal',
    emergencyCalls: 6,
    predictedEmergencyCalls: 8,
  },
];

const PredictiveContractProfitability = () => {
  const [selectedContract, setSelectedContract] = useState(contractData[0]);

  // Calculate portfolio metrics
  const totalRevenue = contractData.reduce((sum, c) => sum + c.monthlyRevenue, 0);
  const totalCost = contractData.reduce((sum, c) => sum + c.actualCost, 0);
  const avgMargin = ((totalRevenue - totalCost) / totalRevenue) * 100;
  const atRiskContracts = contractData.filter((c) => c.risk === 'high' || c.margin < 10).length;
  const optimizableContracts = contractData.filter((c) => c.predictedMargin < 20).length;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getMarginColor = (margin: number) => {
    if (margin < 0) return 'text-red-600';
    if (margin < 15) return 'text-yellow-600';
    if (margin < 30) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Predictive Contract Profitability
            </h1>
            <p className="text-gray-600">
              AI-powered analytics identify underpriced contracts and predict future profitability
            </p>
          </div>
          <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-base px-4 py-2">
            AI-Powered Intelligence
          </Badge>
        </div>

        {/* Portfolio Overview */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Portfolio Margin</span>
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-600">{avgMargin.toFixed(1)}%</div>
              <p className="text-xs text-gray-500 mt-1">Across {contractData.length} contracts</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Monthly Revenue</span>
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-600">
                ${totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Total contract value</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">At-Risk Contracts</span>
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-3xl font-bold text-red-600">{atRiskContracts}</div>
              <p className="text-xs text-gray-500 mt-1">Require immediate action</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Optimization Potential</span>
                <Target className="h-5 w-5 text-purple-600" />
              </div>
              <div className="text-3xl font-bold text-purple-600">{optimizableContracts}</div>
              <p className="text-xs text-gray-500 mt-1">Can improve margins</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Contract List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Contracts by Risk</CardTitle>
              <CardDescription>Click to view details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contractData
                .sort((a, b) => {
                  const riskOrder = { high: 0, medium: 1, low: 2 };
                  return (
                    riskOrder[a.risk as keyof typeof riskOrder] -
                    riskOrder[b.risk as keyof typeof riskOrder]
                  );
                })
                .map((contract) => (
                  <div
                    key={contract.id}
                    onClick={() => setSelectedContract(contract)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedContract.id === contract.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-gray-900">{contract.id}</div>
                        <div className="text-sm text-gray-600">{contract.customer}</div>
                      </div>
                      <Badge className={`${getRiskColor(contract.risk)} text-xs`}>
                        {contract.risk}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Margin:</span>
                      <span className={`font-bold ${getMarginColor(contract.margin)}`}>
                        {contract.margin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Contract Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedContract.customer}</CardTitle>
                  <CardDescription>{selectedContract.equipment}</CardDescription>
                </div>
                <Badge className={`${getRiskColor(selectedContract.risk)}`}>
                  {selectedContract.risk.toUpperCase()} RISK
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="predictions">AI Predictions</TabsTrigger>
                  <TabsTrigger value="recommendations">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-4">Current Performance</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">Monthly Revenue</span>
                          <span className="font-bold text-green-600">
                            ${selectedContract.monthlyRevenue.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">Actual Costs</span>
                          <span className="font-bold text-gray-900">
                            ${selectedContract.actualCost.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                          <span className="text-gray-700 font-semibold">Current Margin</span>
                          <span
                            className={`font-bold text-xl ${getMarginColor(selectedContract.margin)}`}
                          >
                            {selectedContract.margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-gray-900 mb-4">Service Metrics</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">Service Frequency</span>
                          <Badge variant="outline">{selectedContract.serviceFrequency}</Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">Emergency Calls (YTD)</span>
                          <span className="font-bold text-orange-600">
                            {selectedContract.emergencyCalls}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <span className="text-gray-700">Renewal Date</span>
                          <span className="font-bold text-gray-900">
                            {selectedContract.renewalDate}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="predictions" className="space-y-6">
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border-2 border-purple-200">
                    <div className="flex items-start mb-4">
                      <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center mr-4">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1">AI Profitability Forecast</h4>
                        <p className="text-sm text-gray-600">
                          Based on equipment age, service history, and usage patterns
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">
                          Predicted Next 12 Months Cost
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          ${selectedContract.predictedCost.toLocaleString()}/mo
                        </div>
                        <div className="flex items-center mt-2 text-sm">
                          {selectedContract.predictedCost > selectedContract.actualCost ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-red-600 mr-1" />
                              <span className="text-red-600">
                                +$
                                {(
                                  selectedContract.predictedCost - selectedContract.actualCost
                                ).toLocaleString()}{' '}
                                vs current
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-4 w-4 text-green-600 mr-1" />
                              <span className="text-green-600">
                                -$
                                {(
                                  selectedContract.actualCost - selectedContract.predictedCost
                                ).toLocaleString()}{' '}
                                vs current
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">Predicted Margin</div>
                        <div
                          className={`text-2xl font-bold ${getMarginColor(selectedContract.predictedMargin)}`}
                        >
                          {selectedContract.predictedMargin.toFixed(1)}%
                        </div>
                        <div className="flex items-center mt-2 text-sm">
                          {selectedContract.predictedMargin < selectedContract.margin ? (
                            <>
                              <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                              <span className="text-red-600">
                                {(
                                  selectedContract.margin - selectedContract.predictedMargin
                                ).toFixed(1)}
                                % decline
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                              <span className="text-green-600">
                                {(
                                  selectedContract.predictedMargin - selectedContract.margin
                                ).toFixed(1)}
                                % improvement
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-white rounded-lg">
                      <div className="text-sm text-gray-600 mb-1">
                        Predicted Emergency Calls (Next 12 Mo)
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold text-orange-600">
                          {selectedContract.predictedEmergencyCalls}
                        </div>
                        {selectedContract.predictedEmergencyCalls >
                          selectedContract.emergencyCalls && (
                          <Badge className="bg-red-100 text-red-700">
                            +
                            {selectedContract.predictedEmergencyCalls -
                              selectedContract.emergencyCalls}{' '}
                            increase expected
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                      <div className="text-sm text-gray-700">
                        <strong>Prediction Confidence: 87%</strong>
                        <p className="mt-1">
                          Based on 18 months of historical data, similar equipment profiles, and
                          current service trends.
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="recommendations" className="space-y-4">
                  <div
                    className={`p-6 rounded-xl border-2 ${
                      selectedContract.risk === 'high'
                        ? 'bg-red-50 border-red-300'
                        : selectedContract.risk === 'medium'
                          ? 'bg-yellow-50 border-yellow-300'
                          : 'bg-green-50 border-green-300'
                    }`}
                  >
                    <div className="flex items-start mb-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                          selectedContract.risk === 'high'
                            ? 'bg-red-600'
                            : selectedContract.risk === 'medium'
                              ? 'bg-yellow-600'
                              : 'bg-green-600'
                        }`}
                      >
                        <Target className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg mb-2">AI Recommendation</h4>
                        <p className="text-gray-900 font-semibold text-lg">
                          {selectedContract.recommendation}
                        </p>
                      </div>
                    </div>

                    {selectedContract.risk !== 'low' && (
                      <div className="space-y-3 mt-6">
                        <h5 className="font-bold text-gray-900">Action Steps:</h5>
                        <div className="space-y-2">
                          <div className="flex items-start">
                            <CheckCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                            <span className="text-gray-700">
                              Schedule renewal conversation 60 days before{' '}
                              {selectedContract.renewalDate}
                            </span>
                          </div>
                          <div className="flex items-start">
                            <CheckCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                            <span className="text-gray-700">
                              Present updated pricing reflecting predicted service costs
                            </span>
                          </div>
                          {selectedContract.risk === 'high' && (
                            <div className="flex items-start">
                              <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                              <span className="text-gray-700 font-semibold">
                                If customer rejects repricing, prepare equipment replacement
                                proposal
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Generate Renewal Proposal
                    </Button>
                    <Button variant="outline" className="flex-1">
                      Schedule Follow-up
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PredictiveContractProfitability;
