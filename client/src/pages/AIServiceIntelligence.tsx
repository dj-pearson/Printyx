import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Wrench, Zap, Brain, MapPin } from "lucide-react";

// Mock data - in production, this would come from API
const predictions = [
  {
    id: "P-001",
    equipment: "Canon imageRUNNER ADVANCE DX C5870i",
    customer: "Acme Corporation",
    location: "Building A, Floor 3",
    prediction: "Fuser unit failure predicted",
    probability: 87,
    timeframe: "15-20 days",
    severity: "high",
    estimatedCost: 450,
    preventiveCost: 280,
    savings: 170,
    action: "Schedule preventive maintenance",
    partNumber: "FM4-8400-000",
    lastService: "45 days ago",
    meterCount: 847500,
  },
  {
    id: "P-002",
    equipment: "Ricoh IM C6000",
    customer: "TechStart Industries",
    location: "Main Office",
    prediction: "Drum unit replacement needed",
    probability: 92,
    timeframe: "7-10 days",
    severity: "high",
    estimatedCost: 320,
    preventiveCost: 180,
    savings: 140,
    action: "Order parts and schedule service",
    partNumber: "D2426400",
    lastService: "62 days ago",
    meterCount: 456200,
  },
  {
    id: "P-003",
    equipment: "Konica Minolta bizhub C459",
    customer: "Global Logistics LLC",
    location: "Warehouse Office",
    prediction: "Developer unit degradation",
    probability: 73,
    timeframe: "25-30 days",
    severity: "medium",
    estimatedCost: 380,
    preventiveCost: 200,
    savings: 180,
    action: "Monitor and plan replacement",
    partNumber: "A0WG03F",
    lastService: "28 days ago",
    meterCount: 623800,
  },
  {
    id: "P-004",
    equipment: "HP LaserJet Managed E82550",
    customer: "Healthcare Partners",
    location: "Reception Area",
    prediction: "Transfer belt wear detected",
    probability: 68,
    timeframe: "30-35 days",
    severity: "low",
    estimatedCost: 210,
    preventiveCost: 120,
    savings: 90,
    action: "Add to next scheduled visit",
    partNumber: "D7H14A",
    lastService: "15 days ago",
    meterCount: 298400,
  },
];

const serviceMetrics = {
  totalPredictions: 47,
  highPriority: 12,
  scheduledActions: 8,
  potentialSavings: 18750,
  emergencyPrevented: 14,
  avgAccuracy: 84,
};

const AIServiceIntelligence = () => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-red-100 text-red-700 border-red-300";
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "low": return "bg-green-100 text-green-700 border-green-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 85) return "text-red-600";
    if (probability >= 70) return "text-yellow-600";
    return "text-blue-600";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              AI Service Intelligence
            </h1>
            <p className="text-gray-600">
              Predictive maintenance powered by machine learning
            </p>
          </div>
          <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-base px-4 py-2">
            <Brain className="h-4 w-4 mr-2" />
            ML-Powered Predictions
          </Badge>
        </div>

        {/* Metrics Overview */}
        <div className="grid md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Active Predictions</div>
              <div className="text-3xl font-bold text-blue-600">{serviceMetrics.totalPredictions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">High Priority</div>
              <div className="text-3xl font-bold text-red-600">{serviceMetrics.highPriority}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Scheduled</div>
              <div className="text-3xl font-bold text-green-600">{serviceMetrics.scheduledActions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Potential Savings</div>
              <div className="text-2xl font-bold text-green-600">${serviceMetrics.potentialSavings.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Prevented Calls</div>
              <div className="text-3xl font-bold text-purple-600">{serviceMetrics.emergencyPrevented}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Accuracy Rate</div>
              <div className="text-3xl font-bold text-blue-600">{serviceMetrics.avgAccuracy}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Predictions List */}
        <div className="space-y-4">
          {predictions.map((prediction) => (
            <Card key={prediction.id} className={`border-2 ${getSeverityColor(prediction.severity).includes('red') ? 'border-red-300' : getSeverityColor(prediction.severity).includes('yellow') ? 'border-yellow-300' : 'border-green-300'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{prediction.equipment}</CardTitle>
                      <Badge className={`${getSeverityColor(prediction.severity)} border-2`}>
                        {prediction.severity.toUpperCase()} PRIORITY
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center">
                        <strong className="mr-1">{prediction.customer}</strong>
                      </span>
                      <span className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {prediction.location}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Prediction ID</div>
                    <div className="font-mono text-sm font-bold">{prediction.id}</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Prediction Details */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border-2 border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                      <Brain className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-2">{prediction.prediction}</h4>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Probability: </span>
                          <span className={`font-bold ${getProbabilityColor(prediction.probability)}`}>
                            {prediction.probability}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Timeframe: </span>
                          <span className="font-bold text-gray-900">{prediction.timeframe}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Part: </span>
                          <span className="font-mono text-xs font-bold text-gray-900">{prediction.partNumber}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="text-xs text-gray-600">Last Service</div>
                      <div className="font-bold text-gray-900">{prediction.lastService}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="text-xs text-gray-600">Meter Count</div>
                      <div className="font-bold text-gray-900">{prediction.meterCount.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <div>
                      <div className="text-xs text-gray-600">Emergency Cost</div>
                      <div className="font-bold text-red-600">${prediction.estimatedCost}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="text-xs text-gray-600">Preventive Cost</div>
                      <div className="font-bold text-green-600">${prediction.preventiveCost}</div>
                    </div>
                  </div>
                </div>

                {/* Savings Highlight */}
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-300">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Potential Savings</div>
                      <div className="text-2xl font-bold text-green-600">${prediction.savings}</div>
                      <div className="text-xs text-gray-600">
                        {((prediction.savings / prediction.estimatedCost) * 100).toFixed(0)}% cost reduction vs emergency repair
                      </div>
                    </div>
                  </div>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Wrench className="h-4 w-4 mr-2" />
                    {prediction.action}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How It Works */}
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-blue-600" />
              How AI Predictions Work
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">1</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Data Collection</h4>
                <p className="text-sm text-gray-700">
                  Continuously gather service history, meter readings, error codes, and part replacements across your fleet.
                </p>
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">2</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Pattern Recognition</h4>
                <p className="text-sm text-gray-700">
                  ML algorithms identify failure patterns across thousands of similar devices, finding signals humans miss.
                </p>
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">3</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Predictive Scoring</h4>
                <p className="text-sm text-gray-700">
                  Each device receives a failure probability score with specific timeframe and component predictions.
                </p>
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center mb-3">
                  <span className="text-white font-bold text-xl">4</span>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">Automated Actions</h4>
                <p className="text-sm text-gray-700">
                  System creates service requests, orders parts, and schedules maintenance automatically before failures occur.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIServiceIntelligence;
