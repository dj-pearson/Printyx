import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-print text-white text-2xl"></i>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Printyx</h1>
            <p className="text-gray-600 mb-8">
              The unified copier dealer management platform that consolidates your CRM, billing, service dispatch, and inventory management.
            </p>
            
            <div className="space-y-4">
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="w-full"
                size="lg"
              >
                Sign In to Get Started
              </Button>
              
              <div className="text-sm text-gray-500">
                Replace fragmented legacy systems with one modern solution
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-gray-900">80%</div>
                  <div className="text-gray-600">Reduction in manual billing</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-900">25%</div>
                  <div className="text-gray-600">Improvement in productivity</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
