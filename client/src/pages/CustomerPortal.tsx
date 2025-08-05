import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  FileText, 
  Wrench, 
  Package, 
  CreditCard, 
  History,
  Settings,
  LogOut,
  User,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { CustomerPortalLogin } from '@/components/customer-portal/CustomerPortalLogin';
import { CustomerDashboard } from '@/components/customer-portal/CustomerDashboard';
import { ServiceRequestForm } from '@/components/customer-portal/ServiceRequestForm';
import { ServiceRequestList } from '@/components/customer-portal/ServiceRequestList';
import { MeterReadingForm } from '@/components/customer-portal/MeterReadingForm';
import { MeterReadingHistory } from '@/components/customer-portal/MeterReadingHistory';
import { SupplyOrderForm } from '@/components/customer-portal/SupplyOrderForm';
import { SupplyOrderList } from '@/components/customer-portal/SupplyOrderList';
import { PaymentForm } from '@/components/customer-portal/PaymentForm';
import { PaymentHistory } from '@/components/customer-portal/PaymentHistory';
import { NotificationCenter } from '@/components/customer-portal/NotificationCenter';
import { CustomerSettings } from '@/components/customer-portal/CustomerSettings';

interface CustomerUser {
  id: string;
  username: string;
  email: string;
  permissions: Record<string, boolean>;
  preferences: Record<string, any>;
}

interface CustomerPortalContextType {
  user: CustomerUser | null;
  sessionToken: string | null;
  login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const CustomerPortalContext = React.createContext<CustomerPortalContextType | null>(null);

export const useCustomerPortal = () => {
  const context = React.useContext(CustomerPortalContext);
  if (!context) {
    throw new Error('useCustomerPortal must be used within CustomerPortalProvider');
  }
  return context;
};

const CustomerPortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    const storedToken = localStorage.getItem('customerSessionToken');
    const storedUser = localStorage.getItem('customerUser');
    
    if (storedToken && storedUser) {
      try {
        setSessionToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('customerSessionToken');
        localStorage.removeItem('customerUser');
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    try {
      const response = await fetch('/api/customer-portal/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.customer);
        setSessionToken(data.sessionToken);
        localStorage.setItem('customerSessionToken', data.sessionToken);
        localStorage.setItem('customerUser', JSON.stringify(data.customer));
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      if (sessionToken) {
        await fetch('/api/customer-portal/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setSessionToken(null);
      localStorage.removeItem('customerSessionToken');
      localStorage.removeItem('customerUser');
    }
  };

  return (
    <CustomerPortalContext.Provider value={{ user, sessionToken, login, logout, isLoading }}>
      {children}
    </CustomerPortalContext.Provider>
  );
};

const CustomerPortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useCustomerPortal();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch notifications on mount
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { sessionToken } = useCustomerPortal();
      const response = await fetch('/api/customer-portal/notifications?unreadOnly=true', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.notifications?.length || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/customer-portal');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Customer Portal</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="relative"
                onClick={() => navigate('/customer-portal/notifications')}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
              
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user?.username}</span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/customer-portal/settings')}
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <Button
              variant="ghost"
              className="flex items-center space-x-2 py-4 px-0 border-b-2 border-transparent hover:border-blue-500"
              onClick={() => navigate('/customer-portal/dashboard')}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>
            
            <Button
              variant="ghost"
              className="flex items-center space-x-2 py-4 px-0"
              onClick={() => navigate('/customer-portal/service-requests')}
            >
              <Wrench className="h-4 w-4" />
              <span>Service Requests</span>
            </Button>
            
            <Button
              variant="ghost"
              className="flex items-center space-x-2 py-4 px-0"
              onClick={() => navigate('/customer-portal/meter-readings')}
            >
              <FileText className="h-4 w-4" />
              <span>Meter Readings</span>
            </Button>
            
            <Button
              variant="ghost"
              className="flex items-center space-x-2 py-4 px-0"
              onClick={() => navigate('/customer-portal/supplies')}
            >
              <Package className="h-4 w-4" />
              <span>Supplies</span>
            </Button>
            
            <Button
              variant="ghost"
              className="flex items-center space-x-2 py-4 px-0"
              onClick={() => navigate('/customer-portal/payments')}
            >
              <CreditCard className="h-4 w-4" />
              <span>Payments</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export const CustomerPortal: React.FC = () => {
  return (
    <CustomerPortalProvider>
      <CustomerPortalRoutes />
    </CustomerPortalProvider>
  );
};

const CustomerPortalRoutes: React.FC = () => {
  const { user, isLoading } = useCustomerPortal();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <CustomerPortalLogin />;
  }

  return (
    <CustomerPortalLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/customer-portal/dashboard" replace />} />
        <Route path="/dashboard" element={<CustomerDashboard />} />
        <Route path="/service-requests" element={
          <Tabs defaultValue="list" className="w-full">
            <TabsList>
              <TabsTrigger value="list">My Requests</TabsTrigger>
              <TabsTrigger value="new">New Request</TabsTrigger>
            </TabsList>
            <TabsContent value="list">
              <ServiceRequestList />
            </TabsContent>
            <TabsContent value="new">
              <ServiceRequestForm />
            </TabsContent>
          </Tabs>
        } />
        <Route path="/meter-readings" element={
          <Tabs defaultValue="submit" className="w-full">
            <TabsList>
              <TabsTrigger value="submit">Submit Reading</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="submit">
              <MeterReadingForm />
            </TabsContent>
            <TabsContent value="history">
              <MeterReadingHistory />
            </TabsContent>
          </Tabs>
        } />
        <Route path="/supplies" element={
          <Tabs defaultValue="order" className="w-full">
            <TabsList>
              <TabsTrigger value="order">Place Order</TabsTrigger>
              <TabsTrigger value="orders">My Orders</TabsTrigger>
            </TabsList>
            <TabsContent value="order">
              <SupplyOrderForm />
            </TabsContent>
            <TabsContent value="orders">
              <SupplyOrderList />
            </TabsContent>
          </Tabs>
        } />
        <Route path="/payments" element={
          <Tabs defaultValue="pay" className="w-full">
            <TabsList>
              <TabsTrigger value="pay">Make Payment</TabsTrigger>
              <TabsTrigger value="history">Payment History</TabsTrigger>
            </TabsList>
            <TabsContent value="pay">
              <PaymentForm />
            </TabsContent>
            <TabsContent value="history">
              <PaymentHistory />
            </TabsContent>
          </Tabs>
        } />
        <Route path="/notifications" element={<NotificationCenter />} />
        <Route path="/settings" element={<CustomerSettings />} />
      </Routes>
    </CustomerPortalLayout>
  );
};