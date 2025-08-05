import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCustomerPortal } from '@/pages/CustomerPortal';
import { useLocation } from 'wouter';
import { 
  FileText, 
  Wrench, 
  Package, 
  CreditCard, 
  Bell,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';

interface DashboardSummary {
  activeServiceRequests: number;
  pendingPayments: number;
  recentMeterReadings: number;
  unreadNotifications: number;
  pendingSupplyOrders: number;
}

export const CustomerDashboard: React.FC = () => {
  const { sessionToken } = useCustomerPortal();
  const [, setLocation] = useLocation();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/customer-portal/dashboard', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome to your customer portal</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setLocation('/customer-portal/service-requests')}
        >
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                <Wrench className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Service Requests</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.activeServiceRequests || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setLocation('/customer-portal/meter-readings')}
        >
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Meter Readings (30d)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.recentMeterReadings || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setLocation('/customer-portal/supplies')}
        >
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg">
                <Package className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.pendingSupplyOrders || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setLocation('/customer-portal/payments')}
        >
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.pendingPayments || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setLocation('/customer-portal/notifications')}
        >
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg">
                <Bell className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Notifications</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.unreadNotifications || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you can perform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => setLocation('/customer-portal/service-requests')}
            >
              <Wrench className="h-4 w-4 mr-2" />
              Submit Service Request
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => setLocation('/customer-portal/meter-readings')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Submit Meter Reading
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => setLocation('/customer-portal/supplies')}
            >
              <Package className="h-4 w-4 mr-2" />
              Order Supplies
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => setLocation('/customer-portal/payments')}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Make Payment
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>Your account overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Service Contract</span>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Account Status</span>
              <Badge variant="secondary">Good Standing</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Next Maintenance</span>
              <span className="text-sm font-medium">Jan 15, 2025</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Contract Renewal</span>
              <span className="text-sm font-medium">Dec 2025</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest interactions and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Service Request Completed</p>
                <p className="text-sm text-gray-500">
                  Service request SR-2025-0123 for printer maintenance has been completed
                </p>
                <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Meter Reading Submitted</p>
                <p className="text-sm text-gray-500">
                  Monthly meter reading for Canon C3530i submitted successfully
                </p>
                <p className="text-xs text-gray-400 mt-1">1 day ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full">
                <Package className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Supply Order Delivered</p>
                <p className="text-sm text-gray-500">
                  Order SO-2025-0045 containing toner cartridges has been delivered
                </p>
                <p className="text-xs text-gray-400 mt-1">3 days ago</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full">
                <DollarSign className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Payment Processed</p>
                <p className="text-sm text-gray-500">
                  Payment of $1,245.67 for invoice INV-2025-001 has been processed
                </p>
                <p className="text-xs text-gray-400 mt-1">5 days ago</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setLocation('/customer-portal/notifications')}
              >
                View All Activity
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};