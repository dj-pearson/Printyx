import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Welcome to Printyx
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Unified Copier Dealer Management Platform
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Sign in with your Replit account to access your copier dealer management dashboard
              </p>
              <Button onClick={handleLogin} className="w-full" size="lg">
                Sign in with Replit
              </Button>
            </div>
            
            <div className="border-t pt-6">
              <div className="text-xs text-gray-500 space-y-2">
                <div className="flex justify-between">
                  <span>✓ Customer Management</span>
                  <span>✓ Service Dispatch</span>
                </div>
                <div className="flex justify-between">
                  <span>✓ Contract Tracking</span>
                  <span>✓ Inventory Control</span>
                </div>
                <div className="flex justify-between">
                  <span>✓ Billing Integration</span>
                  <span>✓ Analytics Dashboard</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}