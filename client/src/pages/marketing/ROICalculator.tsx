import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, TrendingUp, DollarSign, CheckCircle, ArrowRight } from "lucide-react";

const ROICalculator = () => {
  const [technicians, setTechnicians] = useState(15);
  const [emergencyCalls, setEmergencyCalls] = useState(180);
  const [avgServiceCost, setAvgServiceCost] = useState(150);
  const [contracts, setContracts] = useState(500);
  const [avgContractValue, setAvgContractValue] = useState(2400);

  // Calculations
  const emergencyReduction = emergencyCalls * 12 * 0.35; // 35% reduction annually
  const emergencySavings = emergencyReduction * avgServiceCost;

  const serviceCostReduction = technicians * 12000 * 0.20; // 20% efficiency gain per tech

  const contractProfitabilityGain = contracts * avgContractValue * 0.18; // 18% margin improvement

  const totalAnnualSavings = emergencySavings + serviceCostReduction + contractProfitabilityGain;

  const implementation = 15000; // One-time
  const annualCost = technicians * 1200; // $100/user/month

  const firstYearROI = totalAnnualSavings - implementation - annualCost;
  const roi = ((firstYearROI / (implementation + annualCost)) * 100);
  const paybackMonths = ((implementation + annualCost) / (totalAnnualSavings / 12));

  return (
    <>
      {/* Schema.org WebPage Markup */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "ROI Calculator - Calculate Your Printyx Savings",
          "description": "Calculate your potential savings with Printyx. See how predictive intelligence, modern architecture, and AI-powered features impact your bottom line.",
          "url": "https://printyx.com/roi-calculator"
        })}
      </script>

      <div className="min-h-screen bg-white">
        {/* Header */}
        <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  onClick={() => window.location.href = '/'}
                  className="hover:bg-gray-100"
                >
                  <Printer className="h-6 w-6 text-blue-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">Printyx</span>
                </Button>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/login'}
                >
                  Login
                </Button>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                  onClick={() => window.location.href = '/signup'}
                >
                  Start Free Trial
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Badge className="mb-4 bg-white/20 text-white border-white/30 text-base px-4 py-2 backdrop-blur-sm">
                Interactive ROI Calculator
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Calculate Your Printyx Savings
              </h1>
              <p className="text-xl text-blue-100 max-w-3xl mx-auto">
                See exactly how much your dealership could save with predictive intelligence, modern architecture, and AI-powered automation.
              </p>
            </div>
          </div>
        </section>

        {/* Calculator Section */}
        <section className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Input Panel */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Your Dealership Details</CardTitle>
                  <CardDescription>Enter your current operational metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="technicians" className="text-base font-semibold">
                      Number of Service Technicians
                    </Label>
                    <Input
                      id="technicians"
                      type="number"
                      value={technicians}
                      onChange={(e) => setTechnicians(Number(e.target.value))}
                      className="mt-2 text-lg"
                      min="1"
                    />
                    <p className="text-sm text-gray-600 mt-1">Full-time field service technicians</p>
                  </div>

                  <div>
                    <Label htmlFor="emergencyCalls" className="text-base font-semibold">
                      Emergency Service Calls Per Month
                    </Label>
                    <Input
                      id="emergencyCalls"
                      type="number"
                      value={emergencyCalls}
                      onChange={(e) => setEmergencyCalls(Number(e.target.value))}
                      className="mt-2 text-lg"
                      min="0"
                    />
                    <p className="text-sm text-gray-600 mt-1">Unplanned service calls requiring immediate response</p>
                  </div>

                  <div>
                    <Label htmlFor="avgServiceCost" className="text-base font-semibold">
                      Average Emergency Call Cost ($)
                    </Label>
                    <Input
                      id="avgServiceCost"
                      type="number"
                      value={avgServiceCost}
                      onChange={(e) => setAvgServiceCost(Number(e.target.value))}
                      className="mt-2 text-lg"
                      min="0"
                    />
                    <p className="text-sm text-gray-600 mt-1">Labor, parts, and overhead per emergency call</p>
                  </div>

                  <div>
                    <Label htmlFor="contracts" className="text-base font-semibold">
                      Number of Service Contracts
                    </Label>
                    <Input
                      id="contracts"
                      type="number"
                      value={contracts}
                      onChange={(e) => setContracts(Number(e.target.value))}
                      className="mt-2 text-lg"
                      min="0"
                    />
                    <p className="text-sm text-gray-600 mt-1">Active managed service contracts</p>
                  </div>

                  <div>
                    <Label htmlFor="avgContractValue" className="text-base font-semibold">
                      Average Annual Contract Value ($)
                    </Label>
                    <Input
                      id="avgContractValue"
                      type="number"
                      value={avgContractValue}
                      onChange={(e) => setAvgContractValue(Number(e.target.value))}
                      className="mt-2 text-lg"
                      min="0"
                    />
                    <p className="text-sm text-gray-600 mt-1">Average yearly revenue per contract</p>
                  </div>
                </CardContent>
              </Card>

              {/* Results Panel */}
              <div className="space-y-6">
                <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-blue-50">
                  <CardHeader>
                    <CardTitle className="text-2xl text-gray-900">Your Projected Savings</CardTitle>
                    <CardDescription>Annual impact with Printyx platform</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center p-6 bg-white rounded-xl border-2 border-green-400">
                      <div className="text-sm text-gray-600 mb-2">Total Annual Savings</div>
                      <div className="text-5xl font-bold text-green-600 mb-2">
                        ${totalAnnualSavings.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Year 1 and beyond</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-3xl font-bold text-blue-600">{roi.toFixed(0)}%</div>
                        <div className="text-sm text-gray-600 mt-1">First Year ROI</div>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border">
                        <div className="text-3xl font-bold text-purple-600">{paybackMonths.toFixed(1)}</div>
                        <div className="text-sm text-gray-600 mt-1">Months to Payback</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center">
                          <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                          <span className="text-sm font-medium">Emergency Call Reduction</span>
                        </div>
                        <span className="font-bold text-green-600">${emergencySavings.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center">
                          <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                          <span className="text-sm font-medium">Service Efficiency Gains</span>
                        </div>
                        <span className="font-bold text-blue-600">${serviceCostReduction.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center">
                          <DollarSign className="h-5 w-5 text-purple-600 mr-2" />
                          <span className="text-sm font-medium">Contract Profitability</span>
                        </div>
                        <span className="font-bold text-purple-600">${contractProfitabilityGain.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-xl">Investment Required</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Implementation (one-time)</span>
                      <span className="font-bold">${implementation.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Annual Platform Cost</span>
                      <span className="font-bold">${annualCost.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="font-bold text-gray-900">First Year Net Benefit</span>
                      <span className="font-bold text-green-600 text-xl">${firstYearROI.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Assumptions Section */}
        <section className="py-12 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              How We Calculate Your Savings
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Predictive Maintenance</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700">
                  <p className="mb-3">35% reduction in emergency service calls through AI-powered failure prediction.</p>
                  <ul className="space-y-1">
                    <li>• Proactive part replacement</li>
                    <li>• Optimized scheduling</li>
                    <li>• Reduced emergency costs</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Service Efficiency</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700">
                  <p className="mb-3">20% improvement in technician productivity with mobile-first tools.</p>
                  <ul className="space-y-1">
                    <li>• Optimized routing</li>
                    <li>• Offline capability</li>
                    <li>• Better first-time fix</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contract Profitability</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700">
                  <p className="mb-3">18% margin improvement through AI-powered dynamic pricing.</p>
                  <ul className="space-y-1">
                    <li>• Optimal price points</li>
                    <li>• Underpriced detection</li>
                    <li>• Renewal optimization</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
              <h3 className="font-bold text-gray-900 mb-3">Conservative Estimates</h3>
              <p className="text-gray-700 text-sm">
                These calculations use conservative industry benchmarks based on actual dealer results.
                Many dealers see 40-50% emergency call reductions and 25%+ profitability gains. Your actual
                results may vary based on current operational efficiency and implementation timeline.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to Realize These Savings?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Start your free 14-day trial and see these results in your own dealership.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-10 py-7"
                onClick={() => window.location.href = '/signup'}
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-10 py-7 border-2 border-white text-white hover:bg-white hover:text-blue-600"
                onClick={() => window.location.href = '/login'}
              >
                Schedule Demo
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <Printer className="h-8 w-8 text-blue-400" />
                <span className="ml-2 text-xl font-bold">Printyx</span>
              </div>
              <div className="text-center md:text-right">
                <p className="text-gray-400">© 2025 Printyx. All rights reserved.</p>
                <p className="text-sm text-gray-500 mt-1">
                  ROI Calculator • Predictive Intelligence • Modern Architecture
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default ROICalculator;
