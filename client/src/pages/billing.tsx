import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, FileText, Calculator, TrendingUp } from "lucide-react";

export default function Billing() {
  return (
    <MainLayout 
      title="Billing" 
      description="Manage meter billing, invoices, and payments"
    >
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">$127,540</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Invoices</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">24</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overdue Amount</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">$8,420</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <Calculator className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Growth Rate</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">+12.5%</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <FileText className="h-4 w-4 mr-3" />
                    Generate Invoices
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Calculator className="h-4 w-4 mr-3" />
                    Process Meter Billing
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <DollarSign className="h-4 w-4 mr-3" />
                    Record Payment
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <TrendingUp className="h-4 w-4 mr-3" />
                    Billing Reports
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Payment received from TechCorp Inc.</p>
                      <p className="text-xs text-gray-600">$2,450.00 • 2 hours ago</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Invoice INV-2024-001 generated</p>
                      <p className="text-xs text-gray-600">MedCenter LLC • 4 hours ago</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <Calculator className="h-4 w-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Meter billing processed</p>
                      <p className="text-xs text-gray-600">42 devices • Yesterday</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing Management</h3>
                <p className="text-gray-600 mb-6">Automated meter billing and invoice generation coming soon.</p>
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
