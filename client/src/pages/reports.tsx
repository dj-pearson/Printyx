import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, PieChart, TrendingUp, FileText, Download } from "lucide-react";

export default function Reports() {
  return (
    <MainLayout 
      title="Reports" 
      description="Analytics and insights for your business"
    >
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Revenue Reports</p>
                    <p className="text-xs text-gray-500 mt-1">Monthly & quarterly analysis</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Contract Analysis</p>
                    <p className="text-xs text-gray-500 mt-1">Profitability & renewals</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <PieChart className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Service Performance</p>
                    <p className="text-xs text-gray-500 mt-1">Response times & efficiency</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Custom Reports</p>
                    <p className="text-xs text-gray-500 mt-1">Build your own</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Quick Reports</h3>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export All
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Monthly P&L</p>
                      <p className="text-sm text-gray-600">Profit and loss statement</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Customer Summary</p>
                      <p className="text-sm text-gray-600">Contract values and status</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Service Report</p>
                      <p className="text-sm text-gray-600">Technician productivity</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Inventory Report</p>
                      <p className="text-sm text-gray-600">Stock levels and usage</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Schedule</h3>
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-green-900">Monthly Revenue Report</p>
                      <span className="text-xs text-green-700 bg-green-200 px-2 py-1 rounded">Active</span>
                    </div>
                    <p className="text-sm text-green-700">Next run: 1st of every month</p>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-blue-900">Weekly Service Summary</p>
                      <span className="text-xs text-blue-700 bg-blue-200 px-2 py-1 rounded">Active</span>
                    </div>
                    <p className="text-sm text-blue-700">Next run: Every Monday at 9 AM</p>
                  </div>

                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-orange-900">Inventory Alert Report</p>
                      <span className="text-xs text-orange-700 bg-orange-200 px-2 py-1 rounded">Active</span>
                    </div>
                    <p className="text-sm text-orange-700">Next run: Daily at 8 AM</p>
                  </div>
                </div>
                
                <Button className="w-full mt-4" variant="outline">
                  Manage Schedules
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Analytics</h3>
                <p className="text-gray-600 mb-6">Detailed reporting and analytics features coming soon.</p>
                <Button>
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
    </MainLayout>
  );
}
