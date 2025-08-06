import { useState, useEffect } from "react";
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Search, Filter, Download, Upload, Target, TrendingUp, Users, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EnrichedContact {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string;
  job_title?: string;
  company_name?: string;
  management_level?: string;
  department?: string;
  prospecting_status: string;
  lead_score?: number;
  enrichment_source: string;
  last_enriched_date?: string;
}

interface EnrichedCompany {
  id: string;
  company_name: string;
  primary_industry?: string;
  employee_count?: number;
  annual_revenue?: number;
  website?: string;
  target_account_tier?: string;
  enrichment_source: string;
  last_enriched_date?: string;
}

interface ProspectingCampaign {
  id: string;
  campaign_name: string;
  campaign_type: string;
  status: string;
  total_contacts: number;
  response_rate?: number;
  start_date?: string;
}

export default function DataEnrichment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [activeTab, setActiveTab] = useState("contacts");

  // Fetch enriched contacts
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ["/api/enrichment/contacts", { 
      query: searchQuery, 
      prospectingStatus: filterStatus ? [filterStatus] : undefined,
      enrichmentSource: filterSource ? [filterSource] : undefined,
      page: 1,
      limit: 25
    }],
    enabled: activeTab === "contacts"
  });

  // Fetch enriched companies
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/enrichment/companies", { 
      query: searchQuery,
      page: 1,
      limit: 25
    }],
    enabled: activeTab === "companies"
  });

  // Fetch prospecting campaigns
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/enrichment/campaigns"],
    enabled: activeTab === "campaigns"
  });

  // Fetch analytics
  const { data: analyticsData } = useQuery({
    queryKey: ["/api/enrichment/analytics"],
    enabled: activeTab === "analytics"
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const response = await fetch("/api/enrichment/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(campaignData),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaign Created",
        description: "Your prospecting campaign has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/enrichment/campaigns"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  const contacts: EnrichedContact[] = contactsData?.contacts || [];
  const companies: EnrichedCompany[] = companiesData?.companies || [];
  const campaigns: ProspectingCampaign[] = campaignsData || [];

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      qualified: "bg-green-100 text-green-800",
      opportunity: "bg-purple-100 text-purple-800",
      closed: "bg-gray-100 text-gray-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getSourceIcon = (source: string) => {
    return source === "zoominfo" ? "🔍" : source === "apollo" ? "🚀" : "📝";
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Enrichment</h1>
          <p className="text-muted-foreground mt-1">
            Unified prospecting with ZoomInfo and Apollo.io integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import Data
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      {analyticsData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analyticsData?.contacts?.bySource?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all sources
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analyticsData?.companies?.byIndustry?.reduce((sum: number, item: any) => sum + item.count, 0) || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Enriched companies
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analyticsData?.contacts?.byStatus?.find((item: any) => item.status === 'qualified')?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Ready for outreach
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {campaigns?.filter((c: ProspectingCampaign) => c.status === 'active')?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently running
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts, companies, or campaigns..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="opportunity">Opportunity</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zoominfo">ZoomInfo</SelectItem>
                  <SelectItem value="apollo">Apollo.io</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enriched Contacts</CardTitle>
              <CardDescription>
                Contacts from ZoomInfo and Apollo.io with comprehensive prospecting data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading contacts...</div>
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-4">No contacts found</div>
                  <Button>Import Your First Contacts</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {contacts.map((contact: EnrichedContact) => (
                    <div key={contact.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {contact.first_name?.[0]}{contact.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {contact.job_title} at {contact.company_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {contact.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(contact.prospecting_status)}>
                          {contact.prospecting_status}
                        </Badge>
                        <span className="text-lg">
                          {getSourceIcon(contact.enrichment_source)}
                        </span>
                        {contact.lead_score && (
                          <Badge variant="outline">
                            Score: {contact.lead_score}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enriched Companies</CardTitle>
              <CardDescription>
                Company profiles with industry, size, and technology data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {companiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading companies...</div>
                </div>
              ) : companies.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-4">No companies found</div>
                  <Button>Import Company Data</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {companies.map((company: EnrichedCompany) => (
                    <div key={company.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Building className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium">{company.company_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {company.primary_industry}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {company.employee_count && `${company.employee_count} employees`}
                            {company.annual_revenue && ` • $${(company.annual_revenue / 1000000).toFixed(1)}M revenue`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {company.target_account_tier && (
                          <Badge variant="outline">
                            {company.target_account_tier}
                          </Badge>
                        )}
                        <span className="text-lg">
                          {getSourceIcon(company.enrichment_source)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prospecting Campaigns</CardTitle>
              <CardDescription>
                Organize and track your outreach efforts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading campaigns...</div>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-4">No campaigns found</div>
                  <Button onClick={() => {
                    createCampaignMutation.mutate({
                      campaign_name: "Sample Campaign",
                      campaign_type: "email_sequence",
                      campaign_description: "Sample prospecting campaign"
                    });
                  }}>
                    Create Your First Campaign
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map((campaign: ProspectingCampaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{campaign.campaign_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {campaign.campaign_type} • {campaign.total_contacts} contacts
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                        {campaign.response_rate && (
                          <Badge variant="outline">
                            {(campaign.response_rate * 100).toFixed(1)}% response
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contacts by Source</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData?.contacts?.bySource?.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-2">
                      <span>{getSourceIcon(item.source)}</span>
                      <span className="capitalize">{item.source}</span>
                    </div>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                )) || <div className="text-muted-foreground text-sm">No data available</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prospecting Status</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData?.contacts?.byStatus?.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <span className="capitalize">{item.status}</span>
                    <Badge className={getStatusColor(item.status)}>{item.count}</Badge>
                  </div>
                )) || <div className="text-muted-foreground text-sm">No data available</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Management Levels</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData?.contacts?.byLevel?.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <span>{item.level || 'Unknown'}</span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                )) || <div className="text-muted-foreground text-sm">No data available</div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Industries</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData?.companies?.byIndustry?.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <span>{item.industry || 'Unknown'}</span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                )) || <div className="text-muted-foreground text-sm">No data available</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </MainLayout>
  );
}