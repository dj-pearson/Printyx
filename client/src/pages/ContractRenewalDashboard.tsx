import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/**
 * Contract Renewal Autopilot Dashboard
 *
 * AI-powered contract renewal automation and churn prevention
 * Proactively manages renewals and reduces customer churn
 */

export default function ContractRenewalDashboard() {
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/contract-renewal/dashboard'],
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  // Fetch contracts at risk
  const { data: atRiskContracts, isLoading: atRiskLoading } = useQuery({
    queryKey: ['/api/contract-renewal/at-risk'],
  });

  // Fetch expiring contracts
  const { data: expiringContracts, isLoading: expiringLoading } = useQuery({
    queryKey: ['/api/contract-renewal/expiring', { days: 90 }],
  });

  // Fetch proposals
  const { data: proposals, isLoading: proposalsLoading } = useQuery({
    queryKey: ['/api/contract-renewal/proposals'],
  });

  // Analyze all contracts mutation
  const analyzeAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/contract-renewal/analyze-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Analysis failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Analysis Complete',
        description: `Analyzed ${data.analyzed} contracts. Created ${data.proposalsCreated} renewal proposals.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contract-renewal/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contract-renewal/at-risk'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contract-renewal/expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contract-renewal/proposals'] });
      setIsAnalyzing(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsAnalyzing(false);
    },
  });

  const handleAnalyzeAll = () => {
    setIsAnalyzing(true);
    analyzeAllMutation.mutate();
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'very_high':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRenewalProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contract Renewal Autopilot</h1>
          <p className="text-muted-foreground">
            AI-powered renewal automation and churn prevention
          </p>
        </div>
        <Button onClick={handleAnalyzeAll} disabled={isAnalyzing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Analyze All Contracts'}
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contracts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeContracts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.expiringSoon || 0} expiring within 90 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics?.atRisk || 0}</div>
            <p className="text-xs text-muted-foreground">
              ${metrics?.mrrAtRisk?.toFixed(2) || '0.00'} MRR at risk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Renewal Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics?.renewalRate?.toFixed(1) || '0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              ${metrics?.mrrRetained?.toFixed(2) || '0.00'} MRR retained
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Renewal Success</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.autoRenewalSuccessRate?.toFixed(1) || '0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.proposalsOutstanding || 0} proposals outstanding
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="at-risk" className="space-y-4">
        <TabsList>
          <TabsTrigger value="at-risk">At Risk</TabsTrigger>
          <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
        </TabsList>

        {/* At Risk Tab */}
        <TabsContent value="at-risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contracts At Risk</CardTitle>
              <CardDescription>
                Contracts with high churn probability requiring immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {atRiskLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : !atRiskContracts || atRiskContracts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <p>No contracts at high risk</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contract Type</TableHead>
                      <TableHead>MRR</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>Renewal Probability</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Recommended Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {atRiskContracts.map((contract: any) => (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{contract.customerName}</div>
                            <div className="text-sm text-muted-foreground">
                              {contract.contractNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{contract.contractType}</TableCell>
                        <TableCell>
                          $
                          {contract.monthlyRecurringRevenue
                            ? parseFloat(contract.monthlyRecurringRevenue).toFixed(2)
                            : '0.00'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{new Date(contract.endDate).toLocaleDateString()}</div>
                            <div className="text-sm text-muted-foreground">
                              {contract.daysUntilExpiration} days
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div
                              className={`font-bold ${getRenewalProbabilityColor(
                                contract.renewalProbability || 0,
                              )}`}
                            >
                              {contract.renewalProbability || 0}%
                            </div>
                            <Progress value={contract.renewalProbability || 0} className="w-20" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRiskColor(contract.renewalRisk)}>
                            {contract.renewalRisk}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contract.recommendedAction}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expiring Soon Tab */}
        <TabsContent value="expiring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expiring Contracts</CardTitle>
              <CardDescription>Contracts expiring within the next 90 days</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : !expiringContracts || expiringContracts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No contracts expiring soon
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contract Type</TableHead>
                      <TableHead>Current ACV</TableHead>
                      <TableHead>Days Until Expiration</TableHead>
                      <TableHead>Renewal Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringContracts.map((contract: any) => (
                      <TableRow key={contract.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{contract.customerName}</div>
                            <div className="text-sm text-muted-foreground">
                              {contract.contractNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{contract.contractType}</TableCell>
                        <TableCell>
                          $
                          {contract.annualContractValue
                            ? parseFloat(contract.annualContractValue).toFixed(2)
                            : '0.00'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={contract.daysUntilExpiration < 30 ? 'destructive' : 'outline'}
                          >
                            {contract.daysUntilExpiration} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contract.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Renewal Proposals</CardTitle>
              <CardDescription>
                AI-generated renewal proposals with optimized pricing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {proposalsLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : !proposals || proposals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No proposals generated yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proposal #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Current ACV</TableHead>
                      <TableHead>Proposed ACV</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposals.map((proposal: any) => (
                      <TableRow key={proposal.id}>
                        <TableCell className="font-mono text-sm">
                          {proposal.proposalNumber}
                        </TableCell>
                        <TableCell>{proposal.customerName}</TableCell>
                        <TableCell>
                          $
                          {proposal.currentAcv
                            ? parseFloat(proposal.currentAcv).toFixed(2)
                            : '0.00'}
                        </TableCell>
                        <TableCell>
                          $
                          {proposal.proposedAcv
                            ? parseFloat(proposal.proposedAcv).toFixed(2)
                            : '0.00'}
                        </TableCell>
                        <TableCell>
                          {proposal.discountPercentage
                            ? `${parseFloat(proposal.discountPercentage).toFixed(1)}%`
                            : 'None'}
                        </TableCell>
                        <TableCell>
                          {new Date(proposal.proposalDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{proposal.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
