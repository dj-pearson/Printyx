import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, FileText } from "lucide-react";

export default function Contracts() {
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['/api/contracts'],
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'expired': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  if (contractsLoading) {
    return (
      <MainLayout 
        title="Contracts" 
        description="Manage service contracts and billing agreements"
      >
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Contracts" 
      description="Manage service contracts and billing agreements"
    >
      <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search contracts..."
                className="pl-10"
              />
            </div>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Contract
            </Button>
          </div>

          {contractsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : contracts && Array.isArray(contracts) && contracts.length > 0 ? (
            <div className="space-y-4">
              {Array.isArray(contracts) && contracts.map((contract: any) => (
                <Card key={contract.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{contract.contractNumber}</h3>
                          <p className="text-sm text-gray-600 mt-1">Customer ID: {contract.customerId}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>Start: {new Date(contract.startDate).toLocaleDateString()}</span>
                            <span>End: {new Date(contract.endDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={getStatusVariant(contract.status)} className="capitalize">
                        {contract.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Base</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${contract.monthlyBase ? Number(contract.monthlyBase).toFixed(2) : '0.00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Black Rate</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${contract.blackRate ? Number(contract.blackRate).toFixed(4) : '0.0000'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Color Rate</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${contract.colorRate ? Number(contract.colorRate).toFixed(4) : '0.0000'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        Edit Contract
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No contracts found</h3>
                  <p className="text-gray-600 mb-6">Create your first service contract to get started.</p>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    New Contract
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
    </MainLayout>
  );
}
