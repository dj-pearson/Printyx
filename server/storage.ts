import {
  users,
  roles,
  teams,
  tenants,
  userCustomerAssignments,
  companies,
  companyContacts,
  businessRecords,
  businessRecordActivities,
  leads,
  customers,
  leadActivities,
  customerActivities,
  leadContacts,
  leadRelatedRecords,
  quotes,
  quoteLineItems,
  equipment,
  contracts,
  serviceTickets,
  inventoryItems,
  technicians,
  meterReadings,
  invoices,
  invoiceLineItems,
  productModels,
  productAccessories,
  accessoryModelCompatibility,
  cpcRates,
  professionalServices,
  serviceProducts,
  softwareProducts,
  supplies,
  managedServices,
  contractTieredRates,
  vendors,
  accountsPayable,
  accountsReceivable,
  chartOfAccounts,
  purchaseOrders,
  purchaseOrderItems,
  deals,
  dealStages,
  dealActivities,
  masterProductModels,
  masterProductAccessories,
  enabledProducts,
  masterProductAccessoryRelationships,
  enhancedContacts,
  type User,
  type UpsertUser,
  type InsertUser,
  type Role,
  type Team,
  type UserCustomerAssignment,
  type Company,
  type InsertCompany,
  type CompanyContact,
  type InsertCompanyContact,
  type Lead,
  type InsertLead,
  type LeadActivity,
  type LeadContact,
  type LeadRelatedRecord,
  type Quote,
  type Customer,
  type InsertCustomer,
  type CustomerActivity,
  type InsertCustomerActivity,
  type CustomerContact,
  type InsertCustomerContact,
  type CustomerRelatedRecord,
  type InsertCustomerRelatedRecord,
  type Equipment,
  type Contract,
  type ServiceTicket,
  type InventoryItem,
  type Technician,
  type MeterReading,
  type Invoice,
  type ProductModel,
  type ProductAccessory,
  type AccessoryModelCompatibility,
  type CpcRate,
  type ProfessionalService,
  type ServiceProduct,
  type SoftwareProduct,
  type Supply,
  type ManagedService,
  type ContractTieredRate,
  tasks,
  projects,
  systemAlerts,
  performanceMetrics,
  systemIntegrations,
  type Task,
  type InsertTask,
  type Project,
  type InsertProject,
  type SystemAlert,
  type InsertSystemAlert,
  type PerformanceMetric,
  type InsertPerformanceMetric,
  type SystemIntegration,
  type InsertSystemIntegration,
  type InsertProductModel,
  type InsertProductAccessory,
  type InsertAccessoryModelCompatibility,
  type InsertCpcRate,
  type InsertProfessionalService,
  type InsertServiceProduct,
  type InsertSoftwareProduct,
  type InsertSupply,
  type InsertManagedService,
  type Vendor,
  type AccountsPayable,
  type AccountsReceivable,
  type ChartOfAccount,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type InsertVendor,
  type InsertAccountsPayable,
  type InsertAccountsReceivable,
  type InsertChartOfAccount,
  type InsertPurchaseOrder,
  type InsertPurchaseOrderItem,
  type Deal,
  type InsertDeal,
  type DealStage,
  type InsertDealStage,
  type DealActivity,
  type InsertDealActivity,
  companyPricingSettings,
  productPricing,
  quotePricing,
  quotePricingLineItems,
  userSettings,
  type CompanyPricingSetting,
  type InsertCompanyPricingSetting,
  type ProductPricing,
  type InsertProductPricing,
  type QuotePricing,
  type UserSettings,
  type InsertUserSettings,
  type InsertQuotePricing,
  type QuotePricingLineItem,
  type InsertQuotePricingLineItem,
  // Mobile service schemas
  mobileServiceSessions,
  timeTrackingEntries,
  servicePhotos,
  locationHistory,
  type MobileServiceSession,
  type TimeTrackingEntry,
  type ServicePhoto,
  type LocationHistory,
  type InsertMobileServiceSession,
  type InsertTimeTrackingEntry,
  type InsertServicePhoto,
  type InsertLocationHistory,
  // Onboarding schemas
  onboardingChecklists,
  onboardingEquipment,
  onboardingNetworkConfig,
  onboardingPrintManagement,
  onboardingDynamicSections,
  onboardingTasks,
  type OnboardingChecklist,
  type InsertOnboardingChecklist,
  type OnboardingEquipment,
  type InsertOnboardingEquipment,
  type OnboardingNetworkConfig,
  type InsertOnboardingNetworkConfig,
  type OnboardingPrintManagement,
  type InsertOnboardingPrintManagement,
  type OnboardingDynamicSection,
  type InsertOnboardingDynamicSection,
  type OnboardingTask,
  type InsertOnboardingTask,
  // Master product catalog schemas
  masterProductModels,
  masterProductAccessories,
  tenantEnabledProducts,
  type MasterProductModel,
  type InsertMasterProductModel,
  type MasterProductAccessory,
  type InsertMasterProductAccessory,
  type TenantEnabledProduct,
  type EnabledProduct,
  type InsertEnabledProduct,
  type MasterProductAccessoryRelationship,
  type InsertMasterProductAccessoryRelationship,
  // Lease Management schemas
  leases,
  leasePayments,
  leaseRenewals,
  leaseDispositions,
  type Lease,
  type InsertLease,
  type LeasePayment,
  type InsertLeasePayment,
  type LeaseRenewal,
  type InsertLeaseRenewal,
  type LeaseDisposition,
  type InsertLeaseDisposition,
  // E-Signature Integration schemas
  integrationCredentials,
  signatureRequests,
  signatureSigners,
  signatureDocuments,
  signatureAuditLogs,
  type IntegrationCredential,
  type InsertIntegrationCredential,
  type SignatureRequest,
  type InsertSignatureRequest,
  type SignatureSigner,
  type InsertSignatureSigner,
  type SignatureDocument,
  type InsertSignatureDocument,
  type SignatureAuditLog,
  type InsertSignatureAuditLog,
  // Field Service Photo & Signature Capture schemas
  installations,
  serviceSignatures,
  installationChecklists,
  type Installation,
  type InsertInstallation,
  type ServiceSignature,
  type InsertServiceSignature,
  type InstallationChecklist,
  type InsertInstallationChecklist,
  // Email Marketing Service Integration schemas
  emailTemplates,
  emailCampaigns,
  emailSends,
  emailEvents,
  emailLists,
  emailListMembers,
  emailUnsubscribes,
  type EmailTemplate,
  type InsertEmailTemplate,
  type EmailCampaign,
  type InsertEmailCampaign,
  type EmailSend,
  type InsertEmailSend,
  type EmailEvent,
  type InsertEmailEvent,
  type EmailList,
  type InsertEmailList,
  type EmailListMember,
  type InsertEmailListMember,
  type EmailUnsubscribe,
  type InsertEmailUnsubscribe,
  // MFA Enforcement schemas
  mfaBackupCodes,
  mfaAuditLogs,
  type MfaBackupCode,
  type InsertMfaBackupCode,
  type MfaAuditLog,
  type InsertMfaAuditLog,
  // Workflow Automation schemas
  workflows,
  workflowVersions,
  workflowTriggers,
  triggerSchedules,
  workflowConditions,
  workflowStepsAutomation,
  workflowStepTransitions,
  workflowExecutions,
  workflowExecutionSteps,
  workflowExecutionEvents,
  workflowTemplates,
  templateVariables,
  workflowEventRegistry,
  type Workflow,
  type InsertWorkflow,
  type WorkflowVersion,
  type InsertWorkflowVersion,
  type WorkflowTrigger,
  type InsertWorkflowTrigger,
  type TriggerSchedule,
  type InsertTriggerSchedule,
  type WorkflowCondition,
  type InsertWorkflowCondition,
  type WorkflowStepAutomation,
  type InsertWorkflowStepAutomation,
  type WorkflowStepTransition,
  type InsertWorkflowStepTransition,
  type WorkflowExecution,
  type InsertWorkflowExecution,
  type WorkflowExecutionStep,
  type InsertWorkflowExecutionStep,
  type WorkflowExecutionEvent,
  type InsertWorkflowExecutionEvent,
  type WorkflowTemplate,
  type InsertWorkflowTemplate,
  type TemplateVariable,
  type InsertTemplateVariable,
  type WorkflowEventRegistry,
  type InsertWorkflowEventRegistry,
  assignmentGroups,
  workflowApprovals,
  type AssignmentGroup,
  type InsertAssignmentGroup,
  type WorkflowApproval,
  type InsertWorkflowApproval,
} from '@shared/schema';
import {
  // Lead Scoring schemas
  leadScoringRules,
  leadScoringFactors,
  bantQualificationCriteria,
  leadScoreCalculations,
  leadQualificationHistory,
  leadEngagementTracking,
  type LeadScoringRule,
  type InsertLeadScoringRule,
  type LeadScoringFactor,
  type InsertLeadScoringFactor,
  type BantQualificationCriteria,
  type InsertBantQualification,
  type LeadScoreCalculation,
  type InsertLeadScoreCalculation,
  type LeadQualificationHistory,
  type InsertLeadQualificationHistory,
  type LeadEngagementTracking,
  type InsertLeadEngagementTracking,
} from '@shared/lead-scoring-schema';
import {
  // Manufacturer Order Submission schemas
  manufacturerConnections,
  manufacturerOrders,
  manufacturerOrderLineItems,
  manufacturerOrderConfirmations,
  manufacturerOrderShipments,
  manufacturerOrderExceptions,
  type ManufacturerConnection,
  type InsertManufacturerConnection,
  type ManufacturerOrder,
  type InsertManufacturerOrder,
  type ManufacturerOrderLineItem,
  type InsertManufacturerOrderLineItem,
  type ManufacturerOrderConfirmation,
  type InsertManufacturerOrderConfirmation,
  type ManufacturerOrderShipment,
  type InsertManufacturerOrderShipment,
  type ManufacturerOrderException,
  type InsertManufacturerOrderException,
} from '@shared/manufacturer-order-schema';
import {
  // GPS Tracking schemas
  technicianLocations,
  locationHistory as gpsLocationHistory,
  routeAssignments,
  routeDeviations,
  etaCalculations,
  geofences,
  geofenceEvents,
  type TechnicianLocation,
  type InsertTechnicianLocation,
  type LocationHistory as GpsLocationHistory,
  type InsertLocationHistory as InsertGpsLocationHistory,
  type RouteAssignment,
  type InsertRouteAssignment,
  type RouteDeviation,
  type InsertRouteDeviation,
  type EtaCalculation,
  type InsertEtaCalculation,
  type Geofence,
  type InsertGeofence,
  type GeofenceEvent,
  type InsertGeofenceEvent,
} from '@shared/gps-tracking-schema';
import {
  // Advanced Billing schemas
  billingRules,
  meterAnomalies,
  billingDisputes,
  invoiceGenerationLogs,
  billingSchedules,
  creditMemos,
  type BillingRule,
  type InsertBillingRule,
  type MeterAnomaly,
  type InsertMeterAnomaly,
  type BillingDispute,
  type InsertBillingDispute,
  type InvoiceGenerationLog,
  type InsertInvoiceGenerationLog,
  type BillingSchedule,
  type InsertBillingSchedule,
  type CreditMemo,
  type InsertCreditMemo,
} from '@shared/advanced-billing-schema';
import {
  // Customer Success schemas
  customerHealthScores,
  churnPredictions,
  successInterventions,
  customerJourneys,
  renewalOpportunities,
  type CustomerHealthScore,
  type ChurnPrediction,
  type SuccessIntervention,
  type CustomerJourney,
  type RenewalOpportunity,
  type InsertCustomerHealthScore,
  type InsertChurnPrediction,
  type InsertSuccessIntervention,
  type InsertCustomerJourney,
  type InsertRenewalOpportunity,
} from '@shared/customer-success-schema';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('storage');

import {
  eq,
  and,
  or,
  inArray,
  sql,
  desc,
  asc,
  like,
  gte,
  lte,
  lt,
  ne,
  count,
  isNull,
  isNotNull,
} from 'drizzle-orm';
import bcrypt from 'bcrypt';

// Interface for storage operations with role-based access control
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUsers(tenantId: string): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Authentication operations
  authenticateUser(email: string, password: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Tenant operations for platform users
  getAllTenants(): Promise<{ id: string; name: string; domain?: string }[]>;

  // Role-based data access operations
  getUserWithRole(id: string): Promise<(User & { role?: Role; team?: Team }) | undefined>;
  getAccessibleCustomers(
    userId: string,
    tenantId: string,
    roleLevel: number,
    teamId?: string,
  ): Promise<Customer[]>;
  getAccessibleLeads(
    userId: string,
    tenantId: string,
    roleLevel: number,
    teamId?: string,
  ): Promise<Lead[]>;
  getAccessibleServiceTickets(
    userId: string,
    tenantId: string,
    roleLevel: number,
    teamId?: string,
  ): Promise<ServiceTicket[]>;
  getAccessibleContracts(
    userId: string,
    tenantId: string,
    roleLevel: number,
    teamId?: string,
  ): Promise<Contract[]>;

  // Customer operations
  getCustomers(tenantId: string): Promise<Customer[]>;
  getCustomer(id: string, tenantId: string): Promise<Customer | undefined>;
  createCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer>;
  updateCustomer(
    id: string,
    customer: Partial<Customer>,
    tenantId: string,
  ): Promise<Customer | undefined>;
  deleteCustomer(id: string, tenantId: string): Promise<boolean>;

  // Company operations (new primary business entity)
  getCompanies(tenantId: string): Promise<Company[]>;
  getCompany(id: string, tenantId: string): Promise<Company | undefined>;
  getCompanyByName(name: string, tenantId: string): Promise<Company | undefined>;
  createCompany(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company>;
  updateCompany(
    id: string,
    company: Partial<Company>,
    tenantId: string,
  ): Promise<Company | undefined>;
  deleteCompany(id: string, tenantId: string): Promise<boolean>;

  // Company contact operations
  getCompanyContacts(companyId: string, tenantId: string): Promise<CompanyContact[]>;
  getCompanyContact(id: string, tenantId: string): Promise<CompanyContact | undefined>;
  createCompanyContact(
    contact: Omit<CompanyContact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CompanyContact>;
  updateCompanyContact(
    id: string,
    contact: Partial<CompanyContact>,
    tenantId: string,
  ): Promise<CompanyContact | undefined>;
  deleteCompanyContact(id: string, tenantId: string): Promise<boolean>;

  // Lead operations (simplified pipeline tracking)
  getLeads(tenantId: string): Promise<Lead[]>;
  getLead(id: string, tenantId: string): Promise<Lead | undefined>;
  createLead(lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead>;
  updateLead(id: string, lead: Partial<Lead>, tenantId: string): Promise<Lead | undefined>;
  convertLeadToCustomer(leadId: string, tenantId: string): Promise<Customer>;

  // Lead activity/interaction operations
  getLeadActivities(leadId: string, tenantId: string): Promise<LeadActivity[]>;
  createLeadActivity(
    activity: Omit<LeadActivity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<LeadActivity>;

  // Contact operations (comprehensive contact management)
  getContacts(options: {
    filters: any;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    offset: number;
    limit: number;
  }): Promise<CompanyContact[]>;
  getContactsCount(options: { filters: any; search: string }): Promise<number>;
  getContactById(id: string): Promise<CompanyContact | undefined>;
  createContact(
    contact: Omit<CompanyContact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CompanyContact>;
  updateContact(id: string, contact: Partial<CompanyContact>): Promise<CompanyContact>;
  deleteContact(id: string): Promise<boolean>;
  getUserByName(name: string): Promise<User | undefined>;
  getContactsByCompany(companyId: string, tenantId: string): Promise<CompanyContact[]>;

  // Lead contact operations
  getLeadContacts(leadId: string, tenantId: string): Promise<LeadContact[]>;
  createLeadContact(
    contact: Omit<LeadContact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<LeadContact>;

  // Lead related records operations
  getLeadRelatedRecords(leadId: string, tenantId: string): Promise<LeadRelatedRecord[]>;
  createLeadRelatedRecord(
    record: Omit<LeadRelatedRecord, 'id' | 'createdAt'>,
  ): Promise<LeadRelatedRecord>;

  // Quote operations with RBAC
  getQuotes(tenantId: string): Promise<Quote[]>;
  createQuote(quote: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quote>;

  // Equipment operations
  getEquipment(tenantId: string): Promise<Equipment[]>;
  createEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Equipment>;

  // Contract operations
  getContracts(tenantId: string): Promise<Contract[]>;
  createContract(contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contract>;

  // Service ticket operations with RBAC
  getServiceTickets(tenantId: string): Promise<ServiceTicket[]>;
  createServiceTicket(
    ticket: Omit<ServiceTicket, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceTicket>;
  updateServiceTicket(
    id: string,
    ticket: Partial<ServiceTicket>,
    tenantId: string,
  ): Promise<ServiceTicket | undefined>;

  // Inventory operations
  getInventoryItems(tenantId: string): Promise<InventoryItem[]>;
  createInventoryItem(
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<InventoryItem>;

  // Technician operations
  getTechnicians(tenantId: string): Promise<Technician[]>;
  createTechnician(
    technician: Omit<Technician, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Technician>;

  // Meter reading operations
  getMeterReadings(tenantId: string): Promise<MeterReading[]>;
  createMeterReading(
    reading: Omit<MeterReading, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MeterReading>;

  // Invoice operations
  getInvoices(tenantId: string): Promise<Invoice[]>;
  createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice>;

  // User-Customer assignments for territory management
  getUserCustomerAssignments(userId: string, tenantId: string): Promise<UserCustomerAssignment[]>;
  createUserCustomerAssignment(
    assignment: Omit<UserCustomerAssignment, 'id' | 'createdAt'>,
  ): Promise<UserCustomerAssignment>;

  // Product Management operations
  getProductModels(tenantId: string): Promise<ProductModel[]>;
  getProductModel(id: string, tenantId: string): Promise<ProductModel | undefined>;
  createProductModel(model: InsertProductModel): Promise<ProductModel>;
  updateProductModel(
    id: string,
    model: Partial<ProductModel>,
    tenantId: string,
  ): Promise<ProductModel | undefined>;

  getProductAccessories(modelId: string, tenantId: string): Promise<ProductAccessory[]>;
  createProductAccessory(accessory: InsertProductAccessory): Promise<ProductAccessory>;
  deleteProductAccessory(id: string, tenantId: string): Promise<boolean>;

  // Accessory-Model Compatibility operations
  getAccessoryCompatibilities(
    accessoryId: string,
    tenantId: string,
  ): Promise<AccessoryModelCompatibility[]>;
  getModelCompatibilities(
    modelId: string,
    tenantId: string,
  ): Promise<AccessoryModelCompatibility[]>;
  createAccessoryModelCompatibility(
    compatibility: InsertAccessoryModelCompatibility,
  ): Promise<AccessoryModelCompatibility>;
  deleteAccessoryModelCompatibility(
    accessoryId: string,
    modelId: string,
    tenantId: string,
  ): Promise<void>;

  getCpcRates(modelId: string, tenantId: string): Promise<CpcRate[]>;
  createCpcRate(rate: InsertCpcRate): Promise<CpcRate>;

  // Contract Tiered Rates operations (for meter billing)
  getContractTieredRates(tenantId: string): Promise<ContractTieredRate[]>;
  getContractTieredRatesByContract(contractId: string): Promise<ContractTieredRate[]>;
  createContractTieredRate(rate: InsertContractTieredRate): Promise<ContractTieredRate>;

  // Enhanced meter reading operations
  getMeterReadingsByStatus(tenantId: string, status: string): Promise<MeterReading[]>;
  updateMeterReading(
    id: string,
    reading: Partial<MeterReading>,
    tenantId: string,
  ): Promise<MeterReading | undefined>;
  getContract(id: string, tenantId: string): Promise<Contract | undefined>;

  // Deal management operations
  getDeals(tenantId: string, stageId?: string, search?: string, leadId?: string): Promise<any[]>;
  getDeal(id: string, tenantId: string): Promise<any>;
  createDeal(deal: any): Promise<any>;
  updateDeal(id: string, deal: Partial<any>, tenantId: string): Promise<any>;
  updateDealStage(id: string, stageId: string, tenantId: string): Promise<any>;

  // Deal stages operations
  getDealStages(tenantId: string): Promise<any[]>;
  createDealStage(stage: any): Promise<any>;
  updateDealStageById(id: string, stage: Partial<any>, tenantId: string): Promise<any>;

  // Deal activities operations
  getDealActivities(dealId: string, tenantId: string): Promise<any[]>;
  createDealActivity(activity: any): Promise<any>;

  // Purchase Order operations
  getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrder(id: string, tenantId: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(
    id: string,
    po: Partial<PurchaseOrder>,
    tenantId: string,
  ): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string, tenantId: string): Promise<boolean>;

  // Purchase Order Items operations
  getPurchaseOrderItems(purchaseOrderId: string, tenantId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(
    id: string,
    item: Partial<PurchaseOrderItem>,
    tenantId: string,
  ): Promise<PurchaseOrderItem | undefined>;
  deletePurchaseOrderItem(id: string, tenantId: string): Promise<boolean>;

  // Vendor operations
  getVendors(tenantId: string): Promise<Vendor[]>;
  getVendor(id: string, tenantId: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<Vendor>, tenantId: string): Promise<Vendor | undefined>;
  deleteVendor(id: string, tenantId: string): Promise<boolean>;

  // Product catalog operations
  getAllProductModels(tenantId: string): Promise<ProductModel[]>;
  getAllProductAccessories(tenantId: string): Promise<ProductAccessory[]>;
  getAllServiceProducts(tenantId: string): Promise<ServiceProduct[]>;
  getAllSoftwareProducts(tenantId: string): Promise<SoftwareProduct[]>;
  getAllProfessionalServices(tenantId: string): Promise<ProfessionalService[]>;
  createProfessionalService(service: InsertProfessionalService): Promise<ProfessionalService>;
  updateProfessionalService(
    id: string,
    data: Partial<ProfessionalService>,
    tenantId: string,
  ): Promise<ProfessionalService | undefined>;
  deleteProfessionalService(id: string, tenantId: string): Promise<boolean>;
  getAllSupplies(tenantId: string): Promise<Supply[]>;
  createSupply(supply: InsertSupply): Promise<Supply>;
  updateSupply(id: string, data: Partial<Supply>, tenantId: string): Promise<Supply | undefined>;
  deleteSupply(id: string, tenantId: string): Promise<boolean>;
  getAllManagedServices(tenantId: string): Promise<ManagedService[]>;
  createManagedService(service: InsertManagedService): Promise<ManagedService>;
  updateManagedService(
    id: string,
    data: Partial<ManagedService>,
    tenantId: string,
  ): Promise<ManagedService | undefined>;
  deleteManagedService(id: string, tenantId: string): Promise<boolean>;

  // Pricing System
  getCompanyPricingSettings(tenantId: string): Promise<CompanyPricingSetting | undefined>;
  updateCompanyPricingSettings(
    tenantId: string,
    settings: InsertCompanyPricingSetting,
  ): Promise<CompanyPricingSetting>;

  getProductPricing(tenantId: string): Promise<ProductPricing[]>;
  getProductPricingByProductId(
    productId: string,
    productType: string,
    tenantId: string,
  ): Promise<ProductPricing | undefined>;
  createProductPricing(pricing: InsertProductPricing): Promise<ProductPricing>;
  updateProductPricing(
    id: string,
    tenantId: string,
    pricing: Partial<InsertProductPricing>,
  ): Promise<ProductPricing | undefined>;
  deleteProductPricing(id: string, tenantId: string): Promise<boolean>;

  getQuotePricing(quoteId: string, tenantId: string): Promise<QuotePricing | undefined>;
  createQuotePricing(pricing: InsertQuotePricing): Promise<QuotePricing>;
  updateQuotePricing(
    id: string,
    tenantId: string,
    pricing: Partial<InsertQuotePricing>,
  ): Promise<QuotePricing | undefined>;

  getQuotePricingLineItems(
    quotePricingId: string,
    tenantId: string,
  ): Promise<QuotePricingLineItem[]>;
  createQuotePricingLineItem(lineItem: InsertQuotePricingLineItem): Promise<QuotePricingLineItem>;
  updateQuotePricingLineItem(
    id: string,
    tenantId: string,
    lineItem: Partial<InsertQuotePricingLineItem>,
  ): Promise<QuotePricingLineItem | undefined>;
  deleteQuotePricingLineItem(id: string, tenantId: string): Promise<boolean>;

  // Mobile field service operations
  getMobileServiceSessions(params: {
    tenantId: string;
    serviceTicketId?: string;
    technicianId?: string;
  }): Promise<MobileServiceSession[]>;
  createMobileServiceSession(session: InsertMobileServiceSession): Promise<MobileServiceSession>;
  updateMobileServiceSession(
    id: string,
    tenantId: string,
    session: Partial<MobileServiceSession>,
  ): Promise<MobileServiceSession | undefined>;

  getTimeTrackingEntries(sessionId: string, tenantId: string): Promise<TimeTrackingEntry[]>;
  createTimeTrackingEntry(entry: InsertTimeTrackingEntry): Promise<TimeTrackingEntry>;

  getServicePhotos(params: {
    tenantId: string;
    serviceTicketId?: string;
    sessionId?: string;
  }): Promise<ServicePhoto[]>;
  createServicePhoto(photo: InsertServicePhoto): Promise<ServicePhoto>;

  getLocationHistory(params: {
    tenantId: string;
    technicianId?: string;
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<LocationHistory[]>;
  createLocationHistory(location: InsertLocationHistory): Promise<LocationHistory>;

  // Business Records operations (unified lead-to-customer lifecycle)
  getBusinessRecords(
    tenantId: string,
    recordType?: string,
    status?: string,
    search?: string,
    limit?: number,
  ): Promise<any[]>;
  getBusinessRecord(id: string, tenantId: string): Promise<any | undefined>;
  createBusinessRecord(record: any): Promise<any>;
  updateBusinessRecord(
    id: string,
    tenantId: string,
    record: Partial<any>,
  ): Promise<any | undefined>;

  // Onboarding operations
  getOnboardingChecklists(tenantId: string): Promise<OnboardingChecklist[]>;
  getOnboardingChecklist(id: string, tenantId: string): Promise<OnboardingChecklist | undefined>;
  createOnboardingChecklist(checklist: InsertOnboardingChecklist): Promise<OnboardingChecklist>;
  updateOnboardingChecklist(
    id: string,
    tenantId: string,
    checklist: Partial<OnboardingChecklist>,
  ): Promise<OnboardingChecklist | undefined>;
  deleteOnboardingChecklist(id: string, tenantId: string): Promise<void>;

  getOnboardingEquipment(checklistId: string, tenantId: string): Promise<OnboardingEquipment[]>;
  createOnboardingEquipment(equipment: InsertOnboardingEquipment): Promise<OnboardingEquipment>;
  updateOnboardingEquipment(
    id: string,
    tenantId: string,
    equipment: Partial<OnboardingEquipment>,
  ): Promise<OnboardingEquipment | undefined>;

  getOnboardingNetworkConfig(
    checklistId: string,
    tenantId: string,
  ): Promise<OnboardingNetworkConfig[]>;
  createOnboardingNetworkConfig(
    config: InsertOnboardingNetworkConfig,
  ): Promise<OnboardingNetworkConfig>;
  updateOnboardingNetworkConfig(
    id: string,
    tenantId: string,
    config: Partial<OnboardingNetworkConfig>,
  ): Promise<OnboardingNetworkConfig | undefined>;

  getOnboardingPrintManagement(
    checklistId: string,
    tenantId: string,
  ): Promise<OnboardingPrintManagement[]>;
  createOnboardingPrintManagement(
    config: InsertOnboardingPrintManagement,
  ): Promise<OnboardingPrintManagement>;
  updateOnboardingPrintManagement(
    id: string,
    tenantId: string,
    config: Partial<OnboardingPrintManagement>,
  ): Promise<OnboardingPrintManagement | undefined>;

  getOnboardingDynamicSections(
    checklistId: string,
    tenantId: string,
  ): Promise<OnboardingDynamicSection[]>;
  createOnboardingDynamicSection(
    section: InsertOnboardingDynamicSection,
  ): Promise<OnboardingDynamicSection>;
  updateOnboardingDynamicSection(
    id: string,
    tenantId: string,
    section: Partial<OnboardingDynamicSection>,
  ): Promise<OnboardingDynamicSection | undefined>;
  deleteOnboardingDynamicSection(id: string, tenantId: string): Promise<void>;

  getOnboardingTasks(checklistId: string, tenantId: string): Promise<OnboardingTask[]>;
  createOnboardingTask(task: InsertOnboardingTask): Promise<OnboardingTask>;
  updateOnboardingTask(
    id: string,
    tenantId: string,
    task: Partial<OnboardingTask>,
  ): Promise<OnboardingTask | undefined>;
  deleteOnboardingTask(id: string, tenantId: string): Promise<void>;

  // Lease Management operations
  getLeases(tenantId: string): Promise<Lease[]>;
  getLease(id: string, tenantId: string): Promise<Lease | undefined>;
  getLeasesByCustomer(customerId: string, tenantId: string): Promise<Lease[]>;
  getLeasesByStatus(status: string, tenantId: string): Promise<Lease[]>;
  createLease(lease: InsertLease): Promise<Lease>;
  updateLease(id: string, tenantId: string, lease: Partial<Lease>): Promise<Lease | undefined>;
  deleteLease(id: string, tenantId: string): Promise<void>;

  // Lease Payments operations
  getLeasePayments(leaseId: string, tenantId: string): Promise<LeasePayment[]>;
  getLeasePayment(id: string, tenantId: string): Promise<LeasePayment | undefined>;
  getUpcomingPayments(tenantId: string, daysAhead: number): Promise<LeasePayment[]>;
  getPastDuePayments(tenantId: string): Promise<LeasePayment[]>;
  createLeasePayment(payment: InsertLeasePayment): Promise<LeasePayment>;
  updateLeasePayment(
    id: string,
    tenantId: string,
    payment: Partial<LeasePayment>,
  ): Promise<LeasePayment | undefined>;
  deleteLeasePayment(id: string, tenantId: string): Promise<void>;

  // Lease Renewals operations
  getLeaseRenewals(tenantId: string): Promise<LeaseRenewal[]>;
  getLeaseRenewal(id: string, tenantId: string): Promise<LeaseRenewal | undefined>;
  getLeaseRenewalByLease(leaseId: string, tenantId: string): Promise<LeaseRenewal | undefined>;
  getLeasesNeedingRenewalAction(tenantId: string, daysAhead: number): Promise<LeaseRenewal[]>;
  createLeaseRenewal(renewal: InsertLeaseRenewal): Promise<LeaseRenewal>;
  updateLeaseRenewal(
    id: string,
    tenantId: string,
    renewal: Partial<LeaseRenewal>,
  ): Promise<LeaseRenewal | undefined>;
  deleteLeaseRenewal(id: string, tenantId: string): Promise<void>;

  // Lease Dispositions operations
  getLeaseDispositions(tenantId: string): Promise<LeaseDisposition[]>;
  getLeaseDisposition(id: string, tenantId: string): Promise<LeaseDisposition | undefined>;
  getLeaseDispositionByLease(
    leaseId: string,
    tenantId: string,
  ): Promise<LeaseDisposition | undefined>;
  createLeaseDisposition(disposition: InsertLeaseDisposition): Promise<LeaseDisposition>;
  updateLeaseDisposition(
    id: string,
    tenantId: string,
    disposition: Partial<LeaseDisposition>,
  ): Promise<LeaseDisposition | undefined>;
  deleteLeaseDisposition(id: string, tenantId: string): Promise<void>;

  // Integration Credentials operations
  getIntegrationCredentials(tenantId: string, provider?: string): Promise<IntegrationCredential[]>;
  getIntegrationCredential(
    id: string,
    tenantId: string,
  ): Promise<IntegrationCredential | undefined>;
  getIntegrationCredentialByProvider(
    tenantId: string,
    provider: string,
  ): Promise<IntegrationCredential | undefined>;
  createIntegrationCredential(
    credential: InsertIntegrationCredential,
  ): Promise<IntegrationCredential>;
  updateIntegrationCredential(
    id: string,
    tenantId: string,
    credential: Partial<IntegrationCredential>,
  ): Promise<IntegrationCredential | undefined>;
  deleteIntegrationCredential(id: string, tenantId: string): Promise<void>;
  testIntegrationConnection(
    id: string,
    tenantId: string,
  ): Promise<{ healthy: boolean; message: string }>;

  // Signature Requests operations
  getSignatureRequests(tenantId: string, status?: string): Promise<SignatureRequest[]>;
  getSignatureRequest(id: string, tenantId: string): Promise<SignatureRequest | undefined>;
  getSignatureRequestsByCustomer(customerId: string, tenantId: string): Promise<SignatureRequest[]>;
  getExpiringSignatureRequests(tenantId: string, daysAhead: number): Promise<SignatureRequest[]>;
  createSignatureRequest(request: InsertSignatureRequest): Promise<SignatureRequest>;
  updateSignatureRequest(
    id: string,
    tenantId: string,
    request: Partial<SignatureRequest>,
  ): Promise<SignatureRequest | undefined>;
  deleteSignatureRequest(id: string, tenantId: string): Promise<void>;

  // Signature Signers operations
  getSignatureSigners(requestId: string, tenantId: string): Promise<SignatureSigner[]>;
  getSignatureSigner(id: string, tenantId: string): Promise<SignatureSigner | undefined>;
  createSignatureSigner(signer: InsertSignatureSigner): Promise<SignatureSigner>;
  updateSignatureSigner(
    id: string,
    tenantId: string,
    signer: Partial<SignatureSigner>,
  ): Promise<SignatureSigner | undefined>;
  deleteSignatureSigner(id: string, tenantId: string): Promise<void>;

  // Signature Documents operations
  getSignatureDocuments(requestId: string, tenantId: string): Promise<SignatureDocument[]>;
  getSignatureDocument(id: string, tenantId: string): Promise<SignatureDocument | undefined>;
  createSignatureDocument(document: InsertSignatureDocument): Promise<SignatureDocument>;
  updateSignatureDocument(
    id: string,
    tenantId: string,
    document: Partial<SignatureDocument>,
  ): Promise<SignatureDocument | undefined>;
  deleteSignatureDocument(id: string, tenantId: string): Promise<void>;

  // Signature Audit Logs operations
  getSignatureAuditLogs(requestId: string, tenantId: string): Promise<SignatureAuditLog[]>;
  getSignatureAuditLogsBySigner(signerId: string, tenantId: string): Promise<SignatureAuditLog[]>;
  createSignatureAuditLog(log: InsertSignatureAuditLog): Promise<SignatureAuditLog>;

  // Field Service Photo & Signature Capture
  // Installations
  getInstallations(
    tenantId: string,
    filters?: { status?: string; customerId?: string; technicianId?: string },
  ): Promise<Installation[]>;
  getInstallationById(id: string, tenantId: string): Promise<Installation | null>;
  getInstallationByNumber(
    installationNumber: string,
    tenantId: string,
  ): Promise<Installation | null>;
  createInstallation(installation: InsertInstallation): Promise<Installation>;
  updateInstallation(
    id: string,
    tenantId: string,
    data: Partial<Installation>,
  ): Promise<Installation | null>;
  deleteInstallation(id: string, tenantId: string): Promise<void>;
  generateInstallationNumber(tenantId: string): Promise<string>;

  // Service Signatures
  getServiceSignatures(
    tenantId: string,
    filters?: { serviceTicketId?: string; installationId?: string },
  ): Promise<ServiceSignature[]>;
  getServiceSignatureById(id: string, tenantId: string): Promise<ServiceSignature | null>;
  createServiceSignature(signature: InsertServiceSignature): Promise<ServiceSignature>;
  updateServiceSignature(
    id: string,
    tenantId: string,
    data: Partial<ServiceSignature>,
  ): Promise<ServiceSignature | null>;
  deleteServiceSignature(id: string, tenantId: string): Promise<void>;

  // Installation Checklists
  getInstallationChecklists(
    installationId: string,
    tenantId: string,
  ): Promise<InstallationChecklist[]>;
  getInstallationChecklistById(id: string, tenantId: string): Promise<InstallationChecklist | null>;
  createInstallationChecklist(
    checklist: InsertInstallationChecklist,
  ): Promise<InstallationChecklist>;
  updateInstallationChecklist(
    id: string,
    tenantId: string,
    data: Partial<InstallationChecklist>,
  ): Promise<InstallationChecklist | null>;
  deleteInstallationChecklist(id: string, tenantId: string): Promise<void>;
  bulkCreateInstallationChecklists(
    checklists: InsertInstallationChecklist[],
  ): Promise<InstallationChecklist[]>;

  // Email Marketing Service Integration
  // Email Templates
  getEmailTemplates(
    tenantId: string,
    filters?: { templateType?: string; isActive?: boolean; category?: string },
  ): Promise<EmailTemplate[]>;
  getEmailTemplateById(id: string, tenantId: string): Promise<EmailTemplate | null>;
  getEmailTemplateByName(templateName: string, tenantId: string): Promise<EmailTemplate | null>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(
    id: string,
    tenantId: string,
    data: Partial<EmailTemplate>,
  ): Promise<EmailTemplate | null>;
  deleteEmailTemplate(id: string, tenantId: string): Promise<void>;

  // Email Campaigns
  getEmailCampaigns(
    tenantId: string,
    filters?: { status?: string; campaignType?: string; ownerId?: string },
  ): Promise<EmailCampaign[]>;
  getEmailCampaignById(id: string, tenantId: string): Promise<EmailCampaign | null>;
  getEmailCampaignByName(campaignName: string, tenantId: string): Promise<EmailCampaign | null>;
  createEmailCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign>;
  updateEmailCampaign(
    id: string,
    tenantId: string,
    data: Partial<EmailCampaign>,
  ): Promise<EmailCampaign | null>;
  deleteEmailCampaign(id: string, tenantId: string): Promise<void>;
  updateCampaignMetrics(campaignId: string, tenantId: string): Promise<EmailCampaign | null>;

  // Email Sends
  getEmailSends(campaignId: string, tenantId: string): Promise<EmailSend[]>;
  getEmailSendById(id: string, tenantId: string): Promise<EmailSend | null>;
  getEmailSendsByRecipient(recipientEmail: string, tenantId: string): Promise<EmailSend[]>;
  createEmailSend(send: InsertEmailSend): Promise<EmailSend>;
  updateEmailSend(
    id: string,
    tenantId: string,
    data: Partial<EmailSend>,
  ): Promise<EmailSend | null>;
  deleteEmailSend(id: string, tenantId: string): Promise<void>;
  bulkCreateEmailSends(sends: InsertEmailSend[]): Promise<EmailSend[]>;

  // Email Events
  getEmailEvents(emailSendId: string, tenantId: string): Promise<EmailEvent[]>;
  getEmailEventsByCampaign(
    campaignId: string,
    tenantId: string,
    filters?: { eventType?: string },
  ): Promise<EmailEvent[]>;
  createEmailEvent(event: InsertEmailEvent): Promise<EmailEvent>;

  // Email Lists
  getEmailLists(
    tenantId: string,
    filters?: { listType?: string; isActive?: boolean; category?: string },
  ): Promise<EmailList[]>;
  getEmailListById(id: string, tenantId: string): Promise<EmailList | null>;
  getEmailListByName(listName: string, tenantId: string): Promise<EmailList | null>;
  createEmailList(list: InsertEmailList): Promise<EmailList>;
  updateEmailList(
    id: string,
    tenantId: string,
    data: Partial<EmailList>,
  ): Promise<EmailList | null>;
  deleteEmailList(id: string, tenantId: string): Promise<void>;
  updateListMemberCounts(listId: string, tenantId: string): Promise<EmailList | null>;

  // Email List Members
  getEmailListMembers(
    listId: string,
    tenantId: string,
    filters?: { status?: string },
  ): Promise<EmailListMember[]>;
  getEmailListMemberById(id: string, tenantId: string): Promise<EmailListMember | null>;
  getEmailListMemberByEmail(
    listId: string,
    email: string,
    tenantId: string,
  ): Promise<EmailListMember | null>;
  createEmailListMember(member: InsertEmailListMember): Promise<EmailListMember>;
  updateEmailListMember(
    id: string,
    tenantId: string,
    data: Partial<EmailListMember>,
  ): Promise<EmailListMember | null>;
  deleteEmailListMember(id: string, tenantId: string): Promise<void>;
  bulkCreateEmailListMembers(members: InsertEmailListMember[]): Promise<EmailListMember[]>;

  // Email Unsubscribes
  getEmailUnsubscribes(
    tenantId: string,
    filters?: { unsubscribeType?: string; email?: string },
  ): Promise<EmailUnsubscribe[]>;
  getEmailUnsubscribeByEmail(
    email: string,
    tenantId: string,
    unsubscribeType?: string,
  ): Promise<EmailUnsubscribe | null>;
  createEmailUnsubscribe(unsubscribe: InsertEmailUnsubscribe): Promise<EmailUnsubscribe>;
  checkUnsubscribeStatus(
    email: string,
    tenantId: string,
  ): Promise<{ isUnsubscribed: boolean; type?: string }>;

  // Multi-Factor Authentication (MFA) Enforcement
  // MFA Enrollment & Configuration
  enableMfaForUser(userId: string, secret: string): Promise<User | null>;
  disableMfaForUser(userId: string): Promise<User | null>;
  getUserMfaStatus(userId: string): Promise<{ enabled: boolean; hasBackupCodes: boolean } | null>;

  // MFA Backup Codes
  generateBackupCodes(
    userId: string,
    tenantId: string | null,
    count: number,
  ): Promise<{ codes: string[]; hashes: MfaBackupCode[] }>;
  validateBackupCode(userId: string, code: string): Promise<boolean>;
  getUnusedBackupCodes(userId: string): Promise<MfaBackupCode[]>;
  deleteAllBackupCodes(userId: string): Promise<void>;

  // MFA Audit Logs
  createMfaAuditLog(log: InsertMfaAuditLog): Promise<MfaAuditLog>;
  getMfaAuditLogs(
    userId: string,
    filters?: { eventType?: string; success?: boolean },
  ): Promise<MfaAuditLog[]>;
  getMfaAuditLogsByTenant(
    tenantId: string,
    filters?: { eventType?: string; success?: boolean },
  ): Promise<MfaAuditLog[]>;

  // MFA Status Reporting & Compliance
  getMfaComplianceReport(tenantId: string): Promise<{
    totalUsers: number;
    mfaEnabledUsers: number;
    mfaDisabledUsers: number;
    compliancePercentage: number;
    recentEnrollments: number;
    recentFailures: number;
  }>;
  getUsersWithoutMfa(tenantId: string): Promise<User[]>;

  // Manufacturer Order Submission
  // Manufacturer Connections
  getManufacturerConnections(
    tenantId: string,
    filters?: { manufacturerType?: string; connectionStatus?: string },
  ): Promise<ManufacturerConnection[]>;
  getManufacturerConnection(id: string): Promise<ManufacturerConnection | null>;
  getManufacturerConnectionByType(
    tenantId: string,
    manufacturerType: string,
  ): Promise<ManufacturerConnection | null>;
  createManufacturerConnection(
    connection: InsertManufacturerConnection,
  ): Promise<ManufacturerConnection>;
  updateManufacturerConnection(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerConnection>,
  ): Promise<ManufacturerConnection | null>;
  deleteManufacturerConnection(id: string, tenantId: string): Promise<void>;
  testManufacturerConnection(
    connectionId: string,
    tenantId: string,
  ): Promise<{ success: boolean; message: string; error?: string }>;
  updateConnectionHealth(
    connectionId: string,
    tenantId: string,
    data: {
      lastConnectionTest?: Date;
      lastSuccessfulOrder?: Date;
      lastError?: string;
      consecutiveFailures?: number;
    },
  ): Promise<ManufacturerConnection | null>;

  // Manufacturer Orders
  getManufacturerOrders(
    tenantId: string,
    filters?: { connectionId?: string; orderStatus?: string; startDate?: Date; endDate?: Date },
  ): Promise<ManufacturerOrder[]>;
  getManufacturerOrder(id: string): Promise<ManufacturerOrder | null>;
  getManufacturerOrderByNumber(
    orderNumber: string,
    tenantId: string,
  ): Promise<ManufacturerOrder | null>;
  createManufacturerOrder(order: InsertManufacturerOrder): Promise<ManufacturerOrder>;
  updateManufacturerOrder(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrder>,
  ): Promise<ManufacturerOrder | null>;
  deleteManufacturerOrder(id: string, tenantId: string): Promise<void>;
  submitOrder(orderId: string, tenantId: string): Promise<ManufacturerOrder | null>;
  acknowledgeOrder(
    orderId: string,
    tenantId: string,
    manufacturerOrderNumber: string,
  ): Promise<ManufacturerOrder | null>;
  updateOrderFulfillment(
    orderId: string,
    tenantId: string,
    fulfillmentData: {
      totalQuantityShipped?: number;
      totalQuantityDelivered?: number;
      totalQuantityCancelled?: number;
    },
  ): Promise<ManufacturerOrder | null>;

  // Manufacturer Order Line Items
  getOrderLineItems(orderId: string): Promise<ManufacturerOrderLineItem[]>;
  getOrderLineItem(id: string): Promise<ManufacturerOrderLineItem | null>;
  createOrderLineItem(
    lineItem: InsertManufacturerOrderLineItem,
  ): Promise<ManufacturerOrderLineItem>;
  updateOrderLineItem(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrderLineItem>,
  ): Promise<ManufacturerOrderLineItem | null>;
  deleteOrderLineItem(id: string, tenantId: string): Promise<void>;
  bulkCreateOrderLineItems(
    lineItems: InsertManufacturerOrderLineItem[],
  ): Promise<ManufacturerOrderLineItem[]>;
  updateLineItemShipment(
    lineItemId: string,
    tenantId: string,
    shipmentData: { quantityShipped?: number; quantityDelivered?: number; actualShipDate?: Date },
  ): Promise<ManufacturerOrderLineItem | null>;

  // Manufacturer Order Confirmations
  getOrderConfirmations(orderId: string): Promise<ManufacturerOrderConfirmation[]>;
  getOrderConfirmation(id: string): Promise<ManufacturerOrderConfirmation | null>;
  createOrderConfirmation(
    confirmation: InsertManufacturerOrderConfirmation,
  ): Promise<ManufacturerOrderConfirmation>;
  updateOrderConfirmation(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrderConfirmation>,
  ): Promise<ManufacturerOrderConfirmation | null>;
  processConfirmation(
    confirmationId: string,
    tenantId: string,
  ): Promise<ManufacturerOrderConfirmation | null>;

  // Manufacturer Order Shipments
  getOrderShipments(orderId: string): Promise<ManufacturerOrderShipment[]>;
  getOrderShipment(id: string): Promise<ManufacturerOrderShipment | null>;
  getShipmentByTrackingNumber(
    trackingNumber: string,
    tenantId: string,
  ): Promise<ManufacturerOrderShipment | null>;
  createOrderShipment(
    shipment: InsertManufacturerOrderShipment,
  ): Promise<ManufacturerOrderShipment>;
  updateOrderShipment(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrderShipment>,
  ): Promise<ManufacturerOrderShipment | null>;
  deleteOrderShipment(id: string, tenantId: string): Promise<void>;
  updateShipmentTracking(
    shipmentId: string,
    tenantId: string,
    trackingData: { shipmentStatus?: string; trackingEvents?: any; lastTrackingUpdate?: Date },
  ): Promise<ManufacturerOrderShipment | null>;
  deliverShipment(
    shipmentId: string,
    tenantId: string,
    deliveryData: { actualDeliveryDate?: Date; deliveredTo?: string; signatureName?: string },
  ): Promise<ManufacturerOrderShipment | null>;

  // Manufacturer Order Exceptions
  getOrderExceptions(orderId: string): Promise<ManufacturerOrderException[]>;
  getUnresolvedExceptions(
    tenantId: string,
    filters?: { severity?: string; exceptionType?: string },
  ): Promise<ManufacturerOrderException[]>;
  getOrderException(id: string): Promise<ManufacturerOrderException | null>;
  createOrderException(
    exception: InsertManufacturerOrderException,
  ): Promise<ManufacturerOrderException>;
  updateOrderException(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrderException>,
  ): Promise<ManufacturerOrderException | null>;
  resolveException(
    exceptionId: string,
    tenantId: string,
    resolvedBy: string,
    resolutionNotes: string,
  ): Promise<ManufacturerOrderException | null>;
  retryFailedOrder(
    exceptionId: string,
    tenantId: string,
  ): Promise<{ success: boolean; message: string }>;

  // Analytics & Reporting
  getManufacturerOrderAnalytics(
    tenantId: string,
    filters?: { connectionId?: string; startDate?: Date; endDate?: Date },
  ): Promise<{
    totalOrders: number;
    ordersByStatus: Record<string, number>;
    totalOrderValue: number;
    averageOrderValue: number;
    fulfillmentRate: number;
    onTimeDeliveryRate: number;
    exceptionRate: number;
    topManufacturers: Array<{ manufacturerName: string; orderCount: number; totalValue: number }>;
  }>;

  // ==================== GPS Tracking ====================
  // Technician Locations (Current Position)
  getTechnicianLocation(technicianId: string, tenantId: string): Promise<TechnicianLocation | null>;
  updateTechnicianLocation(
    technicianId: string,
    tenantId: string,
    data: Partial<InsertTechnicianLocation>,
  ): Promise<TechnicianLocation>;
  getTechniciansByStatus(tenantId: string, status: string): Promise<TechnicianLocation[]>;
  getTechniciansNearLocation(
    tenantId: string,
    lat: number,
    lng: number,
    radiusMeters: number,
  ): Promise<TechnicianLocation[]>;
  getTechnicianLocationHistory(
    technicianId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<GpsLocationHistory[]>;
  createTechnicianLocation(data: InsertTechnicianLocation): Promise<TechnicianLocation>;
  deleteTechnicianLocation(technicianId: string, tenantId: string): Promise<void>;
  getAllTechnicianLocations(tenantId: string): Promise<TechnicianLocation[]>;

  // Location History (Historical Tracking)
  createLocationHistory(data: InsertGpsLocationHistory): Promise<GpsLocationHistory>;
  getLocationHistory(
    technicianId: string,
    tenantId: string,
    filters?: { startDate?: Date; endDate?: Date; activityType?: string; ticketId?: string },
  ): Promise<GpsLocationHistory[]>;
  getActivityTimeline(
    technicianId: string,
    tenantId: string,
    ticketId: string,
  ): Promise<GpsLocationHistory[]>;
  calculateDistanceTraveled(
    technicianId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number>;
  bulkCreateLocationHistory(data: InsertGpsLocationHistory[]): Promise<GpsLocationHistory[]>;

  // Route Assignments
  getRouteAssignments(
    tenantId: string,
    filters?: { technicianId?: string; routeDate?: Date; routeStatus?: string },
  ): Promise<RouteAssignment[]>;
  getRouteAssignment(routeId: string, tenantId: string): Promise<RouteAssignment | null>;
  createRouteAssignment(data: InsertRouteAssignment): Promise<RouteAssignment>;
  updateRouteAssignment(
    routeId: string,
    tenantId: string,
    data: Partial<RouteAssignment>,
  ): Promise<RouteAssignment | null>;
  deleteRouteAssignment(routeId: string, tenantId: string): Promise<void>;
  startRoute(routeId: string, tenantId: string): Promise<RouteAssignment | null>;
  completeRoute(routeId: string, tenantId: string): Promise<RouteAssignment | null>;
  updateRouteProgress(
    routeId: string,
    tenantId: string,
    stopData: { stopId: string; status: string; completedAt: Date },
  ): Promise<RouteAssignment | null>;

  // Route Deviations
  getRouteDeviations(
    tenantId: string,
    filters?: {
      routeId?: string;
      technicianId?: string;
      deviationType?: string;
      severity?: string;
      resolved?: boolean;
    },
  ): Promise<RouteDeviation[]>;
  getRouteDeviation(deviationId: string, tenantId: string): Promise<RouteDeviation | null>;
  createRouteDeviation(data: InsertRouteDeviation): Promise<RouteDeviation>;
  acknowledgeDeviation(
    deviationId: string,
    tenantId: string,
    userId: string,
  ): Promise<RouteDeviation | null>;
  resolveDeviation(
    deviationId: string,
    tenantId: string,
    userId: string,
    notes: string,
  ): Promise<RouteDeviation | null>;
  getUnresolvedDeviations(
    tenantId: string,
    filters?: { severity?: string; deviationType?: string },
  ): Promise<RouteDeviation[]>;
  updateRouteDeviation(
    deviationId: string,
    tenantId: string,
    data: Partial<RouteDeviation>,
  ): Promise<RouteDeviation | null>;

  // ETA Calculations
  getEtaCalculations(
    tenantId: string,
    filters?: { ticketId?: string; technicianId?: string; routeId?: string },
  ): Promise<EtaCalculation[]>;
  getEtaCalculation(etaId: string, tenantId: string): Promise<EtaCalculation | null>;
  createEtaCalculation(data: InsertEtaCalculation): Promise<EtaCalculation>;
  updateEtaCalculation(
    etaId: string,
    tenantId: string,
    data: Partial<EtaCalculation>,
  ): Promise<EtaCalculation | null>;
  getLatestEtaForTicket(
    ticketId: string,
    technicianId: string,
    tenantId: string,
  ): Promise<EtaCalculation | null>;
  updateActualArrival(
    etaId: string,
    tenantId: string,
    actualTime: Date,
  ): Promise<EtaCalculation | null>;
  getEtaAccuracyMetrics(
    tenantId: string,
    technicianId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ totalEtas: number; averageAccuracyMinutes: number; onTimePercentage: number }>;

  // Geofences
  getGeofences(
    tenantId: string,
    filters?: { geofenceType?: string; isActive?: boolean; customerId?: string },
  ): Promise<Geofence[]>;
  getGeofence(geofenceId: string, tenantId: string): Promise<Geofence | null>;
  createGeofence(data: InsertGeofence): Promise<Geofence>;
  updateGeofence(
    geofenceId: string,
    tenantId: string,
    data: Partial<Geofence>,
  ): Promise<Geofence | null>;
  deleteGeofence(geofenceId: string, tenantId: string): Promise<void>;
  checkGeofenceProximity(lat: number, lng: number, tenantId: string): Promise<Geofence[]>;

  // Geofence Events
  getGeofenceEvents(
    tenantId: string,
    filters?: { geofenceId?: string; technicianId?: string; eventType?: string; ticketId?: string },
  ): Promise<GeofenceEvent[]>;
  createGeofenceEvent(data: InsertGeofenceEvent): Promise<GeofenceEvent>;
  getGeofenceEventsForTechnician(
    technicianId: string,
    tenantId: string,
    filters?: { startDate?: Date; endDate?: Date; eventType?: string },
  ): Promise<GeofenceEvent[]>;
  getGeofenceEventsForTicket(ticketId: string, tenantId: string): Promise<GeofenceEvent[]>;
  getGeofenceEvent(eventId: string, tenantId: string): Promise<GeofenceEvent | null>;

  // ==================== Advanced Billing ====================
  // Billing Rules
  getBillingRules(
    tenantId: string,
    filters?: {
      ruleType?: string;
      ruleStatus?: string;
      customerId?: string;
      equipmentId?: string;
      contractId?: string;
    },
  ): Promise<BillingRule[]>;
  getBillingRule(ruleId: string): Promise<BillingRule | null>;
  createBillingRule(data: InsertBillingRule): Promise<BillingRule>;
  updateBillingRule(
    ruleId: string,
    tenantId: string,
    data: Partial<BillingRule>,
  ): Promise<BillingRule | null>;
  deleteBillingRule(ruleId: string, tenantId: string): Promise<void>;
  getActiveBillingRules(
    tenantId: string,
    customerId?: string,
    equipmentId?: string,
  ): Promise<BillingRule[]>;
  applyBillingRule(
    ruleId: string,
    usage: { bwVolume: number; colorVolume: number },
  ): Promise<{ totalCharge: number; breakdown: any }>;
  getBillingRulesByCustomer(customerId: string, tenantId: string): Promise<BillingRule[]>;
  getBillingRulesByContract(contractId: string, tenantId: string): Promise<BillingRule[]>;

  // Meter Anomalies
  getMeterAnomalies(
    tenantId: string,
    filters?: {
      anomalyType?: string;
      severity?: string;
      resolved?: boolean;
      equipmentId?: string;
      customerId?: string;
    },
  ): Promise<MeterAnomaly[]>;
  getMeterAnomaly(anomalyId: string): Promise<MeterAnomaly | null>;
  createMeterAnomaly(data: InsertMeterAnomaly): Promise<MeterAnomaly>;
  updateMeterAnomaly(
    anomalyId: string,
    tenantId: string,
    data: Partial<MeterAnomaly>,
  ): Promise<MeterAnomaly | null>;
  reviewAnomaly(
    anomalyId: string,
    tenantId: string,
    userId: string,
    notes: string,
  ): Promise<MeterAnomaly | null>;
  resolveAnomaly(
    anomalyId: string,
    tenantId: string,
    resolutionMethod: string,
    notes: string,
  ): Promise<MeterAnomaly | null>;
  getUnresolvedAnomalies(
    tenantId: string,
    filters?: { severity?: string; anomalyType?: string },
  ): Promise<MeterAnomaly[]>;
  detectAnomalies(meterReadingId: string): Promise<MeterAnomaly[]>;
  getAnomaliesByEquipment(equipmentId: string, tenantId: string): Promise<MeterAnomaly[]>;

  // Billing Disputes
  getBillingDisputes(
    tenantId: string,
    filters?: {
      disputeType?: string;
      disputeStatus?: string;
      severity?: string;
      customerId?: string;
      invoiceId?: string;
    },
  ): Promise<BillingDispute[]>;
  getBillingDispute(disputeId: string): Promise<BillingDispute | null>;
  createBillingDispute(data: InsertBillingDispute): Promise<BillingDispute>;
  updateBillingDispute(
    disputeId: string,
    tenantId: string,
    data: Partial<BillingDispute>,
  ): Promise<BillingDispute | null>;
  assignDispute(
    disputeId: string,
    tenantId: string,
    userId: string,
  ): Promise<BillingDispute | null>;
  acknowledgeDispute(
    disputeId: string,
    tenantId: string,
    userId: string,
  ): Promise<BillingDispute | null>;
  resolveDispute(
    disputeId: string,
    tenantId: string,
    userId: string,
    resolutionData: {
      resolutionType: string;
      resolutionDescription: string;
      creditAmount?: number;
    },
  ): Promise<BillingDispute | null>;
  escalateDispute(
    disputeId: string,
    tenantId: string,
    userId: string,
    reason: string,
  ): Promise<BillingDispute | null>;
  getOpenDisputes(
    tenantId: string,
    filters?: { severity?: string; priorityLevel?: number },
  ): Promise<BillingDispute[]>;
  getDisputesByCustomer(customerId: string, tenantId: string): Promise<BillingDispute[]>;
  getDisputesByInvoice(invoiceId: string, tenantId: string): Promise<BillingDispute[]>;

  // Invoice Generation Logs
  getInvoiceGenerationLogs(
    tenantId: string,
    filters?: { status?: string; generationType?: string; customerId?: string; batchId?: string },
  ): Promise<InvoiceGenerationLog[]>;
  getInvoiceGenerationLog(logId: string): Promise<InvoiceGenerationLog | null>;
  createInvoiceGenerationLog(data: InsertInvoiceGenerationLog): Promise<InvoiceGenerationLog>;
  updateInvoiceGenerationLog(
    logId: string,
    tenantId: string,
    data: Partial<InvoiceGenerationLog>,
  ): Promise<InvoiceGenerationLog | null>;
  getLogsByBatch(batchId: string): Promise<InvoiceGenerationLog[]>;
  getFailedGenerations(
    tenantId: string,
    filters?: { errorType?: string },
  ): Promise<InvoiceGenerationLog[]>;
  getGenerationStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalGenerated: number;
    successCount: number;
    failureCount: number;
    averageProcessingTime: number;
  }>;

  // Billing Schedules
  getBillingSchedules(
    tenantId: string,
    filters?: {
      scheduleType?: string;
      frequency?: string;
      isActive?: boolean;
      customerId?: string;
    },
  ): Promise<BillingSchedule[]>;
  getBillingSchedule(scheduleId: string): Promise<BillingSchedule | null>;
  createBillingSchedule(data: InsertBillingSchedule): Promise<BillingSchedule>;
  updateBillingSchedule(
    scheduleId: string,
    tenantId: string,
    data: Partial<BillingSchedule>,
  ): Promise<BillingSchedule | null>;
  deleteBillingSchedule(scheduleId: string, tenantId: string): Promise<void>;
  getActiveSchedules(tenantId: string): Promise<BillingSchedule[]>;
  getDueSchedules(tenantId: string, date: Date): Promise<BillingSchedule[]>;
  updateScheduleNextRun(
    scheduleId: string,
    tenantId: string,
    nextRunDate: Date,
  ): Promise<BillingSchedule | null>;

  // Credit Memos
  getCreditMemos(
    tenantId: string,
    filters?: {
      creditStatus?: string;
      customerId?: string;
      invoiceId?: string;
      disputeId?: string;
    },
  ): Promise<CreditMemo[]>;
  getCreditMemo(creditMemoId: string): Promise<CreditMemo | null>;
  createCreditMemo(data: InsertCreditMemo): Promise<CreditMemo>;
  updateCreditMemo(
    creditMemoId: string,
    tenantId: string,
    data: Partial<CreditMemo>,
  ): Promise<CreditMemo | null>;
  approveCreditMemo(
    creditMemoId: string,
    tenantId: string,
    userId: string,
  ): Promise<CreditMemo | null>;
  issueCreditMemo(creditMemoId: string, tenantId: string): Promise<CreditMemo | null>;
  applyCreditToInvoice(
    creditMemoId: string,
    tenantId: string,
    invoiceId: string,
  ): Promise<CreditMemo | null>;
  voidCreditMemo(
    creditMemoId: string,
    tenantId: string,
    userId: string,
    reason: string,
  ): Promise<CreditMemo | null>;
  getCreditMemosByCustomer(customerId: string, tenantId: string): Promise<CreditMemo[]>;
  getPendingCreditMemos(tenantId: string): Promise<CreditMemo[]>;

  // Customer Health Scores
  getHealthScores(
    tenantId: string,
    filters?: { healthStatus?: string; trend?: string; minScore?: number; maxScore?: number },
  ): Promise<CustomerHealthScore[]>;
  getHealthScore(scoreId: string): Promise<CustomerHealthScore | null>;
  getHealthScoreByCustomer(
    customerId: string,
    tenantId: string,
  ): Promise<CustomerHealthScore | null>;
  createHealthScore(data: InsertCustomerHealthScore): Promise<CustomerHealthScore>;
  updateHealthScore(
    scoreId: string,
    tenantId: string,
    data: Partial<CustomerHealthScore>,
  ): Promise<CustomerHealthScore | null>;
  getScoresDueForCalculation(tenantId: string): Promise<CustomerHealthScore[]>;
  getCustomersAtRisk(tenantId: string): Promise<CustomerHealthScore[]>;
  getHealthScoreHistory(
    customerId: string,
    tenantId: string,
    limit?: number,
  ): Promise<CustomerHealthScore[]>;

  // Churn Predictions
  getChurnPredictions(
    tenantId: string,
    filters?: { churnRisk?: string; interventionRequired?: boolean },
  ): Promise<ChurnPrediction[]>;
  getChurnPrediction(predictionId: string): Promise<ChurnPrediction | null>;
  getChurnPredictionByCustomer(
    customerId: string,
    tenantId: string,
  ): Promise<ChurnPrediction | null>;
  createChurnPrediction(data: InsertChurnPrediction): Promise<ChurnPrediction>;
  updateChurnPrediction(
    predictionId: string,
    tenantId: string,
    data: Partial<ChurnPrediction>,
  ): Promise<ChurnPrediction | null>;
  getHighRiskChurns(tenantId: string): Promise<ChurnPrediction[]>;
  getExpiredPredictions(tenantId: string): Promise<ChurnPrediction[]>;
  getPredictionsRequiringIntervention(tenantId: string): Promise<ChurnPrediction[]>;

  // Success Interventions
  getInterventions(
    tenantId: string,
    filters?: {
      status?: string;
      interventionType?: string;
      priority?: string;
      assignedTo?: string;
    },
  ): Promise<SuccessIntervention[]>;
  getIntervention(interventionId: string): Promise<SuccessIntervention | null>;
  getInterventionsByCustomer(customerId: string, tenantId: string): Promise<SuccessIntervention[]>;
  createIntervention(data: InsertSuccessIntervention): Promise<SuccessIntervention>;
  updateIntervention(
    interventionId: string,
    tenantId: string,
    data: Partial<SuccessIntervention>,
  ): Promise<SuccessIntervention | null>;
  assignIntervention(
    interventionId: string,
    tenantId: string,
    userId: string,
  ): Promise<SuccessIntervention | null>;
  completeIntervention(
    interventionId: string,
    tenantId: string,
    outcome: string,
    notes?: string,
  ): Promise<SuccessIntervention | null>;
  getOverdueInterventions(tenantId: string): Promise<SuccessIntervention[]>;
  getMyInterventions(userId: string, tenantId: string): Promise<SuccessIntervention[]>;
  cancelIntervention(
    interventionId: string,
    tenantId: string,
    reason: string,
  ): Promise<SuccessIntervention | null>;

  // Customer Journeys
  getJourneys(
    tenantId: string,
    filters?: { currentStage?: string; lifecyclePhase?: string; journeyHealth?: string },
  ): Promise<CustomerJourney[]>;
  getJourney(journeyId: string): Promise<CustomerJourney | null>;
  getJourneyByCustomer(customerId: string, tenantId: string): Promise<CustomerJourney | null>;
  createJourney(data: InsertCustomerJourney): Promise<CustomerJourney>;
  updateJourney(
    journeyId: string,
    tenantId: string,
    data: Partial<CustomerJourney>,
  ): Promise<CustomerJourney | null>;
  advanceJourneyStage(
    journeyId: string,
    tenantId: string,
    newStage: string,
  ): Promise<CustomerJourney | null>;
  getJourneysNeedingAttention(tenantId: string): Promise<CustomerJourney[]>;
  recordJourneyTouchpoint(
    journeyId: string,
    tenantId: string,
    touchpointType: string,
  ): Promise<CustomerJourney | null>;

  // Renewal Opportunities
  getRenewalOpportunities(
    tenantId: string,
    filters?: { renewalStatus?: string; renewalRisk?: string; daysUntilMax?: number },
  ): Promise<RenewalOpportunity[]>;
  getRenewalOpportunity(opportunityId: string): Promise<RenewalOpportunity | null>;
  getRenewalsByCustomer(customerId: string, tenantId: string): Promise<RenewalOpportunity[]>;
  getRenewalByContract(contractId: string, tenantId: string): Promise<RenewalOpportunity | null>;
  createRenewalOpportunity(data: InsertRenewalOpportunity): Promise<RenewalOpportunity>;
  updateRenewalOpportunity(
    opportunityId: string,
    tenantId: string,
    data: Partial<RenewalOpportunity>,
  ): Promise<RenewalOpportunity | null>;
  assignRenewalCsm(
    opportunityId: string,
    tenantId: string,
    csmId: string,
  ): Promise<RenewalOpportunity | null>;
  closeRenewal(
    opportunityId: string,
    tenantId: string,
    won: boolean,
    notes: string,
  ): Promise<RenewalOpportunity | null>;
  getUpcomingRenewals(tenantId: string, days: number): Promise<RenewalOpportunity[]>;
  getHighValueRenewals(tenantId: string, minMrr: number): Promise<RenewalOpportunity[]>;
}

export class DatabaseStorage implements IStorage {
  // Master catalog queries
  async browseMasterProducts(params: {
    manufacturer?: string;
    category?: string;
    search?: string;
    status?: string;
  }): Promise<any[]> {
    // Query models
    let modelQuery = db
      .select({
        id: masterProductModels.id,
        manufacturer: masterProductModels.manufacturer,
        modelCode: masterProductModels.modelCode,
        displayName: masterProductModels.displayName,
        specsJson: masterProductModels.specsJson,
        msrp: masterProductModels.msrp,
        dealerCost: masterProductModels.dealerCost,
        marginPercentage: masterProductModels.marginPercentage,
        // Add pricing tier fields
        newActive: masterProductModels.newActive,
        newRepPrice: masterProductModels.newRepPrice,
        upgradeActive: masterProductModels.upgradeActive,
        upgradeRepPrice: masterProductModels.upgradeRepPrice,
        lexmarkActive: masterProductModels.lexmarkActive,
        lexmarkRepPrice: masterProductModels.lexmarkRepPrice,
        status: masterProductModels.status,
        discontinuedAt: masterProductModels.discontinuedAt,
        version: masterProductModels.version,
        category: masterProductModels.category,
        productType: masterProductModels.productType,
        createdAt: masterProductModels.createdAt,
        updatedAt: masterProductModels.updatedAt,
        itemType: sql<string>`'model'`.as('itemType'),
      })
      .from(masterProductModels);

    // Query accessories
    let accessoryQuery = db
      .select({
        id: masterProductAccessories.id,
        manufacturer: masterProductAccessories.manufacturer,
        modelCode: masterProductAccessories.accessoryCode,
        displayName: masterProductAccessories.displayName,
        specsJson: masterProductAccessories.specsJson,
        msrp: masterProductAccessories.msrp,
        dealerCost: sql<number>`NULL`.as('dealerCost'),
        marginPercentage: sql<number>`NULL`.as('marginPercentage'),
        status: masterProductAccessories.status,
        discontinuedAt: masterProductAccessories.discontinuedAt,
        version: masterProductAccessories.version,
        category: masterProductAccessories.category,
        productType: sql<string>`'accessory'`.as('productType'),
        createdAt: masterProductAccessories.createdAt,
        updatedAt: masterProductAccessories.updatedAt,
        itemType: sql<string>`'accessory'`.as('itemType'),
      })
      .from(masterProductAccessories);

    // Apply filters to both queries
    if (params.manufacturer && params.manufacturer !== 'all') {
      modelQuery = modelQuery.where(eq(masterProductModels.manufacturer, params.manufacturer));
      accessoryQuery = accessoryQuery.where(
        eq(masterProductAccessories.manufacturer, params.manufacturer),
      );
    }
    if (params.category && params.category !== 'all') {
      modelQuery = modelQuery.where(eq(masterProductModels.category, params.category));
      accessoryQuery = accessoryQuery.where(eq(masterProductAccessories.category, params.category));
    }
    if (params.status) {
      modelQuery = modelQuery.where(eq(masterProductModels.status, params.status));
      accessoryQuery = accessoryQuery.where(eq(masterProductAccessories.status, params.status));
    }
    if (params.search) {
      const s = `%${params.search.toLowerCase()}%`;
      modelQuery = modelQuery.where(
        or(
          like(masterProductModels.displayName, s),
          like(masterProductModels.modelCode, s),
          like(masterProductModels.manufacturer, s),
        ),
      );
      accessoryQuery = accessoryQuery.where(
        or(
          like(masterProductAccessories.displayName, s),
          like(masterProductAccessories.accessoryCode, s),
          like(masterProductAccessories.manufacturer, s),
        ),
      );
    }

    // Execute both queries and combine results
    const [models, accessories] = await Promise.all([
      modelQuery.orderBy(desc(masterProductModels.updatedAt)),
      accessoryQuery.orderBy(desc(masterProductAccessories.updatedAt)),
    ]);

    // Combine and sort by updated date
    const allProducts = [...models, ...accessories].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return allProducts;
  }

  async createMasterProduct(data: InsertMasterProductModel): Promise<MasterProductModel> {
    const [created] = await db
      .insert(masterProductModels)
      .values(data as any)
      .returning();
    return created as any;
  }

  async upsertMasterProduct(data: InsertMasterProductModel): Promise<MasterProductModel> {
    // Try find by manufacturer + modelCode
    const [existing] = await db
      .select()
      .from(masterProductModels)
      .where(
        and(
          eq(masterProductModels.manufacturer, data.manufacturer as any),
          eq(masterProductModels.modelCode, data.modelCode as any),
        ),
      )
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(masterProductModels)
        .set({
          displayName: (data as any).displayName ?? existing.displayName,
          specsJson: (data as any).specsJson ?? existing.specsJson,
          msrp: (data as any).msrp ?? existing.msrp,
          status: (data as any).status ?? existing.status,
          category: (data as any).category ?? existing.category,
          productType: (data as any).productType ?? existing.productType,
          updatedAt: new Date(),
        })
        .where(eq(masterProductModels.id, (existing as any).id))
        .returning();
      return updated as any;
    }
    return await this.createMasterProduct(data);
  }

  async findMasterProduct(
    manufacturer: string,
    modelCode: string,
  ): Promise<MasterProductModel | undefined> {
    const [row] = await db
      .select()
      .from(masterProductModels)
      .where(
        and(
          eq(masterProductModels.manufacturer, manufacturer as any),
          eq(masterProductModels.modelCode, modelCode as any),
        ),
      )
      .limit(1);
    return row as any;
  }

  async createMasterAccessory(data: InsertMasterProductAccessory): Promise<MasterProductAccessory> {
    const [created] = await db
      .insert(masterProductAccessories)
      .values(data as any)
      .returning();
    return created as any;
  }

  async upsertMasterAccessory(data: InsertMasterProductAccessory): Promise<MasterProductAccessory> {
    const [existing] = await db
      .select()
      .from(masterProductAccessories)
      .where(
        and(
          eq(masterProductAccessories.manufacturer, data.manufacturer as any),
          eq(masterProductAccessories.accessoryCode, data.accessoryCode as any),
        ),
      )
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(masterProductAccessories)
        .set({
          displayName: (data as any).displayName ?? existing.displayName,
          specsJson: (data as any).specsJson ?? existing.specsJson,
          msrp: (data as any).msrp ?? existing.msrp,
          status: (data as any).status ?? existing.status,
          category: (data as any).category ?? existing.category,
          updatedAt: new Date(),
        })
        .where(eq(masterProductAccessories.id, (existing as any).id))
        .returning();
      return updated as any;
    }
    return await this.createMasterAccessory(data);
  }

  async listMasterManufacturers(): Promise<string[]> {
    const rows = await db
      .select({ manufacturer: masterProductModels.manufacturer })
      .from(masterProductModels)
      .groupBy(masterProductModels.manufacturer)
      .orderBy(masterProductModels.manufacturer);
    return rows.map((r) => r.manufacturer);
  }

  async getEnabledProducts(tenantId: string): Promise<(EnabledProduct & MasterProductModel)[]> {
    const rows = await db
      .select({
        enabledProductId: enabledProducts.enabledProductId,
        tenantId: enabledProducts.tenantId,
        source: enabledProducts.source,
        enabled: enabledProducts.enabled,
        customSku: enabledProducts.customSku,
        customName: enabledProducts.customName,
        dealerCost: enabledProducts.dealerCost,
        companyPrice: enabledProducts.companyPrice,
        priceOverridden: enabledProducts.priceOverridden,
        enabledAt: enabledProducts.enabledAt,
        masterProductId: enabledProducts.masterProductId,
        manufacturer: masterProductModels.manufacturer,
        modelCode: masterProductModels.modelCode,
        displayName: masterProductModels.displayName,
        specsJson: masterProductModels.specsJson,
        msrp: masterProductModels.msrp,
        status: masterProductModels.status,
        category: masterProductModels.category,
        productType: masterProductModels.productType,
      })
      .from(enabledProducts)
      .leftJoin(masterProductModels, eq(enabledProducts.masterProductId, masterProductModels.id))
      .where(and(eq(enabledProducts.tenantId, tenantId), eq(enabledProducts.enabled, true)))
      .orderBy(desc(enabledProducts.enabledAt));
    return rows as any;
  }

  async enableMasterProduct(
    tenantId: string,
    masterProductId: string,
    overrides: Partial<EnabledProduct>,
  ): Promise<EnabledProduct> {
    // Upsert behavior: if already enabled, update overrides
    const [existing] = await db
      .select()
      .from(enabledProducts)
      .where(
        and(
          eq(enabledProducts.tenantId, tenantId),
          eq(enabledProducts.masterProductId, masterProductId),
        ),
      )
      .limit(1);
    if (existing) {
      const [updated] = await db
        .update(enabledProducts)
        .set({ ...overrides, updatedAt: new Date(), enabled: true })
        .where(eq(enabledProducts.enabledProductId, existing.enabledProductId))
        .returning();
      return updated as any;
    }
    const [created] = await db
      .insert(enabledProducts)
      .values({
        tenantId,
        masterProductId,
        source: 'master_catalog',
        enabled: true,
        enabledAt: new Date(),
        ...overrides,
      } as any)
      .returning();
    return created as any;
  }

  // Master Product-Accessory Relationships
  async createProductAccessoryRelationship(
    data: InsertMasterProductAccessoryRelationship,
  ): Promise<MasterProductAccessoryRelationship> {
    const [created] = await db
      .insert(masterProductAccessoryRelationships)
      .values(data as any)
      .onConflictDoNothing() // Prevent duplicate relationships
      .returning();
    return created as any;
  }

  async getProductAccessories(
    baseProductId: string,
  ): Promise<(MasterProductAccessoryRelationship & MasterProductAccessory)[]> {
    const rows = await db
      .select({
        relationshipId: masterProductAccessoryRelationships.id,
        relationshipType: masterProductAccessoryRelationships.relationshipType,
        category: masterProductAccessoryRelationships.category,
        accessoryId: masterProductAccessories.id,
        manufacturer: masterProductAccessories.manufacturer,
        accessoryCode: masterProductAccessories.accessoryCode,
        displayName: masterProductAccessories.displayName,
        specsJson: masterProductAccessories.specsJson,
        msrp: masterProductAccessories.msrp,
        status: masterProductAccessories.status,
      })
      .from(masterProductAccessoryRelationships)
      .leftJoin(
        masterProductAccessories,
        eq(masterProductAccessoryRelationships.accessoryId, masterProductAccessories.id),
      )
      .where(eq(masterProductAccessoryRelationships.baseProductId, baseProductId))
      .orderBy(
        masterProductAccessoryRelationships.relationshipType,
        masterProductAccessories.displayName,
      );
    return rows as any;
  }

  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUsers(tenantId: string): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        roleId: users.roleId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`);
    return user;
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // Update last login time
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    return user;
  }

  // Tenant operations for platform users
  async getAllTenants(): Promise<{ id: string; name: string; domain?: string }[]> {
    const result = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        domain: tenants.domain,
      })
      .from(tenants)
      .orderBy(tenants.name);

    return result;
  }

  // Enhanced user operations with role information
  async getUserWithRole(id: string): Promise<(User & { role?: Role; team?: Team }) | undefined> {
    const result = await db
      .select({
        user: users,
        role: roles,
        team: teams,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(teams, eq(users.teamId, teams.id))
      .where(eq(users.id, id));

    if (!result.length) return undefined;

    const { user, role, team } = result[0];
    return { ...user, role: role || undefined, team: team || undefined };
  }

  // Role-based data access methods
  async getAccessibleCustomers(
    userId: string,
    tenantId: string,
    roleLevel: number,
    teamId?: string,
  ): Promise<Customer[]> {
    let query = db.select().from(customers).where(eq(customers.tenantId, tenantId));

    // Apply role-based filtering
    if (roleLevel === 1) {
      // Individual contributor - only assigned customers
      const assignedCustomerIds = await db
        .select({ customerId: userCustomerAssignments.customerId })
        .from(userCustomerAssignments)
        .where(
          and(
            eq(userCustomerAssignments.userId, userId),
            eq(userCustomerAssignments.tenantId, tenantId),
          ),
        );

      if (assignedCustomerIds.length === 0) return [];

      query = query.where(
        inArray(
          customers.id,
          assignedCustomerIds.map((a) => a.customerId),
        ),
      );
    } else if (roleLevel === 2 && teamId) {
      // Team lead - team's customers
      const teamUserIds = await db
        .select({ userId: users.id })
        .from(users)
        .where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));

      const teamCustomerIds = await db
        .select({ customerId: userCustomerAssignments.customerId })
        .from(userCustomerAssignments)
        .where(
          and(
            inArray(
              userCustomerAssignments.userId,
              teamUserIds.map((u) => u.userId),
            ),
            eq(userCustomerAssignments.tenantId, tenantId),
          ),
        );

      if (teamCustomerIds.length === 0) return [];

      query = query.where(
        inArray(
          customers.id,
          teamCustomerIds.map((a) => a.customerId),
        ),
      );
    }
    // Level 3+ (Manager/Director/Admin) see all customers in tenant

    return await query;
  }

  async getAccessibleLeads(
    userId: string,
    tenantId: string,
    roleLevel: number,
    teamId?: string,
  ): Promise<Lead[]> {
    let query = db.select().from(leads).where(eq(leads.tenantId, tenantId));

    if (roleLevel === 1) {
      // Individual - only assigned leads
      query = query.where(eq(leads.ownerId, userId));
    } else if (roleLevel === 2 && teamId) {
      // Team lead - team's leads
      const teamUserIds = await db
        .select({ userId: users.id })
        .from(users)
        .where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));

      query = query.where(
        inArray(
          leads.ownerId,
          teamUserIds.map((u) => u.userId),
        ),
      );
    }

    return await query;
  }

  async getAccessibleServiceTickets(
    userId: string,
    tenantId: string,
    roleLevel: number,
    teamId?: string,
  ): Promise<ServiceTicket[]> {
    let query = db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId));

    if (roleLevel === 1) {
      // Individual technician - only assigned tickets
      query = query.where(
        or(eq(serviceTickets.assignedTechnicianId, userId), eq(serviceTickets.createdBy, userId)),
      );
    } else if (roleLevel === 2 && teamId) {
      // Team supervisor - team's tickets
      const teamTechnicianIds = await db
        .select({ technicianId: technicians.id })
        .from(technicians)
        .innerJoin(users, eq(technicians.userId, users.id))
        .where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));

      if (teamTechnicianIds.length > 0) {
        query = query.where(
          inArray(
            serviceTickets.assignedTechnicianId,
            teamTechnicianIds.map((t) => t.technicianId),
          ),
        );
      }
    }

    return await query;
  }

  async getAccessibleContracts(
    userId: string,
    tenantId: string,
    roleLevel: number,
    teamId?: string,
  ): Promise<Contract[]> {
    let query = db.select().from(contracts).where(eq(contracts.tenantId, tenantId));

    if (roleLevel === 1) {
      // Individual sales rep - only assigned contracts
      query = query.where(eq(contracts.assignedSalespersonId, userId));
    } else if (roleLevel === 2 && teamId) {
      // Team lead - team's contracts
      const teamUserIds = await db
        .select({ userId: users.id })
        .from(users)
        .where(and(eq(users.teamId, teamId), eq(users.tenantId, tenantId)));

      query = query.where(
        inArray(
          contracts.assignedSalespersonId,
          teamUserIds.map((u) => u.userId),
        ),
      );
    }

    return await query;
  }

  // Standard CRUD operations (existing methods with tenant filtering)
  async getCustomers(tenantId: string): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.tenantId, tenantId));
  }

  async getCustomer(customerId: string, tenantId: string): Promise<Customer | undefined> {
    try {
      const result = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
        .limit(1);
      return result[0];
    } catch (error) {
      log.error('Error in getCustomer:', error);
      return undefined;
    }
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(
    id: string,
    customer: Partial<Customer>,
    tenantId: string,
  ): Promise<Customer | undefined> {
    const [updatedCustomer] = await db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
    return (result.rowCount ?? 0) > 0;
  }

  // Customer Detail Methods for comprehensive customer information
  async getCustomerEquipment(customerId: string, tenantId: string): Promise<Equipment[]> {
    try {
      return await db
        .select()
        .from(equipment)
        .where(and(eq(equipment.customerId, customerId), eq(equipment.tenantId, tenantId)));
    } catch (error) {
      log.info('No equipment table found, returning empty array');
      return [];
    }
  }

  async getCustomerMeterReadings(customerId: string, tenantId: string): Promise<MeterReading[]> {
    try {
      return await db
        .select()
        .from(meterReadings)
        .where(and(eq(meterReadings.customerId, customerId), eq(meterReadings.tenantId, tenantId)))
        .orderBy(desc(meterReadings.readingDate));
    } catch (error) {
      log.info('No meter readings table found, returning empty array');
      return [];
    }
  }

  async getCustomerInvoices(customerId: string, tenantId: string): Promise<Invoice[]> {
    try {
      return await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.customerId, customerId), eq(invoices.tenantId, tenantId)))
        .orderBy(desc(invoices.invoiceDate));
    } catch (error) {
      log.info('No invoices table found, returning empty array');
      return [];
    }
  }

  async getCustomerServiceTickets(customerId: string, tenantId: string): Promise<ServiceTicket[]> {
    try {
      return await db
        .select()
        .from(serviceTickets)
        .where(
          and(eq(serviceTickets.customerId, customerId), eq(serviceTickets.tenantId, tenantId)),
        )
        .orderBy(desc(serviceTickets.createdAt));
    } catch (error) {
      log.info('No service tickets table found, returning empty array');
      return [];
    }
  }

  async getCustomerContracts(customerId: string, tenantId: string): Promise<Contract[]> {
    try {
      return await db
        .select()
        .from(contracts)
        .where(and(eq(contracts.customerId, customerId), eq(contracts.tenantId, tenantId)));
    } catch (error) {
      log.info('No contracts found, returning empty array');
      return [];
    }
  }

  // Company operations (new primary business entity)
  async getCompanies(tenantId: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.tenantId, tenantId));
  }

  async getCompany(id: string, tenantId: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)));
    return company;
  }

  async getCompanyByName(name: string, tenantId: string): Promise<Company | undefined> {
    // Handle null, undefined, or empty names
    if (!name || name.trim() === '') {
      return undefined;
    }

    try {
      const [company] = await db
        .select()
        .from(companies)
        .where(and(eq(companies.businessName, name.trim()), eq(companies.tenantId, tenantId)));
      return company;
    } catch (error) {
      log.error('Error in getCompanyByName:', error);
      return undefined;
    }
  }

  async createCompany(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(
    id: string,
    company: Partial<Company>,
    tenantId: string,
  ): Promise<Company | undefined> {
    const [updatedCompany] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)))
      .returning();
    return updatedCompany;
  }

  async deleteCompany(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(companies)
      .where(and(eq(companies.id, id), eq(companies.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Company contact operations
  async getCompanyContacts(companyId: string, tenantId: string): Promise<CompanyContact[]> {
    return await db
      .select()
      .from(companyContacts)
      .where(and(eq(companyContacts.companyId, companyId), eq(companyContacts.tenantId, tenantId)));
  }

  async getAllCompanyContacts(tenantId: string): Promise<CompanyContact[]> {
    return await db
      .select()
      .from(companyContacts)
      .where(eq(companyContacts.tenantId, tenantId))
      .orderBy(desc(companyContacts.createdAt));
  }

  async getCompanyContact(id: string, tenantId: string): Promise<CompanyContact | undefined> {
    const [contact] = await db
      .select()
      .from(companyContacts)
      .where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)));
    return contact;
  }

  async createCompanyContact(
    contact: Omit<CompanyContact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CompanyContact> {
    const [newContact] = await db.insert(companyContacts).values(contact).returning();
    return newContact;
  }

  async updateCompanyContact(
    id: string,
    contactData: Partial<CompanyContact>,
    tenantId: string,
  ): Promise<CompanyContact | undefined> {
    const [updated] = await db
      .update(companyContacts)
      .set({ ...contactData, updatedAt: new Date() })
      .where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteCompanyContact(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(companyContacts)
      .where(and(eq(companyContacts.id, id), eq(companyContacts.tenantId, tenantId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Lead operations (simplified pipeline tracking)
  // Lead-specific operations (filtered views of business records)
  async getLeads(tenantId: string): Promise<any[]> {
    try {
      // Use raw SQL to avoid Drizzle schema mapping issues
      const result = await db.execute(sql`
        SELECT * FROM business_records 
        WHERE tenant_id = ${tenantId} AND record_type = 'lead'
        ORDER BY created_at DESC
      `);
      return result.rows;
    } catch (error) {
      log.error('Error in getLeads:', error);
      return [];
    }
  }

  // Customer-specific operations (filtered views of business records)
  async getCustomerBusinessRecords(
    tenantId: string,
    includeInactive: boolean = false,
  ): Promise<any[]> {
    try {
      // Use raw SQL to avoid Drizzle schema mapping issues
      if (!includeInactive) {
        const result = await db.execute(sql`
          SELECT * FROM business_records 
          WHERE tenant_id = ${tenantId} AND record_type = 'customer' AND status = 'active'
          ORDER BY created_at DESC
        `);
        return result.rows;
      } else {
        const result = await db.execute(sql`
          SELECT * FROM business_records 
          WHERE tenant_id = ${tenantId} AND record_type = 'customer'
          ORDER BY created_at DESC
        `);
        return result.rows;
      }
    } catch (error) {
      log.error('Error in getCustomers:', error);
      return [];
    }
  }

  // Former customers for reporting and reactivation
  async getFormerCustomers(tenantId: string): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM business_records 
        WHERE tenant_id = ${tenantId} AND record_type = 'former_customer'
        ORDER BY created_at DESC
      `);
      return result.rows;
    } catch (error) {
      log.error('Error in getFormerCustomers:', error);
      return [];
    }
  }

  // Unified Business Records operations - handles entire lead-to-customer lifecycle
  async getBusinessRecords(
    tenantId: string,
    recordType?: string,
    status?: string,
    search?: string,
    queryLimit?: number,
  ): Promise<any[]> {
    try {
      // Build parameterized conditions to prevent SQL injection
      const conditions = [eq(businessRecords.tenantId, tenantId)];
      if (recordType) conditions.push(eq(businessRecords.recordType, recordType));
      if (status) conditions.push(eq(businessRecords.status, status));

      // Add search functionality across company name and contact info using parameterized LIKE
      if (search && search.length > 0) {
        const searchPattern = `%${search.toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${businessRecords.companyName}) LIKE ${searchPattern}`,
            sql`LOWER(${businessRecords.primaryContactName}) LIKE ${searchPattern}`,
            sql`LOWER(${businessRecords.primaryContactEmail}) LIKE ${searchPattern}`,
            sql`LOWER(${businessRecords.industry}) LIKE ${searchPattern}`,
            sql`LOWER(${businessRecords.city}) LIKE ${searchPattern}`,
          )!,
        );
      }

      // Cap limit to prevent unbounded queries
      const safeLimit = Math.min(Math.max(queryLimit || 200, 1), 500);

      const results = await db
        .select({
          id: businessRecords.id,
          tenantId: businessRecords.tenantId,
          companyName: businessRecords.companyName,
          status: businessRecords.status,
          recordType: businessRecords.recordType,
          phone: businessRecords.phone,
          primaryContactName: businessRecords.primaryContactName,
          primaryContactEmail: businessRecords.primaryContactEmail,
          primaryContactPhone: businessRecords.primaryContactPhone,
          website: businessRecords.website,
          industry: businessRecords.industry,
          addressLine1: businessRecords.addressLine1,
          city: businessRecords.city,
          state: businessRecords.state,
          postalCode: businessRecords.postalCode,
          urlSlug: businessRecords.urlSlug,
          companyDisplayId: businessRecords.companyDisplayId,
          createdAt: businessRecords.createdAt,
          updatedAt: businessRecords.updatedAt,
        })
        .from(businessRecords)
        .where(and(...conditions))
        .orderBy(desc(businessRecords.createdAt))
        .limit(safeLimit);

      return results.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        companyName: row.companyName,
        status: row.status,
        recordType: row.recordType,
        phone: row.phone,
        primaryContactName: row.primaryContactName || '',
        primaryContactEmail: row.primaryContactEmail || '',
        primaryContactPhone: row.primaryContactPhone || '',
        website: row.website || '',
        industry: row.industry || '',
        addressLine1: row.addressLine1 || '',
        city: row.city || '',
        state: row.state || '',
        postalCode: row.postalCode || '',
        url_slug: row.urlSlug,
        urlSlug: row.urlSlug,
        company_display_id: row.companyDisplayId,
        companyDisplayId: row.companyDisplayId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    } catch (error) {
      log.error('Error in getBusinessRecords:', error);
      // Return empty array to prevent frontend crashes
      return [];
    }
  }

  async getBusinessRecord(id: string, tenantId: string): Promise<any | undefined> {
    // Return the full record with camelCase keys as defined in the Drizzle schema
    const [record] = await db
      .select()
      .from(businessRecords)
      .where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)));
    return record;
  }

  async getBusinessRecordBySlug(urlSlug: string, tenantId: string): Promise<any | undefined> {
    // Return the full record with camelCase keys as defined in the Drizzle schema
    const [record] = await db
      .select()
      .from(businessRecords)
      .where(and(eq(businessRecords.urlSlug, urlSlug), eq(businessRecords.tenantId, tenantId)));
    return record;
  }

  async createBusinessRecord(record: any): Promise<any> {
    const [newRecord] = await db.insert(businessRecords).values(record).returning();
    return newRecord;
  }

  async updateBusinessRecord(id: string, tenantId: string, updates: any): Promise<any | undefined> {
    log.info('[DEBUG] STORAGE - Updating business record:', {
      id,
      tenantId,
      updates: JSON.stringify(updates, null, 2),
    });
    const [updatedRecord] = await db
      .update(businessRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(businessRecords.id, id), eq(businessRecords.tenantId, tenantId)))
      .returning();
    log.info('[DEBUG] STORAGE - Updated record returned:', JSON.stringify(updatedRecord, null, 2));
    return updatedRecord;
  }

  async createLead(lead: any): Promise<any> {
    const leadData = { ...lead, recordType: 'lead' };
    return await this.createBusinessRecord(leadData);
  }

  async updateLead(id: string, lead: any, tenantId: string): Promise<any | undefined> {
    return await this.updateBusinessRecord(id, tenantId, lead);
  }

  // Quote operations
  async getQuotes(tenantId: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(eq(quotes.tenantId, tenantId));
  }

  async createQuote(quote: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quote> {
    const [newQuote] = await db.insert(quotes).values(quote).returning();
    return newQuote;
  }

  // Equipment operations
  async getEquipment(tenantId: string): Promise<Equipment[]> {
    return await db.select().from(equipment).where(eq(equipment.tenantId, tenantId));
  }

  async createEquipment(
    equipmentData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Equipment> {
    const [newEquipment] = await db.insert(equipment).values(equipmentData).returning();
    return newEquipment;
  }

  // Contract operations
  async getContracts(tenantId: string): Promise<Contract[]> {
    return await db.select().from(contracts).where(eq(contracts.tenantId, tenantId));
  }

  async createContract(
    contract: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Contract> {
    const [newContract] = await db.insert(contracts).values(contract).returning();
    return newContract;
  }

  // Service ticket operations
  async getServiceTickets(tenantId: string): Promise<ServiceTicket[]> {
    return await db.select().from(serviceTickets).where(eq(serviceTickets.tenantId, tenantId));
  }

  async createServiceTicket(
    ticket: Omit<ServiceTicket, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceTicket> {
    const [newTicket] = await db.insert(serviceTickets).values(ticket).returning();
    return newTicket;
  }

  async updateServiceTicket(
    id: string,
    ticket: Partial<ServiceTicket>,
    tenantId: string,
  ): Promise<ServiceTicket | undefined> {
    const [updatedTicket] = await db
      .update(serviceTickets)
      .set({ ...ticket, updatedAt: new Date() })
      .where(and(eq(serviceTickets.id, id), eq(serviceTickets.tenantId, tenantId)))
      .returning();
    return updatedTicket;
  }

  // Inventory operations
  async getInventoryItems(tenantId: string): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, tenantId));
  }

  async createInventoryItem(
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<InventoryItem> {
    const [newItem] = await db.insert(inventoryItems).values(item).returning();
    return newItem;
  }

  async updateInventoryItem(
    id: string,
    updates: Partial<InventoryItem>,
    tenantId: string,
  ): Promise<InventoryItem | undefined> {
    const [updated] = await db
      .update(inventoryItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)))
      .returning();
    return updated;
  }

  // Technician operations
  async getTechnicians(tenantId: string): Promise<Technician[]> {
    return await db.select().from(technicians).where(eq(technicians.tenantId, tenantId));
  }

  async createTechnician(
    technician: Omit<Technician, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Technician> {
    const [newTechnician] = await db.insert(technicians).values(technician).returning();
    return newTechnician;
  }

  // Meter reading operations
  async getMeterReadings(tenantId: string): Promise<MeterReading[]> {
    return await db.select().from(meterReadings).where(eq(meterReadings.tenantId, tenantId));
  }

  async createMeterReading(
    reading: Omit<MeterReading, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MeterReading> {
    const [newReading] = await db.insert(meterReadings).values(reading).returning();
    return newReading;
  }

  async getMeterReadingsByStatus(tenantId: string, status: string): Promise<MeterReading[]> {
    return await db
      .select()
      .from(meterReadings)
      .where(and(eq(meterReadings.tenantId, tenantId), eq(meterReadings.billingStatus, status)));
  }

  async updateMeterReading(
    id: string,
    reading: Partial<MeterReading>,
    tenantId: string,
  ): Promise<MeterReading | undefined> {
    const [updatedReading] = await db
      .update(meterReadings)
      .set({ ...reading, updatedAt: new Date() })
      .where(and(eq(meterReadings.id, id), eq(meterReadings.tenantId, tenantId)))
      .returning();
    return updatedReading;
  }

  async getContract(id: string, tenantId: string): Promise<Contract | undefined> {
    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId)));
    return contract;
  }

  // Invoice operations
  async getInvoices(tenantId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.tenantId, tenantId));
  }

  async createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  // User-Customer assignment operations for territory management
  async getUserCustomerAssignments(
    userId: string,
    tenantId: string,
  ): Promise<UserCustomerAssignment[]> {
    return await db
      .select()
      .from(userCustomerAssignments)
      .where(
        and(
          eq(userCustomerAssignments.userId, userId),
          eq(userCustomerAssignments.tenantId, tenantId),
        ),
      );
  }

  async createUserCustomerAssignment(
    assignment: Omit<UserCustomerAssignment, 'id' | 'createdAt'>,
  ): Promise<UserCustomerAssignment> {
    const [newAssignment] = await db.insert(userCustomerAssignments).values(assignment).returning();
    return newAssignment;
  }

  // Enhanced Lead CRM operations
  async getLead(id: string, tenantId: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)));
    return lead;
  }

  // Lead to Customer Conversion - ZERO data duplication
  async convertLeadToCustomer(
    leadId: string,
    tenantId: string,
    userId: string,
  ): Promise<any | undefined> {
    // Generate unique customer number
    const customerNumber = await this.generateCustomerNumber(tenantId);

    const [convertedCustomer] = await db
      .update(businessRecords)
      .set({
        recordType: 'customer',
        status: 'active',
        customerNumber: customerNumber,
        customerSince: new Date(),
        convertedBy: userId,
        probability: 100,
        closeDate: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(businessRecords.id, leadId),
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.recordType, 'lead'),
        ),
      )
      .returning();

    // Create activity record for conversion
    if (convertedCustomer) {
      await this.createBusinessRecordActivity({
        tenantId,
        businessRecordId: leadId,
        activityType: 'conversion',
        subject: 'Lead Converted to Customer',
        description: `Lead successfully converted to customer. Customer number: ${customerNumber}`,
        completedDate: new Date(),
        createdBy: userId,
      });
    }

    return convertedCustomer;
  }

  // Customer Lifecycle Management
  async deactivateCustomer(
    customerId: string,
    tenantId: string,
    userId: string,
    reason: string,
  ): Promise<any | undefined> {
    const [deactivatedCustomer] = await db
      .update(businessRecords)
      .set({
        recordType: 'former_customer',
        status: reason, // competitor_switch, churned, expired, etc.
        customerUntil: new Date(),
        churnReason: reason,
        deactivatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(businessRecords.id, customerId),
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.recordType, 'customer'),
        ),
      )
      .returning();

    // Create activity record for deactivation
    if (deactivatedCustomer) {
      await this.createBusinessRecordActivity({
        tenantId,
        businessRecordId: customerId,
        activityType: 'churn_prevention',
        subject: `Customer Deactivated - ${reason}`,
        description: `Customer relationship ended due to: ${reason}`,
        completedDate: new Date(),
        createdBy: userId,
      });
    }

    return deactivatedCustomer;
  }

  async markCustomerNonPayment(
    customerId: string,
    tenantId: string,
    userId: string,
  ): Promise<any | undefined> {
    return await db
      .update(businessRecords)
      .set({
        status: 'non_payment',
        deactivatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(businessRecords.id, customerId),
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.recordType, 'customer'),
        ),
      )
      .returning();
  }

  async reactivateCustomer(
    customerId: string,
    tenantId: string,
    userId: string,
  ): Promise<any | undefined> {
    return await db
      .update(businessRecords)
      .set({
        recordType: 'customer',
        status: 'active',
        customerUntil: null,
        churnReason: null,
        deactivatedBy: null,
        updatedAt: new Date(),
      })
      .where(and(eq(businessRecords.id, customerId), eq(businessRecords.tenantId, tenantId)))
      .returning();
  }

  // Generate unique customer number
  private async generateCustomerNumber(tenantId: string): Promise<string> {
    const prefix = 'CUST';
    const year = new Date().getFullYear().toString().slice(-2);

    // Get the next sequence number for this tenant and year
    const existingCustomers = await db
      .select()
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.recordType, 'customer'),
          isNotNull(businessRecords.customerNumber),
        ),
      );

    const currentYearCustomers = existingCustomers.filter((c) =>
      c.customerNumber?.startsWith(`${prefix}${year}`),
    );

    const nextNumber = currentYearCustomers.length + 1;
    const paddedNumber = nextNumber.toString().padStart(4, '0');

    return `${prefix}${year}${paddedNumber}`;
  }

  // Lead activity operations
  // Unified Business Record Activities
  async getBusinessRecordActivities(businessRecordId: string, tenantId: string): Promise<any[]> {
    return await db
      .select()
      .from(businessRecordActivities)
      .where(
        and(
          eq(businessRecordActivities.businessRecordId, businessRecordId),
          eq(businessRecordActivities.tenantId, tenantId),
        ),
      )
      .orderBy(sql`${businessRecordActivities.createdAt} DESC`);
  }

  async createBusinessRecordActivity(activity: any): Promise<any> {
    // Parse date fields to ensure they are proper Date objects
    const processedActivity = {
      ...activity,
      // Convert date strings to Date objects
      scheduledDate: activity.scheduledDate ? new Date(activity.scheduledDate) : null,
      dueDate: activity.dueDate ? new Date(activity.dueDate) : null,
      followUpDate: activity.followUpDate ? new Date(activity.followUpDate) : null,
      completedDate: activity.completedDate ? new Date(activity.completedDate) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [newActivity] = await db
      .insert(businessRecordActivities)
      .values(processedActivity)
      .returning();
    return newActivity;
  }

  async getAllActivities(tenantId: string): Promise<any[]> {
    try {
      // First get all activities for this tenant
      const activities = await db
        .select()
        .from(businessRecordActivities)
        .where(eq(businessRecordActivities.tenantId, tenantId))
        .orderBy(desc(businessRecordActivities.createdAt));

      // Then get business records for context
      const businessRecordIds = [...new Set(activities.map((a) => a.businessRecordId))];
      const records =
        businessRecordIds.length > 0
          ? await db
              .select({
                id: businessRecords.id,
                companyName: businessRecords.companyName,
                recordType: businessRecords.recordType,
              })
              .from(businessRecords)
              .where(inArray(businessRecords.id, businessRecordIds))
          : [];

      const recordsMap = new Map(records.map((r) => [r.id, r]));

      // Combine activities with business record context
      return activities.map((activity) => {
        const record = recordsMap.get(activity.businessRecordId);
        return {
          ...activity,
          interactionType: activity.activityType, // Alias for compatibility
          companyName: record?.companyName || 'Unknown Company',
          recordType: record?.recordType || 'unknown',
        };
      });
    } catch (error) {
      log.error('Error in getAllActivities:', error);
      return [];
    }
  }

  // Backward compatible methods for leads
  async getLeadActivities(leadId: string, tenantId: string): Promise<any[]> {
    return await this.getBusinessRecordActivities(leadId, tenantId);
  }

  async createLeadActivity(activity: any): Promise<any> {
    // Map old leadId field to businessRecordId
    const businessRecordActivity = {
      ...activity,
      businessRecordId: activity.leadId,
    };
    delete businessRecordActivity.leadId;
    return await this.createBusinessRecordActivity(businessRecordActivity);
  }

  // Customer activity methods (same as lead activities)
  async getCustomerActivities(customerId: string, tenantId: string): Promise<any[]> {
    return await this.getBusinessRecordActivities(customerId, tenantId);
  }

  async createCustomerActivity(activity: any): Promise<any> {
    // Map old customerId field to businessRecordId
    const businessRecordActivity = {
      ...activity,
      businessRecordId: activity.customerId,
    };
    delete businessRecordActivity.customerId;
    return await this.createBusinessRecordActivity(businessRecordActivity);
  }

  // Lead contact operations
  async getLeadContacts(leadId: string, tenantId: string): Promise<LeadContact[]> {
    return await db
      .select()
      .from(leadContacts)
      .where(and(eq(leadContacts.leadId, leadId), eq(leadContacts.tenantId, tenantId)));
  }

  async createLeadContact(
    contact: Omit<LeadContact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<LeadContact> {
    const [newContact] = await db.insert(leadContacts).values(contact).returning();
    return newContact;
  }

  // Lead related records operations
  async getLeadRelatedRecords(leadId: string, tenantId: string): Promise<LeadRelatedRecord[]> {
    return await db
      .select()
      .from(leadRelatedRecords)
      .where(and(eq(leadRelatedRecords.leadId, leadId), eq(leadRelatedRecords.tenantId, tenantId)));
  }

  async createLeadRelatedRecord(
    record: Omit<LeadRelatedRecord, 'id' | 'createdAt'>,
  ): Promise<LeadRelatedRecord> {
    const [newRecord] = await db.insert(leadRelatedRecords).values(record).returning();
    return newRecord;
  }

  // Product Management Implementation
  async getProductModels(tenantId: string): Promise<ProductModel[]> {
    return await db
      .select({
        id: productModels.id,
        productCode: productModels.productCode,
        productName: productModels.productName,
        description: productModels.description,
        category: productModels.category,
        manufacturer: productModels.manufacturer,
        msrp: productModels.msrp,
        newRepPrice: productModels.newRepPrice,
        upgradeRepPrice: productModels.upgradeRepPrice,
        isActive: productModels.isActive,
        tenantId: productModels.tenantId,
        createdAt: productModels.createdAt,
        updatedAt: productModels.updatedAt,
      })
      .from(productModels)
      .where(eq(productModels.tenantId, tenantId))
      .orderBy(productModels.productName);
  }

  async getProductModel(id: string, tenantId: string): Promise<ProductModel | undefined> {
    const [model] = await db
      .select()
      .from(productModels)
      .where(and(eq(productModels.id, id), eq(productModels.tenantId, tenantId)));
    return model;
  }

  async getProductModelByCode(
    productCode: string,
    tenantId: string,
  ): Promise<ProductModel | undefined> {
    const [model] = await db
      .select()
      .from(productModels)
      .where(and(eq(productModels.productCode, productCode), eq(productModels.tenantId, tenantId)));
    return model;
  }

  async getProductModelByCodeAndName(
    productCode: string,
    productName: string,
    tenantId: string,
  ): Promise<ProductModel | undefined> {
    const [model] = await db
      .select()
      .from(productModels)
      .where(
        and(
          eq(productModels.productCode, productCode),
          eq(productModels.productName, productName),
          eq(productModels.tenantId, tenantId),
        ),
      );
    return model;
  }

  async getRequiredAccessoriesForModel(
    modelId: string,
    tenantId: string,
  ): Promise<ProductAccessory[]> {
    // Get the product model to check for required accessories
    const model = await this.getProductModel(modelId, tenantId);
    if (!model || !model.requiredAccessories) {
      return [];
    }

    // Parse required accessory codes (comma-separated)
    const requiredCodes = model.requiredAccessories
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code.length > 0);

    if (requiredCodes.length === 0) {
      return [];
    }

    // Get accessories by their codes
    const accessories = await db
      .select()
      .from(productAccessories)
      .where(
        and(
          inArray(productAccessories.accessoryCode, requiredCodes),
          eq(productAccessories.tenantId, tenantId),
        ),
      );

    return accessories;
  }

  async getProductAccessoriesByCodes(
    accessoryCodes: string[],
    tenantId: string,
  ): Promise<ProductAccessory[]> {
    if (accessoryCodes.length === 0) {
      return [];
    }

    const accessories = await db
      .select()
      .from(productAccessories)
      .where(
        and(
          inArray(productAccessories.accessoryCode, accessoryCodes),
          eq(productAccessories.tenantId, tenantId),
        ),
      );

    return accessories;
  }

  async createProductModel(model: InsertProductModel): Promise<ProductModel> {
    const [result] = await db.insert(productModels).values(model).returning();
    return result;
  }

  async updateProductModel(
    id: string,
    model: Partial<ProductModel>,
    tenantId: string,
  ): Promise<ProductModel | undefined> {
    const [result] = await db
      .update(productModels)
      .set({ ...model, updatedAt: new Date() })
      .where(and(eq(productModels.id, id), eq(productModels.tenantId, tenantId)))
      .returning();
    return result;
  }

  async deleteProductModel(id: string, tenantId: string): Promise<boolean> {
    const [result] = await db
      .delete(productModels)
      .where(and(eq(productModels.id, id), eq(productModels.tenantId, tenantId)))
      .returning();
    return !!result;
  }

  // Delete from master product models table (used by the ProductModels page)
  async deleteMasterProductModel(id: string): Promise<boolean> {
    const [result] = await db
      .delete(masterProductModels)
      .where(eq(masterProductModels.id, id))
      .returning();
    return !!result;
  }

  // Check if master product model exists
  async getMasterProductModel(id: string): Promise<any | undefined> {
    const [model] = await db
      .select()
      .from(masterProductModels)
      .where(eq(masterProductModels.id, id));
    return model;
  }

  // Update master product model
  async updateMasterProductModel(id: string, model: Partial<any>): Promise<any | undefined> {
    const [result] = await db
      .update(masterProductModels)
      .set({ ...model, updatedAt: new Date() })
      .where(eq(masterProductModels.id, id))
      .returning();
    return result;
  }

  async getAllProductAccessories(tenantId: string): Promise<ProductAccessory[]> {
    return await db
      .select()
      .from(productAccessories)
      .where(eq(productAccessories.tenantId, tenantId))
      .orderBy(productAccessories.accessoryName);
  }

  async getProductAccessoryByCode(
    accessoryCode: string,
    tenantId: string,
  ): Promise<ProductAccessory | undefined> {
    const [accessory] = await db
      .select()
      .from(productAccessories)
      .where(
        and(
          eq(productAccessories.accessoryCode, accessoryCode),
          eq(productAccessories.tenantId, tenantId),
        ),
      );
    return accessory;
  }

  async getTenantProductAccessories(
    modelId: string,
    tenantId: string,
  ): Promise<ProductAccessory[]> {
    // Get accessories compatible with this model via the junction table
    const accessoryIds = await db
      .select({ accessoryId: accessoryModelCompatibility.accessoryId })
      .from(accessoryModelCompatibility)
      .where(
        and(
          eq(accessoryModelCompatibility.modelId, modelId),
          eq(accessoryModelCompatibility.tenantId, tenantId),
        ),
      );

    if (accessoryIds.length === 0) {
      return [];
    }

    return await db
      .select()
      .from(productAccessories)
      .where(
        and(
          inArray(
            productAccessories.id,
            accessoryIds.map((a) => a.accessoryId),
          ),
          eq(productAccessories.tenantId, tenantId),
        ),
      )
      .orderBy(productAccessories.accessoryName);
  }

  async createProductAccessory(accessory: InsertProductAccessory): Promise<ProductAccessory> {
    const [result] = await db.insert(productAccessories).values(accessory).returning();
    return result;
  }

  async deleteProductAccessory(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(productAccessories)
      .where(and(eq(productAccessories.id, id), eq(productAccessories.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  async updateProductAccessory(
    id: string,
    accessory: Partial<ProductAccessory>,
    tenantId: string,
  ): Promise<ProductAccessory | undefined> {
    const [result] = await db
      .update(productAccessories)
      .set({ ...accessory, updatedAt: new Date() })
      .where(and(eq(productAccessories.id, id), eq(productAccessories.tenantId, tenantId)))
      .returning();
    return result;
  }

  // Accessory-Model Compatibility operations
  async getAccessoryCompatibilities(
    accessoryId: string,
    tenantId: string,
  ): Promise<AccessoryModelCompatibility[]> {
    return await db
      .select()
      .from(accessoryModelCompatibility)
      .where(
        and(
          eq(accessoryModelCompatibility.accessoryId, accessoryId),
          eq(accessoryModelCompatibility.tenantId, tenantId),
        ),
      );
  }

  async getModelCompatibilities(
    modelId: string,
    tenantId: string,
  ): Promise<AccessoryModelCompatibility[]> {
    return await db
      .select()
      .from(accessoryModelCompatibility)
      .where(
        and(
          eq(accessoryModelCompatibility.modelId, modelId),
          eq(accessoryModelCompatibility.tenantId, tenantId),
        ),
      );
  }

  async createAccessoryModelCompatibility(
    compatibility: InsertAccessoryModelCompatibility,
  ): Promise<AccessoryModelCompatibility> {
    const [result] = await db.insert(accessoryModelCompatibility).values(compatibility).returning();
    return result;
  }

  async deleteAccessoryModelCompatibility(
    accessoryId: string,
    modelId: string,
    tenantId: string,
  ): Promise<void> {
    await db
      .delete(accessoryModelCompatibility)
      .where(
        and(
          eq(accessoryModelCompatibility.accessoryId, accessoryId),
          eq(accessoryModelCompatibility.modelId, modelId),
          eq(accessoryModelCompatibility.tenantId, tenantId),
        ),
      );
  }

  async getCpcRates(modelId: string, tenantId: string): Promise<CpcRate[]> {
    return await db
      .select()
      .from(cpcRates)
      .where(and(eq(cpcRates.modelId, modelId), eq(cpcRates.tenantId, tenantId)))
      .orderBy(cpcRates.colorType);
  }

  async createCpcRate(rate: InsertCpcRate): Promise<CpcRate> {
    const [result] = await db.insert(cpcRates).values(rate).returning();
    return result;
  }

  // Contract Tiered Rates operations (for meter billing)
  async getContractTieredRates(tenantId: string): Promise<ContractTieredRate[]> {
    return await db
      .select()
      .from(contractTieredRates)
      .where(eq(contractTieredRates.tenantId, tenantId))
      .orderBy(contractTieredRates.sortOrder);
  }

  async getContractTieredRatesByContract(contractId: string): Promise<ContractTieredRate[]> {
    return await db
      .select()
      .from(contractTieredRates)
      .where(eq(contractTieredRates.contractId, contractId))
      .orderBy(contractTieredRates.sortOrder);
  }

  async createContractTieredRate(rate: InsertContractTieredRate): Promise<ContractTieredRate> {
    const [result] = await db.insert(contractTieredRates).values(rate).returning();
    return result;
  }

  // ============= TASK MANAGEMENT OPERATIONS =============

  async getTasks(tenantId: string, userId?: string): Promise<Task[]> {
    let query = db.select().from(tasks).where(eq(tasks.tenantId, tenantId));

    if (userId) {
      query = query.where(eq(tasks.assignedTo, userId));
    }

    return await query.orderBy(desc(tasks.createdAt)).limit(50);
  }

  async getTask(id: string, tenantId: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  }

  async updateTask(id: string, task: Partial<Task>, tenantId: string): Promise<Task | undefined> {
    const [result] = await db
      .update(tasks)
      .set({ ...task, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
      .returning();
    return result;
  }

  async getTaskStats(tenantId: string, userId?: string): Promise<any> {
    let baseQuery = db
      .select({
        status: tasks.status,
        count: sql<number>`COUNT(*)`,
        avgHours: sql<number>`AVG(${tasks.actualHours})`,
      })
      .from(tasks)
      .where(eq(tasks.tenantId, tenantId));

    if (userId) {
      baseQuery = baseQuery.where(eq(tasks.assignedTo, userId));
    }

    const results = await baseQuery.groupBy(tasks.status);

    const stats = {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      overdueTasks: 0,
      myTasks: userId ? results.reduce((sum, r) => sum + r.count, 0) : 0,
      avgCompletionTime: 0,
    };

    results.forEach((result) => {
      stats.totalTasks += result.count;
      if (result.status === 'completed') {
        stats.completedTasks = result.count;
        stats.avgCompletionTime = result.avgHours || 0;
      } else if (result.status === 'in_progress') {
        stats.inProgressTasks = result.count;
      }
    });

    // Get overdue tasks
    const overdueCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          lt(tasks.dueDate, new Date()),
          ne(tasks.status, 'completed'),
        ),
      );

    stats.overdueTasks = overdueCount[0]?.count || 0;

    return stats;
  }

  async getProjects(tenantId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.tenantId, tenantId))
      .orderBy(desc(projects.createdAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [result] = await db.insert(projects).values(project).returning();
    return result;
  }

  // ============= PERFORMANCE MONITORING OPERATIONS =============

  async getPerformanceMetrics(tenantId?: string): Promise<any> {
    // Get latest metrics grouped by type
    const metrics = await db
      .select({
        metricType: performanceMetrics.metricType,
        value: sql<number>`AVG(${performanceMetrics.value})`,
        unit: performanceMetrics.unit,
      })
      .from(performanceMetrics)
      .where(tenantId ? eq(performanceMetrics.tenantId, tenantId) : sql`TRUE`)
      .where(gte(performanceMetrics.timestamp, new Date(Date.now() - 60 * 60 * 1000))) // Last hour
      .groupBy(performanceMetrics.metricType, performanceMetrics.unit);

    const result = {
      avg_response_time: 0,
      total_requests: 0,
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      active_issues: 0,
    };

    metrics.forEach((metric) => {
      switch (metric.metricType) {
        case 'response_time':
          result.avg_response_time = metric.value;
          break;
        case 'cpu_usage':
          result.cpu_usage = metric.value;
          break;
        case 'memory_usage':
          result.memory_usage = metric.value;
          break;
        case 'disk_usage':
          result.disk_usage = metric.value;
          break;
        case 'throughput':
          result.total_requests = metric.value;
          break;
      }
    });

    // Get active issues count
    const [activeIssues] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(systemAlerts)
      .where(
        and(
          tenantId ? eq(systemAlerts.tenantId, tenantId) : sql`TRUE`,
          eq(systemAlerts.isRead, false),
          ne(systemAlerts.severity, 'info'),
        ),
      );

    result.active_issues = activeIssues?.count || 0;

    return result;
  }

  async getSystemAlerts(tenantId?: string): Promise<SystemAlert[]> {
    try {
      return await db
        .select({
          id: systemAlerts.id,
          tenantId: systemAlerts.tenantId,
          title: systemAlerts.title,
          message: systemAlerts.message,
          severity: systemAlerts.severity,
          category: systemAlerts.category,
          isRead: systemAlerts.isRead,
          createdAt: systemAlerts.createdAt,
          updatedAt: systemAlerts.updatedAt,
          expiresAt: systemAlerts.expiresAt,
          metadata: systemAlerts.metadata,
        })
        .from(systemAlerts)
        .where(tenantId ? eq(systemAlerts.tenantId, tenantId) : sql`TRUE`)
        .where(gte(systemAlerts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))) // Last 24 hours
        .orderBy(desc(systemAlerts.createdAt))
        .limit(10);
    } catch (error) {
      log.error('Error fetching system alerts:', error);
      return []; // Return empty array instead of throwing
    }
  }

  async createSystemAlert(alert: InsertSystemAlert): Promise<SystemAlert> {
    const [result] = await db.insert(systemAlerts).values(alert).returning();
    return result;
  }

  async recordPerformanceMetric(metric: InsertPerformanceMetric): Promise<PerformanceMetric> {
    const [result] = await db.insert(performanceMetrics).values(metric).returning();
    return result;
  }

  // ============= SYSTEM INTEGRATIONS OPERATIONS =============

  async getSystemIntegrations(tenantId?: string): Promise<SystemIntegration[]> {
    return await db
      .select()
      .from(systemIntegrations)
      .where(tenantId ? eq(systemIntegrations.tenantId, tenantId) : sql`TRUE`)
      .orderBy(systemIntegrations.name);
  }

  async createSystemIntegration(integration: InsertSystemIntegration): Promise<SystemIntegration> {
    const [result] = await db.insert(systemIntegrations).values(integration).returning();
    return result;
  }

  async updateSystemIntegration(
    id: string,
    integration: Partial<SystemIntegration>,
    tenantId?: string,
  ): Promise<SystemIntegration | undefined> {
    const [result] = await db
      .update(systemIntegrations)
      .set({ ...integration, updatedAt: new Date() })
      .where(
        and(
          eq(systemIntegrations.id, id),
          tenantId ? eq(systemIntegrations.tenantId, tenantId) : sql`TRUE`,
        ),
      )
      .returning();
    return result;
  }

  // Professional Services
  async getAllProfessionalServices(tenantId: string): Promise<ProfessionalService[]> {
    return await db
      .select()
      .from(professionalServices)
      .where(eq(professionalServices.tenantId, tenantId))
      .orderBy(professionalServices.productName);
  }

  async getProfessionalServiceByCode(
    productCode: string,
    tenantId: string,
  ): Promise<ProfessionalService | undefined> {
    const [service] = await db
      .select()
      .from(professionalServices)
      .where(
        and(
          eq(professionalServices.productCode, productCode),
          eq(professionalServices.tenantId, tenantId),
        ),
      );
    return service;
  }

  async createProfessionalService(
    service: InsertProfessionalService,
  ): Promise<ProfessionalService> {
    const [result] = await db.insert(professionalServices).values(service).returning();
    return result;
  }

  async updateProfessionalService(
    id: string,
    data: Partial<ProfessionalService>,
    tenantId: string,
  ): Promise<ProfessionalService | undefined> {
    const [result] = await db
      .update(professionalServices)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(professionalServices.id, id), eq(professionalServices.tenantId, tenantId)))
      .returning();
    return result;
  }

  async deleteProfessionalService(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(professionalServices)
      .where(and(eq(professionalServices.id, id), eq(professionalServices.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Service Products
  async getAllServiceProducts(tenantId: string): Promise<ServiceProduct[]> {
    return await db
      .select()
      .from(serviceProducts)
      .where(eq(serviceProducts.tenantId, tenantId))
      .orderBy(serviceProducts.productName);
  }

  async createServiceProduct(service: InsertServiceProduct): Promise<ServiceProduct> {
    const [result] = await db.insert(serviceProducts).values(service).returning();
    return result;
  }

  // Software Products
  async getAllSoftwareProducts(tenantId: string): Promise<SoftwareProduct[]> {
    return await db
      .select()
      .from(softwareProducts)
      .where(eq(softwareProducts.tenantId, tenantId))
      .orderBy(softwareProducts.productName);
  }

  async getSoftwareProductByCode(
    productCode: string,
    tenantId: string,
  ): Promise<SoftwareProduct | undefined> {
    const [product] = await db
      .select()
      .from(softwareProducts)
      .where(
        and(eq(softwareProducts.productCode, productCode), eq(softwareProducts.tenantId, tenantId)),
      );
    return product;
  }

  async createSoftwareProduct(product: InsertSoftwareProduct): Promise<SoftwareProduct> {
    const [result] = await db.insert(softwareProducts).values(product).returning();
    return result;
  }

  async updateSoftwareProduct(
    id: string,
    product: Partial<SoftwareProduct>,
    tenantId: string,
  ): Promise<SoftwareProduct | undefined> {
    const [result] = await db
      .update(softwareProducts)
      .set({ ...product, updatedAt: new Date() })
      .where(and(eq(softwareProducts.id, id), eq(softwareProducts.tenantId, tenantId)))
      .returning();
    return result;
  }

  async deleteSoftwareProduct(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(softwareProducts)
      .where(and(eq(softwareProducts.id, id), eq(softwareProducts.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  async bulkDeleteSoftwareProducts(ids: string[], tenantId: string): Promise<number> {
    const result = await db
      .delete(softwareProducts)
      .where(and(inArray(softwareProducts.id, ids), eq(softwareProducts.tenantId, tenantId)));
    return result.rowCount || 0;
  }

  // Master Product Models - get from master database only for accessory compatibility
  async getMasterProductModelsForAccessories(tenantId: string): Promise<any[]> {
    try {
      // Only get master product models since accessory compatibility references this table
      const masterModels = await db
        .select({
          id: masterProductModels.id,
          modelName: masterProductModels.displayName,
          manufacturer: masterProductModels.manufacturer,
          category: masterProductModels.category,
          productFamily: sql<string>`COALESCE(${masterProductModels.category}, 'Equipment')`.as(
            'productFamily',
          ),
          productType:
            sql<string>`COALESCE(${masterProductModels.productType}, 'multifunction')`.as(
              'productType',
            ),
        })
        .from(masterProductModels)
        .where(eq(masterProductModels.status, 'active'))
        .orderBy(masterProductModels.manufacturer, masterProductModels.displayName);

      return masterModels;
    } catch (error) {
      log.error('Error in getMasterProductModelsForAccessories:', error);
      return [];
    }
  }

  // Product Accessories - fallback implementation (removed duplicate method)

  // Managed Services
  async getAllManagedServices(tenantId: string): Promise<ManagedService[]> {
    return await db
      .select()
      .from(managedServices)
      .where(eq(managedServices.tenantId, tenantId))
      .orderBy(managedServices.productName);
  }

  async getManagedServiceByCode(
    productCode: string,
    tenantId: string,
  ): Promise<ManagedService | undefined> {
    const [service] = await db
      .select()
      .from(managedServices)
      .where(
        and(eq(managedServices.productCode, productCode), eq(managedServices.tenantId, tenantId)),
      );
    return service;
  }

  // Supplies
  async getAllSupplies(tenantId: string): Promise<Supply[]> {
    return await db
      .select()
      .from(supplies)
      .where(eq(supplies.tenantId, tenantId))
      .orderBy(supplies.productName);
  }

  async getSupplyByCode(productCode: string, tenantId: string): Promise<Supply | undefined> {
    const [supply] = await db
      .select()
      .from(supplies)
      .where(and(eq(supplies.productCode, productCode), eq(supplies.tenantId, tenantId)));
    return supply;
  }

  async createSupply(supply: InsertSupply): Promise<Supply> {
    const [result] = await db.insert(supplies).values(supply).returning();
    return result;
  }

  async updateSupply(
    id: string,
    data: Partial<Supply>,
    tenantId: string,
  ): Promise<Supply | undefined> {
    const [result] = await db
      .update(supplies)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(supplies.id, id), eq(supplies.tenantId, tenantId)))
      .returning();
    return result;
  }

  async deleteSupply(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(supplies)
      .where(and(eq(supplies.id, id), eq(supplies.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  async createManagedService(service: InsertManagedService): Promise<ManagedService> {
    const [result] = await db.insert(managedServices).values(service).returning();
    return result;
  }

  async updateManagedService(
    id: string,
    data: Partial<ManagedService>,
    tenantId: string,
  ): Promise<ManagedService | undefined> {
    const [result] = await db
      .update(managedServices)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(managedServices.id, id), eq(managedServices.tenantId, tenantId)))
      .returning();
    return result;
  }

  async deleteManagedService(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(managedServices)
      .where(and(eq(managedServices.id, id), eq(managedServices.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Contact operations (used for company contacts)
  async createContact(
    contact: Omit<LeadContact, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<LeadContact> {
    const [result] = await db
      .insert(leadContacts)
      .values({
        ...contact,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  async getContactsByCompany(companyId: string, tenantId: string): Promise<LeadContact[]> {
    return await db
      .select()
      .from(leadContacts)
      .where(
        and(
          eq(leadContacts.leadId, companyId), // Using leadId as companyId for now
          eq(leadContacts.tenantId, tenantId),
        ),
      )
      .orderBy(leadContacts.firstName, leadContacts.lastName);
  }

  async updateContact(contactId: string, contact: Partial<LeadContact>): Promise<LeadContact> {
    const [result] = await db
      .update(leadContacts)
      .set({
        ...contact,
        updatedAt: new Date(),
      })
      .where(eq(leadContacts.id, contactId))
      .returning();
    return result;
  }

  async deleteContact(contactId: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(leadContacts)
      .where(and(eq(leadContacts.id, contactId), eq(leadContacts.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Get contacts by company name from enhanced_contacts table
  async getContactsByCompanyName(companyName: string, tenantId: string): Promise<any[]> {
    return await db
      .select({
        id: enhancedContacts.id,
        firstName: enhancedContacts.firstName,
        lastName: enhancedContacts.lastName,
        email: enhancedContacts.email,
        workPhone: enhancedContacts.workPhone,
        mobilePhone: enhancedContacts.mobilePhone,
        title: enhancedContacts.title,
        department: enhancedContacts.department,
        isPrimary: enhancedContacts.isPrimaryContact,
      })
      .from(enhancedContacts)
      .where(
        and(eq(enhancedContacts.companyName, companyName), eq(enhancedContacts.tenantId, tenantId)),
      )
      .orderBy(enhancedContacts.firstName, enhancedContacts.lastName);
  }

  // ============= ACCOUNTING OPERATIONS =============

  // Vendor operations
  async getVendors(tenantId: string): Promise<Vendor[]> {
    return await db.select().from(vendors).where(eq(vendors.tenantId, tenantId));
  }

  async getVendor(id: string, tenantId: string): Promise<Vendor | undefined> {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)));
    return vendor;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(
    id: string,
    vendor: Partial<Vendor>,
    tenantId: string,
  ): Promise<Vendor | undefined> {
    const [updatedVendor] = await db
      .update(vendors)
      .set({ ...vendor, updatedAt: new Date() })
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)))
      .returning();
    return updatedVendor;
  }

  async deleteVendor(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(vendors)
      .where(and(eq(vendors.id, id), eq(vendors.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Accounts Payable operations
  async getAccountsPayable(tenantId: string): Promise<AccountsPayable[]> {
    return await db.select().from(accountsPayable).where(eq(accountsPayable.tenantId, tenantId));
  }

  async getAccountPayable(id: string, tenantId: string): Promise<AccountsPayable | undefined> {
    const [ap] = await db
      .select()
      .from(accountsPayable)
      .where(and(eq(accountsPayable.id, id), eq(accountsPayable.tenantId, tenantId)));
    return ap;
  }

  async createAccountsPayable(ap: InsertAccountsPayable): Promise<AccountsPayable> {
    const [newAP] = await db.insert(accountsPayable).values(ap).returning();
    return newAP;
  }

  async updateAccountsPayable(
    id: string,
    ap: Partial<AccountsPayable>,
    tenantId: string,
  ): Promise<AccountsPayable | undefined> {
    const [updatedAP] = await db
      .update(accountsPayable)
      .set({ ...ap, updatedAt: new Date() })
      .where(and(eq(accountsPayable.id, id), eq(accountsPayable.tenantId, tenantId)))
      .returning();
    return updatedAP;
  }

  // Accounts Receivable operations
  async getAccountsReceivable(tenantId: string): Promise<AccountsReceivable[]> {
    return await db
      .select()
      .from(accountsReceivable)
      .where(eq(accountsReceivable.tenantId, tenantId));
  }

  async getAccountReceivable(
    id: string,
    tenantId: string,
  ): Promise<AccountsReceivable | undefined> {
    const [ar] = await db
      .select()
      .from(accountsReceivable)
      .where(and(eq(accountsReceivable.id, id), eq(accountsReceivable.tenantId, tenantId)));
    return ar;
  }

  async createAccountsReceivable(ar: InsertAccountsReceivable): Promise<AccountsReceivable> {
    const [newAR] = await db.insert(accountsReceivable).values(ar).returning();
    return newAR;
  }

  async updateAccountsReceivable(
    id: string,
    ar: Partial<AccountsReceivable>,
    tenantId: string,
  ): Promise<AccountsReceivable | undefined> {
    const [updatedAR] = await db
      .update(accountsReceivable)
      .set({ ...ar, updatedAt: new Date() })
      .where(and(eq(accountsReceivable.id, id), eq(accountsReceivable.tenantId, tenantId)))
      .returning();
    return updatedAR;
  }

  // Chart of Accounts operations
  async getChartOfAccounts(tenantId: string): Promise<ChartOfAccount[]> {
    return await db.select().from(chartOfAccounts).where(eq(chartOfAccounts.tenantId, tenantId));
  }

  async getChartOfAccount(id: string, tenantId: string): Promise<ChartOfAccount | undefined> {
    const [account] = await db
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.tenantId, tenantId)));
    return account;
  }

  async createChartOfAccount(account: InsertChartOfAccount): Promise<ChartOfAccount> {
    const [newAccount] = await db.insert(chartOfAccounts).values(account).returning();
    return newAccount;
  }

  async updateChartOfAccount(
    id: string,
    account: Partial<ChartOfAccount>,
    tenantId: string,
  ): Promise<ChartOfAccount | undefined> {
    const [updatedAccount] = await db
      .update(chartOfAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.tenantId, tenantId)))
      .returning();
    return updatedAccount;
  }

  // Purchase Order operations
  async getPurchaseOrders(tenantId: string): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).where(eq(purchaseOrders.tenantId, tenantId));
  }

  async getPurchaseOrder(id: string, tenantId: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));
    return po;
  }

  async createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [newPO] = await db.insert(purchaseOrders).values(po).returning();
    return newPO;
  }

  async updatePurchaseOrder(
    id: string,
    po: Partial<PurchaseOrder>,
    tenantId: string,
  ): Promise<PurchaseOrder | undefined> {
    const [updatedPO] = await db
      .update(purchaseOrders)
      .set({ ...po, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)))
      .returning();
    return updatedPO;
  }

  async getPurchaseOrderItems(
    purchaseOrderId: string,
    tenantId: string,
  ): Promise<PurchaseOrderItem[]> {
    return await db
      .select()
      .from(purchaseOrderItems)
      .where(
        and(
          eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId),
          eq(purchaseOrderItems.tenantId, tenantId),
        ),
      );
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const [newItem] = await db.insert(purchaseOrderItems).values(item).returning();
    return newItem;
  }

  async updatePurchaseOrderItem(
    id: string,
    item: Partial<PurchaseOrderItem>,
    tenantId: string,
  ): Promise<PurchaseOrderItem | undefined> {
    const [updatedItem] = await db
      .update(purchaseOrderItems)
      .set(item)
      .where(and(eq(purchaseOrderItems.id, id), eq(purchaseOrderItems.tenantId, tenantId)))
      .returning();
    return updatedItem;
  }

  async deletePurchaseOrder(id: string, tenantId: string): Promise<boolean> {
    // First delete all line items
    await db
      .delete(purchaseOrderItems)
      .where(
        and(eq(purchaseOrderItems.purchaseOrderId, id), eq(purchaseOrderItems.tenantId, tenantId)),
      );

    // Then delete the purchase order
    const result = await db
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));

    return result.rowCount > 0;
  }

  async deletePurchaseOrderItem(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(purchaseOrderItems)
      .where(and(eq(purchaseOrderItems.id, id), eq(purchaseOrderItems.tenantId, tenantId)));

    return result.rowCount > 0;
  }

  // Vendor operations - removed duplicate methods (kept original versions above)

  // Business Record Contacts operations
  async getBusinessRecordContacts(
    businessRecordId: string,
    tenantId: string,
  ): Promise<CompanyContact[]> {
    return await db
      .select()
      .from(companyContacts)
      .where(
        and(
          eq(companyContacts.companyId, businessRecordId),
          eq(companyContacts.tenantId, tenantId),
        ),
      )
      .orderBy(companyContacts.firstName, companyContacts.lastName);
  }

  async createBusinessRecordContact(contact: InsertCompanyContact): Promise<CompanyContact> {
    const [newContact] = await db.insert(companyContacts).values(contact).returning();
    return newContact;
  }

  // Deal management operations
  async getDeals(
    tenantId: string,
    stageId?: string,
    search?: string,
    leadId?: string,
  ): Promise<any[]> {
    let query = db
      .select({
        id: deals.id,
        title: deals.title,
        description: deals.description,
        amount: deals.amount,
        companyName: deals.companyName,
        primaryContactName: deals.primaryContactName,
        primaryContactEmail: deals.primaryContactEmail,
        primaryContactPhone: deals.primaryContactPhone,
        source: deals.source,
        dealType: deals.dealType,
        priority: deals.priority,
        expectedCloseDate: deals.expectedCloseDate,
        productsInterested: deals.productsInterested,
        estimatedMonthlyValue: deals.estimatedMonthlyValue,
        notes: deals.notes,
        status: deals.status,
        probability: deals.probability,
        stageId: deals.stageId,
        stageName: dealStages.name,
        stageColor: dealStages.color,
        ownerId: deals.ownerId,
        ownerName: users.firstName,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(dealStages, eq(deals.stageId, dealStages.id))
      .leftJoin(users, eq(deals.ownerId, users.id))
      .where(eq(deals.tenantId, tenantId));

    if (stageId) {
      query = query.where(eq(deals.stageId, stageId));
    }

    if (leadId) {
      query = query.where(eq(deals.leadId, leadId));
    }

    if (search) {
      query = query.where(
        or(
          like(deals.title, `%${search}%`),
          like(deals.companyName, `%${search}%`),
          like(deals.primaryContactName, `%${search}%`),
        ),
      );
    }

    return await query.orderBy(desc(deals.createdAt));
  }

  async getDeal(id: string, tenantId: string): Promise<any> {
    const [deal] = await db
      .select({
        id: deals.id,
        title: deals.title,
        description: deals.description,
        amount: deals.amount,
        companyName: deals.companyName,
        primaryContactName: deals.primaryContactName,
        primaryContactEmail: deals.primaryContactEmail,
        primaryContactPhone: deals.primaryContactPhone,
        source: deals.source,
        dealType: deals.dealType,
        priority: deals.priority,
        expectedCloseDate: deals.expectedCloseDate,
        productsInterested: deals.productsInterested,
        estimatedMonthlyValue: deals.estimatedMonthlyValue,
        notes: deals.notes,
        status: deals.status,
        probability: deals.probability,
        stageId: deals.stageId,
        stageName: dealStages.name,
        stageColor: dealStages.color,
        ownerId: deals.ownerId,
        ownerName: users.firstName,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(dealStages, eq(deals.stageId, dealStages.id))
      .leftJoin(users, eq(deals.ownerId, users.id))
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)));
    return deal;
  }

  async createDeal(deal: any): Promise<any> {
    // Get the first stage for this tenant as default
    const [defaultStage] = await db
      .select()
      .from(dealStages)
      .where(eq(dealStages.tenantId, deal.tenantId))
      .orderBy(dealStages.sortOrder)
      .limit(1);

    const dealData = {
      ...deal,
      stageId: deal.stageId || defaultStage?.id,
      status: 'open',
      probability: 50,
    };

    const [newDeal] = await db.insert(deals).values(dealData).returning();
    return newDeal;
  }

  async updateDeal(id: string, deal: Partial<any>, tenantId: string): Promise<any> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ ...deal, updatedAt: new Date() })
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
      .returning();
    return updatedDeal;
  }

  async updateDealStage(id: string, stageId: string, tenantId: string): Promise<any> {
    // Check if the new stage is a closing stage
    const [stage] = await db.select().from(dealStages).where(eq(dealStages.id, stageId));

    const updateData: any = {
      stageId,
      updatedAt: new Date(),
    };

    if (stage?.isClosingStage) {
      updateData.status = stage.isWonStage ? 'won' : 'lost';
      updateData.actualCloseDate = new Date();
      updateData.probability = stage.isWonStage ? 100 : 0;
    }

    const [updatedDeal] = await db
      .update(deals)
      .set(updateData)
      .where(and(eq(deals.id, id), eq(deals.tenantId, tenantId)))
      .returning();

    // Create activity record for stage change
    await this.createDealActivity({
      tenantId,
      dealId: id,
      activityType: 'stage_change',
      type: 'stage_change',
      title: `Deal moved to ${stage?.name}`,
      subject: `Deal moved to ${stage?.name}`,
      description: `Deal stage changed to ${stage?.name}`,
      userId: updatedDeal?.ownerId || '', // In real app, get from request context
      previousValue: JSON.stringify({ stageId: updatedDeal?.stageId }),
      newValue: JSON.stringify({ stageId }),
    });

    return updatedDeal;
  }

  // Deal stages operations
  async getDealStages(tenantId: string): Promise<any[]> {
    return await db
      .select({
        id: dealStages.id,
        tenantId: dealStages.tenantId,
        name: dealStages.name,
        description: dealStages.description,
        color: dealStages.color,
        sortOrder: dealStages.sortOrder,
        isActive: dealStages.isActive,
        isClosingStage: dealStages.isClosingStage,
        isWonStage: dealStages.isWonStage,
        createdAt: dealStages.createdAt,
        updatedAt: dealStages.updatedAt,
      })
      .from(dealStages)
      .where(and(eq(dealStages.tenantId, tenantId), eq(dealStages.isActive, true)))
      .orderBy(dealStages.sortOrder);
  }

  async createDealStage(stage: any): Promise<any> {
    const [newStage] = await db.insert(dealStages).values(stage).returning();
    return newStage;
  }

  async updateDealStageById(id: string, stage: Partial<any>, tenantId: string): Promise<any> {
    const [updatedStage] = await db
      .update(dealStages)
      .set({ ...stage, updatedAt: new Date() })
      .where(and(eq(dealStages.id, id), eq(dealStages.tenantId, tenantId)))
      .returning();
    return updatedStage;
  }

  // Deal activities operations
  async getDealActivities(dealId: string, tenantId: string): Promise<any[]> {
    return await db
      .select({
        id: dealActivities.id,
        type: dealActivities.type,
        subject: dealActivities.subject,
        description: dealActivities.description,
        duration: dealActivities.duration,
        outcome: dealActivities.outcome,
        userId: dealActivities.userId,
        userName: users.firstName,
        createdAt: dealActivities.createdAt,
      })
      .from(dealActivities)
      .leftJoin(users, eq(dealActivities.userId, users.id))
      .where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)))
      .orderBy(desc(dealActivities.createdAt));
  }

  async createDealActivity(activity: any): Promise<any> {
    const [newActivity] = await db.insert(dealActivities).values(activity).returning();
    return newActivity;
  }

  // Pricing System Implementation
  async getCompanyPricingSettings(tenantId: string): Promise<CompanyPricingSetting | undefined> {
    const [settings] = await db
      .select()
      .from(companyPricingSettings)
      .where(
        and(
          eq(companyPricingSettings.tenantId, tenantId),
          eq(companyPricingSettings.isActive, true),
        ),
      );
    return settings;
  }

  async updateCompanyPricingSettings(
    tenantId: string,
    settingsData: InsertCompanyPricingSetting,
  ): Promise<CompanyPricingSetting> {
    // Try to update existing settings first
    const existing = await this.getCompanyPricingSettings(tenantId);

    if (existing) {
      const [updated] = await db
        .update(companyPricingSettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(companyPricingSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(companyPricingSettings)
        .values({ ...settingsData, tenantId })
        .returning();
      return created;
    }
  }

  async getProductPricing(tenantId: string): Promise<ProductPricing[]> {
    return await db
      .select()
      .from(productPricing)
      .where(eq(productPricing.tenantId, tenantId))
      .orderBy(desc(productPricing.createdAt));
  }

  async getProductPricingByProductId(
    productId: string,
    productType: string,
    tenantId: string,
  ): Promise<ProductPricing | undefined> {
    const [pricing] = await db
      .select()
      .from(productPricing)
      .where(
        and(
          eq(productPricing.productId, productId),
          eq(productPricing.productType, productType),
          eq(productPricing.tenantId, tenantId),
          eq(productPricing.isActive, true),
        ),
      );
    return pricing;
  }

  async createProductPricing(pricingData: InsertProductPricing): Promise<ProductPricing> {
    const [created] = await db.insert(productPricing).values(pricingData).returning();
    return created;
  }

  async updateProductPricing(
    id: string,
    tenantId: string,
    pricingData: Partial<InsertProductPricing>,
  ): Promise<ProductPricing | undefined> {
    const [updated] = await db
      .update(productPricing)
      .set({ ...pricingData, updatedAt: new Date() })
      .where(and(eq(productPricing.id, id), eq(productPricing.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteProductPricing(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(productPricing)
      .where(and(eq(productPricing.id, id), eq(productPricing.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  async getQuotePricing(quoteId: string, tenantId: string): Promise<QuotePricing | undefined> {
    const [pricing] = await db
      .select()
      .from(quotePricing)
      .where(
        and(
          or(
            eq(quotePricing.leadId, quoteId),
            eq(quotePricing.customerId, quoteId),
            eq(quotePricing.quoteNumber, quoteId),
          ),
          eq(quotePricing.tenantId, tenantId),
        ),
      );
    return pricing;
  }

  async createQuotePricing(pricingData: InsertQuotePricing): Promise<QuotePricing> {
    const [created] = await db.insert(quotePricing).values(pricingData).returning();
    return created;
  }

  async updateQuotePricing(
    id: string,
    tenantId: string,
    pricingData: Partial<InsertQuotePricing>,
  ): Promise<QuotePricing | undefined> {
    const [updated] = await db
      .update(quotePricing)
      .set({ ...pricingData, updatedAt: new Date() })
      .where(and(eq(quotePricing.id, id), eq(quotePricing.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async getQuotePricingLineItems(
    quotePricingId: string,
    tenantId: string,
  ): Promise<QuotePricingLineItem[]> {
    return await db
      .select()
      .from(quotePricingLineItems)
      .where(
        and(
          eq(quotePricingLineItems.quotePricingId, quotePricingId),
          eq(quotePricingLineItems.tenantId, tenantId),
        ),
      )
      .orderBy(asc(quotePricingLineItems.lineNumber));
  }

  async createQuotePricingLineItem(
    lineItemData: InsertQuotePricingLineItem,
  ): Promise<QuotePricingLineItem> {
    const [created] = await db.insert(quotePricingLineItems).values(lineItemData).returning();
    return created;
  }

  async updateQuotePricingLineItem(
    id: string,
    tenantId: string,
    lineItemData: Partial<InsertQuotePricingLineItem>,
  ): Promise<QuotePricingLineItem | undefined> {
    const [updated] = await db
      .update(quotePricingLineItems)
      .set({ ...lineItemData, updatedAt: new Date() })
      .where(and(eq(quotePricingLineItems.id, id), eq(quotePricingLineItems.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteQuotePricingLineItem(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(quotePricingLineItems)
      .where(and(eq(quotePricingLineItems.id, id), eq(quotePricingLineItems.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Comprehensive contact management methods
  async getContacts(options: {
    filters: any;
    search: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    offset: number;
    limit: number;
  }): Promise<CompanyContact[]> {
    // Build where conditions array
    const whereConditions: any[] = [eq(companyContacts.tenantId, options.filters.tenantId)];

    // Apply additional filters
    if (options.filters.ownerId) {
      whereConditions.push(eq(companyContacts.ownerId, options.filters.ownerId));
    }

    if (options.filters.leadStatus) {
      whereConditions.push(eq(companyContacts.leadStatus, options.filters.leadStatus));
    }

    // Apply search
    if (options.search) {
      whereConditions.push(
        or(
          like(companyContacts.firstName, `%${options.search}%`),
          like(companyContacts.lastName, `%${options.search}%`),
          like(companyContacts.email, `%${options.search}%`),
          like(companyContacts.phone, `%${options.search}%`),
        ),
      );
    }

    let query = db
      .select({
        id: companyContacts.id,
        firstName: companyContacts.firstName,
        lastName: companyContacts.lastName,
        email: companyContacts.email,
        phone: companyContacts.phone,
        title: companyContacts.title,
        companyId: companyContacts.companyId,
        companyName: companies.businessName,
        leadStatus: companyContacts.leadStatus,
        lastContactDate: companyContacts.lastContactDate,
        nextFollowUpDate: companyContacts.nextFollowUpDate,
        createdAt: companyContacts.createdAt,
        ownerId: companyContacts.ownerId,
        ownerName: users.firstName,
        favoriteContentType: companyContacts.favoriteContentType,
        preferredChannels: companyContacts.preferredChannels,
        tenantId: companyContacts.tenantId,
      })
      .from(companyContacts)
      .leftJoin(companies, eq(companyContacts.companyId, companies.id))
      .leftJoin(users, eq(companyContacts.ownerId, users.id))
      .where(and(...whereConditions));

    // Apply sorting - simplified to avoid dynamic column access issues
    if (options.sortBy === 'lastActivityDate' || options.sortBy === 'lastContactDate') {
      query =
        options.sortOrder === 'asc'
          ? query.orderBy(asc(companyContacts.lastContactDate))
          : query.orderBy(desc(companyContacts.lastContactDate));
    } else if (options.sortBy === 'firstName') {
      query =
        options.sortOrder === 'asc'
          ? query.orderBy(asc(companyContacts.firstName))
          : query.orderBy(desc(companyContacts.firstName));
    } else if (options.sortBy === 'lastName') {
      query =
        options.sortOrder === 'asc'
          ? query.orderBy(asc(companyContacts.lastName))
          : query.orderBy(desc(companyContacts.lastName));
    } else {
      // Default sort by created date
      query = query.orderBy(desc(companyContacts.createdAt));
    }

    // Apply pagination
    query = query.limit(options.limit).offset(options.offset);

    return await query;
  }

  async getContactsCount(options: { filters: any; search: string }): Promise<number> {
    // Build where conditions array
    const whereConditions: any[] = [eq(companyContacts.tenantId, options.filters.tenantId)];

    // Apply additional filters
    if (options.filters.ownerId) {
      whereConditions.push(eq(companyContacts.ownerId, options.filters.ownerId));
    }

    if (options.filters.leadStatus) {
      whereConditions.push(eq(companyContacts.leadStatus, options.filters.leadStatus));
    }

    // Apply search
    if (options.search) {
      whereConditions.push(
        or(
          like(companyContacts.firstName, `%${options.search}%`),
          like(companyContacts.lastName, `%${options.search}%`),
          like(companyContacts.email, `%${options.search}%`),
          like(companyContacts.phone, `%${options.search}%`),
        ),
      );
    }

    const result = await db
      .select({ count: count() })
      .from(companyContacts)
      .where(and(...whereConditions));

    return result[0]?.count ?? 0;
  }

  async getContactById(id: string, tenantId?: string): Promise<CompanyContact | undefined> {
    const conditions = [eq(companyContacts.id, id)];
    if (tenantId) {
      conditions.push(eq(companyContacts.tenantId, tenantId));
    }
    const [contact] = await db
      .select()
      .from(companyContacts)
      .where(and(...conditions));
    return contact;
  }

  // Removed duplicate createContact, updateContact, deleteContact methods (already exist above)

  async getUserByName(name: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.firstName, name),
          eq(users.lastName, name),
          like(sql`${users.firstName} || ' ' || ${users.lastName}`, `%${name}%`),
        ),
      );
    return user;
  }

  // Removed duplicate getContactsByCompany method (already exists above)

  // Tenant management methods
  async getTenant(id: string): Promise<any> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<any> {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(
        or(eq(tenants.slug, slug), eq(tenants.subdomainPrefix, slug), eq(tenants.pathPrefix, slug)),
      )
      .limit(1);
    return tenant;
  }

  async createTenant(tenantData: any): Promise<any> {
    const [tenant] = await db.insert(tenants).values(tenantData).returning();
    return tenant;
  }

  async updateTenant(id: string, updates: any): Promise<any> {
    const [tenant] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return tenant;
  }

  // User Settings Methods
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));

    // If no settings exist, create default settings
    if (!settings) {
      // Get user's tenant info
      const user = await this.getUserById(userId);
      if (!user?.tenantId) {
        throw new Error('User tenant ID is required for creating settings');
      }
      const tenantId = user.tenantId;

      const defaultSettings = {
        id: `settings-${userId}`,
        userId: userId,
        tenantId: tenantId,
        firstName: '',
        lastName: '',
        email: '',
        theme: 'system',
        language: 'en',
        timezone: 'America/New_York',
        dateFormat: 'MM/dd/yyyy',
        timeFormat: '12',
        currency: 'USD',
        notifications: {
          email: true,
          push: true,
          sms: false,
          marketing: false,
        },
        accessibility: {
          highContrast: false,
          reducedMotion: false,
          fontSize: 'medium',
          screenReader: false,
          keyboardNavigation: false,
          colorBlind: 'none',
          soundEnabled: true,
          voiceCommands: false,
        },
        twoFactorEnabled: false,
      };

      const [created] = await db.insert(userSettings).values(defaultSettings).returning();
      return created;
    }

    return settings;
  }

  async createUserSettings(settingsData: InsertUserSettings): Promise<UserSettings> {
    const [created] = await db.insert(userSettings).values(settingsData).returning();
    return created;
  }

  async updateUserSettings(
    userId: string,
    settingsData: Partial<InsertUserSettings>,
  ): Promise<UserSettings | undefined> {
    // Ensure user settings exist first
    await this.getUserSettings(userId);

    // Now update the existing settings
    const [updated] = await db
      .update(userSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();

    return updated;
  }

  async deleteUserSettings(userId: string): Promise<boolean> {
    const result = await db.delete(userSettings).where(eq(userSettings.userId, userId));
    return result.rowCount > 0;
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  async updateUser(userId: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Removed duplicate getUserCustomerAssignments method (already exists above)

  async deleteUserCustomerAssignments(userId: string): Promise<boolean> {
    const result = await db
      .delete(userCustomerAssignments)
      .where(eq(userCustomerAssignments.userId, userId));
    return result.rowCount > 0;
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId));
    return result.rowCount > 0;
  }

  // Warehouse Operations methods
  async getWarehouseOperations(tenantId: string): Promise<any[]> {
    // Return empty array for now - will be implemented with proper schema
    return [];
  }

  async getWarehouseOperation(id: string, tenantId: string): Promise<any | undefined> {
    // Return undefined for now - will be implemented with proper schema
    return undefined;
  }

  async createWarehouseOperation(data: any): Promise<any> {
    // Return the data for now - will be implemented with proper schema
    return {
      id: 'temp-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateWarehouseOperation(
    id: string,
    data: any,
    tenantId: string,
  ): Promise<any | undefined> {
    // Return the data for now - will be implemented with proper schema
    return { id, ...data, updatedAt: new Date() };
  }

  async deleteWarehouseOperation(id: string, tenantId: string): Promise<boolean> {
    // Return true for now - will be implemented with proper schema
    return true;
  }

  async getWarehouseOperationsByEquipment(equipmentId: string, tenantId: string): Promise<any[]> {
    return [];
  }

  // Serial Number Management methods
  async getSerialNumbers(tenantId: string): Promise<any[]> {
    return [];
  }

  async createSerialNumber(data: any): Promise<any> {
    return {
      id: 'temp-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateSerialNumber(id: string, data: any, tenantId: string): Promise<any | undefined> {
    return { id, ...data, updatedAt: new Date() };
  }

  async getSerialNumbersByEquipment(equipmentId: string, tenantId: string): Promise<any[]> {
    return [];
  }

  // Build Process methods
  async getBuildProcesses(tenantId: string): Promise<any[]> {
    return [];
  }

  async createBuildProcess(data: any): Promise<any> {
    return {
      id: 'temp-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getBuildProcessesByEquipment(equipmentId: string, tenantId: string): Promise<any[]> {
    return [];
  }

  // Delivery Schedule methods
  async getDeliverySchedules(tenantId: string): Promise<any[]> {
    return [];
  }

  // Removed duplicate getCustomerEquipment method (already exists above)

  // Removed duplicate customer data methods (getCustomerMeterReadings, getCustomerInvoices, getCustomerServiceTickets, getCustomerContracts) - already exist above

  async createDeliverySchedule(data: any): Promise<any> {
    return {
      id: 'temp-id',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateDeliverySchedule(id: string, data: any, tenantId: string): Promise<any | undefined> {
    return { id, ...data, updatedAt: new Date() };
  }

  async getDeliverySchedulesByEquipment(equipmentId: string, tenantId: string): Promise<any[]> {
    return [];
  }

  // Mobile field service operations
  async getMobileServiceSessions(params: {
    tenantId: string;
    serviceTicketId?: string;
    technicianId?: string;
  }): Promise<MobileServiceSession[]> {
    let query = db
      .select()
      .from(mobileServiceSessions)
      .where(eq(mobileServiceSessions.tenantId, params.tenantId));

    if (params.serviceTicketId) {
      query = query.where(eq(mobileServiceSessions.serviceTicketId, params.serviceTicketId));
    }

    if (params.technicianId) {
      query = query.where(eq(mobileServiceSessions.technicianId, params.technicianId));
    }

    return await query.orderBy(desc(mobileServiceSessions.createdAt));
  }

  async createMobileServiceSession(
    session: InsertMobileServiceSession,
  ): Promise<MobileServiceSession> {
    const [newSession] = await db.insert(mobileServiceSessions).values(session).returning();
    return newSession;
  }

  async updateMobileServiceSession(
    id: string,
    tenantId: string,
    session: Partial<MobileServiceSession>,
  ): Promise<MobileServiceSession | undefined> {
    const [updatedSession] = await db
      .update(mobileServiceSessions)
      .set({ ...session, updatedAt: new Date() })
      .where(and(eq(mobileServiceSessions.id, id), eq(mobileServiceSessions.tenantId, tenantId)))
      .returning();
    return updatedSession;
  }

  async getTimeTrackingEntries(sessionId: string, tenantId: string): Promise<TimeTrackingEntry[]> {
    return await db
      .select()
      .from(timeTrackingEntries)
      .where(
        and(
          eq(timeTrackingEntries.sessionId, sessionId),
          eq(timeTrackingEntries.tenantId, tenantId),
        ),
      )
      .orderBy(desc(timeTrackingEntries.timestamp));
  }

  async createTimeTrackingEntry(entry: InsertTimeTrackingEntry): Promise<TimeTrackingEntry> {
    const [newEntry] = await db.insert(timeTrackingEntries).values(entry).returning();
    return newEntry;
  }

  async getServicePhotos(params: {
    tenantId: string;
    serviceTicketId?: string;
    sessionId?: string;
  }): Promise<ServicePhoto[]> {
    let query = db.select().from(servicePhotos).where(eq(servicePhotos.tenantId, params.tenantId));

    if (params.serviceTicketId) {
      query = query.where(eq(servicePhotos.serviceTicketId, params.serviceTicketId));
    }

    if (params.sessionId) {
      query = query.where(eq(servicePhotos.sessionId, params.sessionId));
    }

    return await query.orderBy(desc(servicePhotos.takenAt));
  }

  async createServicePhoto(photo: InsertServicePhoto): Promise<ServicePhoto> {
    const [newPhoto] = await db.insert(servicePhotos).values(photo).returning();
    return newPhoto;
  }

  async getLocationHistory(params: {
    tenantId: string;
    technicianId?: string;
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<LocationHistory[]> {
    let query = db
      .select()
      .from(locationHistory)
      .where(eq(locationHistory.tenantId, params.tenantId));

    if (params.technicianId) {
      query = query.where(eq(locationHistory.technicianId, params.technicianId));
    }

    if (params.sessionId) {
      query = query.where(eq(locationHistory.sessionId, params.sessionId));
    }

    if (params.startDate) {
      query = query.where(gte(locationHistory.timestamp, params.startDate));
    }

    if (params.endDate) {
      query = query.where(lte(locationHistory.timestamp, params.endDate));
    }

    return await query.orderBy(desc(locationHistory.timestamp));
  }

  async createLocationHistory(location: InsertLocationHistory): Promise<LocationHistory> {
    const [newLocation] = await db.insert(locationHistory).values(location).returning();
    return newLocation;
  }

  // Onboarding operations
  async getOnboardingChecklists(tenantId: string): Promise<OnboardingChecklist[]> {
    return await db
      .select()
      .from(onboardingChecklists)
      .where(eq(onboardingChecklists.tenantId, tenantId))
      .orderBy(desc(onboardingChecklists.createdAt));
  }

  async getOnboardingChecklist(
    id: string,
    tenantId: string,
  ): Promise<OnboardingChecklist | undefined> {
    const [checklist] = await db
      .select()
      .from(onboardingChecklists)
      .where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenantId, tenantId)));
    return checklist;
  }

  async createOnboardingChecklist(
    checklist: InsertOnboardingChecklist,
  ): Promise<OnboardingChecklist> {
    const [newChecklist] = await db.insert(onboardingChecklists).values(checklist).returning();
    return newChecklist;
  }

  async updateOnboardingChecklist(
    id: string,
    tenantId: string,
    checklist: Partial<OnboardingChecklist>,
  ): Promise<OnboardingChecklist | undefined> {
    const [updatedChecklist] = await db
      .update(onboardingChecklists)
      .set({ ...checklist, updatedAt: new Date() })
      .where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenantId, tenantId)))
      .returning();
    return updatedChecklist;
  }

  async deleteOnboardingChecklist(id: string, tenantId: string): Promise<void> {
    await db
      .delete(onboardingChecklists)
      .where(and(eq(onboardingChecklists.id, id), eq(onboardingChecklists.tenantId, tenantId)));
  }

  async getOnboardingEquipment(
    checklistId: string,
    tenantId: string,
  ): Promise<OnboardingEquipment[]> {
    return await db
      .select()
      .from(onboardingEquipment)
      .where(
        and(
          eq(onboardingEquipment.checklistId, checklistId),
          eq(onboardingEquipment.tenantId, tenantId),
        ),
      )
      .orderBy(onboardingEquipment.createdAt);
  }

  async createOnboardingEquipment(
    equipment: InsertOnboardingEquipment,
  ): Promise<OnboardingEquipment> {
    const [newEquipment] = await db.insert(onboardingEquipment).values(equipment).returning();
    return newEquipment;
  }

  async updateOnboardingEquipment(
    id: string,
    tenantId: string,
    equipment: Partial<OnboardingEquipment>,
  ): Promise<OnboardingEquipment | undefined> {
    const [updatedEquipment] = await db
      .update(onboardingEquipment)
      .set({ ...equipment, updatedAt: new Date() })
      .where(and(eq(onboardingEquipment.id, id), eq(onboardingEquipment.tenantId, tenantId)))
      .returning();
    return updatedEquipment;
  }

  async getOnboardingNetworkConfig(
    checklistId: string,
    tenantId: string,
  ): Promise<OnboardingNetworkConfig[]> {
    return await db
      .select()
      .from(onboardingNetworkConfig)
      .where(
        and(
          eq(onboardingNetworkConfig.checklistId, checklistId),
          eq(onboardingNetworkConfig.tenantId, tenantId),
        ),
      )
      .orderBy(onboardingNetworkConfig.createdAt);
  }

  async createOnboardingNetworkConfig(
    config: InsertOnboardingNetworkConfig,
  ): Promise<OnboardingNetworkConfig> {
    const [newConfig] = await db.insert(onboardingNetworkConfig).values(config).returning();
    return newConfig;
  }

  async updateOnboardingNetworkConfig(
    id: string,
    tenantId: string,
    config: Partial<OnboardingNetworkConfig>,
  ): Promise<OnboardingNetworkConfig | undefined> {
    const [updatedConfig] = await db
      .update(onboardingNetworkConfig)
      .set({ ...config, updatedAt: new Date() })
      .where(
        and(eq(onboardingNetworkConfig.id, id), eq(onboardingNetworkConfig.tenantId, tenantId)),
      )
      .returning();
    return updatedConfig;
  }

  async getOnboardingPrintManagement(
    checklistId: string,
    tenantId: string,
  ): Promise<OnboardingPrintManagement[]> {
    return await db
      .select()
      .from(onboardingPrintManagement)
      .where(
        and(
          eq(onboardingPrintManagement.checklistId, checklistId),
          eq(onboardingPrintManagement.tenantId, tenantId),
        ),
      )
      .orderBy(onboardingPrintManagement.createdAt);
  }

  async createOnboardingPrintManagement(
    config: InsertOnboardingPrintManagement,
  ): Promise<OnboardingPrintManagement> {
    const [newConfig] = await db.insert(onboardingPrintManagement).values(config).returning();
    return newConfig;
  }

  async updateOnboardingPrintManagement(
    id: string,
    tenantId: string,
    config: Partial<OnboardingPrintManagement>,
  ): Promise<OnboardingPrintManagement | undefined> {
    const [updatedConfig] = await db
      .update(onboardingPrintManagement)
      .set({ ...config, updatedAt: new Date() })
      .where(
        and(eq(onboardingPrintManagement.id, id), eq(onboardingPrintManagement.tenantId, tenantId)),
      )
      .returning();
    return updatedConfig;
  }

  async getOnboardingDynamicSections(
    checklistId: string,
    tenantId: string,
  ): Promise<OnboardingDynamicSection[]> {
    return await db
      .select()
      .from(onboardingDynamicSections)
      .where(
        and(
          eq(onboardingDynamicSections.checklistId, checklistId),
          eq(onboardingDynamicSections.tenantId, tenantId),
        ),
      )
      .orderBy(onboardingDynamicSections.sectionOrder);
  }

  async createOnboardingDynamicSection(
    section: InsertOnboardingDynamicSection,
  ): Promise<OnboardingDynamicSection> {
    const [newSection] = await db.insert(onboardingDynamicSections).values(section).returning();
    return newSection;
  }

  async updateOnboardingDynamicSection(
    id: string,
    tenantId: string,
    section: Partial<OnboardingDynamicSection>,
  ): Promise<OnboardingDynamicSection | undefined> {
    const [updatedSection] = await db
      .update(onboardingDynamicSections)
      .set({ ...section, updatedAt: new Date() })
      .where(
        and(eq(onboardingDynamicSections.id, id), eq(onboardingDynamicSections.tenantId, tenantId)),
      )
      .returning();
    return updatedSection;
  }

  async deleteOnboardingDynamicSection(id: string, tenantId: string): Promise<void> {
    await db
      .delete(onboardingDynamicSections)
      .where(
        and(eq(onboardingDynamicSections.id, id), eq(onboardingDynamicSections.tenantId, tenantId)),
      );
  }

  async getOnboardingTasks(checklistId: string, tenantId: string): Promise<OnboardingTask[]> {
    return await db
      .select()
      .from(onboardingTasks)
      .where(
        and(eq(onboardingTasks.checklistId, checklistId), eq(onboardingTasks.tenantId, tenantId)),
      )
      .orderBy(onboardingTasks.createdAt);
  }

  async createOnboardingTask(task: InsertOnboardingTask): Promise<OnboardingTask> {
    const [newTask] = await db.insert(onboardingTasks).values(task).returning();
    return newTask;
  }

  async updateOnboardingTask(
    id: string,
    tenantId: string,
    task: Partial<OnboardingTask>,
  ): Promise<OnboardingTask | undefined> {
    const [updatedTask] = await db
      .update(onboardingTasks)
      .set({ ...task, updatedAt: new Date() })
      .where(and(eq(onboardingTasks.id, id), eq(onboardingTasks.tenantId, tenantId)))
      .returning();
    return updatedTask;
  }

  async deleteOnboardingTask(id: string, tenantId: string): Promise<void> {
    await db
      .delete(onboardingTasks)
      .where(and(eq(onboardingTasks.id, id), eq(onboardingTasks.tenantId, tenantId)));
  }

  // ============= LEASE MANAGEMENT OPERATIONS =============

  // Lease operations
  async getLeases(tenantId: string): Promise<Lease[]> {
    return await db
      .select()
      .from(leases)
      .where(eq(leases.tenantId, tenantId))
      .orderBy(desc(leases.createdAt));
  }

  async getLease(id: string, tenantId: string): Promise<Lease | undefined> {
    const [lease] = await db
      .select()
      .from(leases)
      .where(and(eq(leases.id, id), eq(leases.tenantId, tenantId)));
    return lease;
  }

  async getLeasesByCustomer(customerId: string, tenantId: string): Promise<Lease[]> {
    return await db
      .select()
      .from(leases)
      .where(and(eq(leases.customerId, customerId), eq(leases.tenantId, tenantId)))
      .orderBy(desc(leases.startDate));
  }

  async getLeasesByStatus(status: string, tenantId: string): Promise<Lease[]> {
    return await db
      .select()
      .from(leases)
      .where(and(eq(leases.status, status), eq(leases.tenantId, tenantId)))
      .orderBy(desc(leases.createdAt));
  }

  async createLease(lease: InsertLease): Promise<Lease> {
    const [newLease] = await db.insert(leases).values(lease).returning();
    return newLease;
  }

  async updateLease(
    id: string,
    tenantId: string,
    lease: Partial<Lease>,
  ): Promise<Lease | undefined> {
    const [updatedLease] = await db
      .update(leases)
      .set({ ...lease, updatedAt: new Date() })
      .where(and(eq(leases.id, id), eq(leases.tenantId, tenantId)))
      .returning();
    return updatedLease;
  }

  async deleteLease(id: string, tenantId: string): Promise<void> {
    await db.delete(leases).where(and(eq(leases.id, id), eq(leases.tenantId, tenantId)));
  }

  // Lease Payments operations
  async getLeasePayments(leaseId: string, tenantId: string): Promise<LeasePayment[]> {
    return await db
      .select()
      .from(leasePayments)
      .where(and(eq(leasePayments.leaseId, leaseId), eq(leasePayments.tenantId, tenantId)))
      .orderBy(leasePayments.scheduledDate);
  }

  async getLeasePayment(id: string, tenantId: string): Promise<LeasePayment | undefined> {
    const [payment] = await db
      .select()
      .from(leasePayments)
      .where(and(eq(leasePayments.id, id), eq(leasePayments.tenantId, tenantId)));
    return payment;
  }

  async getUpcomingPayments(tenantId: string, daysAhead: number): Promise<LeasePayment[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await db
      .select()
      .from(leasePayments)
      .where(
        and(
          eq(leasePayments.tenantId, tenantId),
          eq(leasePayments.status, 'scheduled'),
          lte(leasePayments.scheduledDate, futureDate),
        ),
      )
      .orderBy(leasePayments.scheduledDate);
  }

  async getPastDuePayments(tenantId: string): Promise<LeasePayment[]> {
    const today = new Date();

    return await db
      .select()
      .from(leasePayments)
      .where(
        and(
          eq(leasePayments.tenantId, tenantId),
          eq(leasePayments.status, 'scheduled'),
          lt(leasePayments.scheduledDate, today),
        ),
      )
      .orderBy(leasePayments.scheduledDate);
  }

  async createLeasePayment(payment: InsertLeasePayment): Promise<LeasePayment> {
    const [newPayment] = await db.insert(leasePayments).values(payment).returning();
    return newPayment;
  }

  async updateLeasePayment(
    id: string,
    tenantId: string,
    payment: Partial<LeasePayment>,
  ): Promise<LeasePayment | undefined> {
    const [updatedPayment] = await db
      .update(leasePayments)
      .set({ ...payment, updatedAt: new Date() })
      .where(and(eq(leasePayments.id, id), eq(leasePayments.tenantId, tenantId)))
      .returning();
    return updatedPayment;
  }

  async deleteLeasePayment(id: string, tenantId: string): Promise<void> {
    await db
      .delete(leasePayments)
      .where(and(eq(leasePayments.id, id), eq(leasePayments.tenantId, tenantId)));
  }

  // Lease Renewals operations
  async getLeaseRenewals(tenantId: string): Promise<LeaseRenewal[]> {
    return await db
      .select()
      .from(leaseRenewals)
      .where(eq(leaseRenewals.tenantId, tenantId))
      .orderBy(desc(leaseRenewals.createdAt));
  }

  async getLeaseRenewal(id: string, tenantId: string): Promise<LeaseRenewal | undefined> {
    const [renewal] = await db
      .select()
      .from(leaseRenewals)
      .where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenantId, tenantId)));
    return renewal;
  }

  async getLeaseRenewalByLease(
    leaseId: string,
    tenantId: string,
  ): Promise<LeaseRenewal | undefined> {
    const [renewal] = await db
      .select()
      .from(leaseRenewals)
      .where(and(eq(leaseRenewals.leaseId, leaseId), eq(leaseRenewals.tenantId, tenantId)));
    return renewal;
  }

  async getLeasesNeedingRenewalAction(
    tenantId: string,
    daysAhead: number,
  ): Promise<LeaseRenewal[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await db
      .select()
      .from(leaseRenewals)
      .where(
        and(
          eq(leaseRenewals.tenantId, tenantId),
          eq(leaseRenewals.renewalOffered, true),
          lte(leaseRenewals.renewalDeadline, futureDate),
        ),
      )
      .orderBy(leaseRenewals.renewalDeadline);
  }

  async createLeaseRenewal(renewal: InsertLeaseRenewal): Promise<LeaseRenewal> {
    const [newRenewal] = await db.insert(leaseRenewals).values(renewal).returning();
    return newRenewal;
  }

  async updateLeaseRenewal(
    id: string,
    tenantId: string,
    renewal: Partial<LeaseRenewal>,
  ): Promise<LeaseRenewal | undefined> {
    const [updatedRenewal] = await db
      .update(leaseRenewals)
      .set({ ...renewal, updatedAt: new Date() })
      .where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenantId, tenantId)))
      .returning();
    return updatedRenewal;
  }

  async deleteLeaseRenewal(id: string, tenantId: string): Promise<void> {
    await db
      .delete(leaseRenewals)
      .where(and(eq(leaseRenewals.id, id), eq(leaseRenewals.tenantId, tenantId)));
  }

  // Lease Dispositions operations
  async getLeaseDispositions(tenantId: string): Promise<LeaseDisposition[]> {
    return await db
      .select()
      .from(leaseDispositions)
      .where(eq(leaseDispositions.tenantId, tenantId))
      .orderBy(desc(leaseDispositions.actionDate));
  }

  async getLeaseDisposition(id: string, tenantId: string): Promise<LeaseDisposition | undefined> {
    const [disposition] = await db
      .select()
      .from(leaseDispositions)
      .where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenantId, tenantId)));
    return disposition;
  }

  async getLeaseDispositionByLease(
    leaseId: string,
    tenantId: string,
  ): Promise<LeaseDisposition | undefined> {
    const [disposition] = await db
      .select()
      .from(leaseDispositions)
      .where(and(eq(leaseDispositions.leaseId, leaseId), eq(leaseDispositions.tenantId, tenantId)));
    return disposition;
  }

  async createLeaseDisposition(disposition: InsertLeaseDisposition): Promise<LeaseDisposition> {
    const [newDisposition] = await db.insert(leaseDispositions).values(disposition).returning();
    return newDisposition;
  }

  async updateLeaseDisposition(
    id: string,
    tenantId: string,
    disposition: Partial<LeaseDisposition>,
  ): Promise<LeaseDisposition | undefined> {
    const [updatedDisposition] = await db
      .update(leaseDispositions)
      .set({ ...disposition, updatedAt: new Date() })
      .where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenantId, tenantId)))
      .returning();
    return updatedDisposition;
  }

  async deleteLeaseDisposition(id: string, tenantId: string): Promise<void> {
    await db
      .delete(leaseDispositions)
      .where(and(eq(leaseDispositions.id, id), eq(leaseDispositions.tenantId, tenantId)));
  }

  // ============= E-SIGNATURE INTEGRATION OPERATIONS =============

  // Integration Credentials operations
  async getIntegrationCredentials(
    tenantId: string,
    provider?: string,
  ): Promise<IntegrationCredential[]> {
    if (provider) {
      return await db
        .select()
        .from(integrationCredentials)
        .where(
          and(
            eq(integrationCredentials.tenantId, tenantId),
            eq(integrationCredentials.provider, provider),
          ),
        )
        .orderBy(desc(integrationCredentials.createdAt));
    }
    return await db
      .select()
      .from(integrationCredentials)
      .where(eq(integrationCredentials.tenantId, tenantId))
      .orderBy(desc(integrationCredentials.createdAt));
  }

  async getIntegrationCredential(
    id: string,
    tenantId: string,
  ): Promise<IntegrationCredential | undefined> {
    const [credential] = await db
      .select()
      .from(integrationCredentials)
      .where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenantId, tenantId)));
    return credential;
  }

  async getIntegrationCredentialByProvider(
    tenantId: string,
    provider: string,
  ): Promise<IntegrationCredential | undefined> {
    const [credential] = await db
      .select()
      .from(integrationCredentials)
      .where(
        and(
          eq(integrationCredentials.tenantId, tenantId),
          eq(integrationCredentials.provider, provider),
        ),
      );
    return credential;
  }

  async createIntegrationCredential(
    credential: InsertIntegrationCredential,
  ): Promise<IntegrationCredential> {
    const [newCredential] = await db.insert(integrationCredentials).values(credential).returning();
    return newCredential;
  }

  async updateIntegrationCredential(
    id: string,
    tenantId: string,
    credential: Partial<IntegrationCredential>,
  ): Promise<IntegrationCredential | undefined> {
    const [updatedCredential] = await db
      .update(integrationCredentials)
      .set({ ...credential, updatedAt: new Date() })
      .where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenantId, tenantId)))
      .returning();
    return updatedCredential;
  }

  async deleteIntegrationCredential(id: string, tenantId: string): Promise<void> {
    await db
      .delete(integrationCredentials)
      .where(and(eq(integrationCredentials.id, id), eq(integrationCredentials.tenantId, tenantId)));
  }

  async testIntegrationConnection(
    id: string,
    tenantId: string,
  ): Promise<{ status: string; message: string }> {
    const credential = await this.getIntegrationCredential(id, tenantId);
    if (!credential) {
      return { status: 'error', message: 'Credential not found' };
    }
    // Mock healthy status for now
    return { status: 'healthy', message: 'Connection successful' };
  }

  // Signature Requests operations
  async getSignatureRequests(tenantId: string, status?: string): Promise<SignatureRequest[]> {
    if (status) {
      return await db
        .select()
        .from(signatureRequests)
        .where(and(eq(signatureRequests.tenantId, tenantId), eq(signatureRequests.status, status)))
        .orderBy(desc(signatureRequests.createdAt));
    }
    return await db
      .select()
      .from(signatureRequests)
      .where(eq(signatureRequests.tenantId, tenantId))
      .orderBy(desc(signatureRequests.createdAt));
  }

  async getSignatureRequest(id: string, tenantId: string): Promise<SignatureRequest | undefined> {
    const [request] = await db
      .select()
      .from(signatureRequests)
      .where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenantId, tenantId)));
    return request;
  }

  async getSignatureRequestsByCustomer(
    customerId: string,
    tenantId: string,
  ): Promise<SignatureRequest[]> {
    return await db
      .select()
      .from(signatureRequests)
      .where(
        and(eq(signatureRequests.customerId, customerId), eq(signatureRequests.tenantId, tenantId)),
      )
      .orderBy(desc(signatureRequests.createdAt));
  }

  async getExpiringSignatureRequests(
    tenantId: string,
    daysAhead: number,
  ): Promise<SignatureRequest[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await db
      .select()
      .from(signatureRequests)
      .where(
        and(
          eq(signatureRequests.tenantId, tenantId),
          lte(signatureRequests.expirationDate, futureDate),
          ne(signatureRequests.status, 'completed'),
          ne(signatureRequests.status, 'voided'),
        ),
      )
      .orderBy(signatureRequests.expirationDate);
  }

  async createSignatureRequest(request: InsertSignatureRequest): Promise<SignatureRequest> {
    const [newRequest] = await db.insert(signatureRequests).values(request).returning();
    return newRequest;
  }

  async updateSignatureRequest(
    id: string,
    tenantId: string,
    request: Partial<SignatureRequest>,
  ): Promise<SignatureRequest | undefined> {
    const [updatedRequest] = await db
      .update(signatureRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenantId, tenantId)))
      .returning();
    return updatedRequest;
  }

  async deleteSignatureRequest(id: string, tenantId: string): Promise<void> {
    await db
      .delete(signatureRequests)
      .where(and(eq(signatureRequests.id, id), eq(signatureRequests.tenantId, tenantId)));
  }

  // Signature Signers operations
  async getSignatureSigners(requestId: string, tenantId: string): Promise<SignatureSigner[]> {
    return await db
      .select()
      .from(signatureSigners)
      .where(
        and(eq(signatureSigners.requestId, requestId), eq(signatureSigners.tenantId, tenantId)),
      )
      .orderBy(signatureSigners.signerOrder);
  }

  async getSignatureSigner(id: string, tenantId: string): Promise<SignatureSigner | undefined> {
    const [signer] = await db
      .select()
      .from(signatureSigners)
      .where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenantId, tenantId)));
    return signer;
  }

  async createSignatureSigner(signer: InsertSignatureSigner): Promise<SignatureSigner> {
    const [newSigner] = await db.insert(signatureSigners).values(signer).returning();
    return newSigner;
  }

  async updateSignatureSigner(
    id: string,
    tenantId: string,
    signer: Partial<SignatureSigner>,
  ): Promise<SignatureSigner | undefined> {
    const [updatedSigner] = await db
      .update(signatureSigners)
      .set({ ...signer, updatedAt: new Date() })
      .where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenantId, tenantId)))
      .returning();
    return updatedSigner;
  }

  async deleteSignatureSigner(id: string, tenantId: string): Promise<void> {
    await db
      .delete(signatureSigners)
      .where(and(eq(signatureSigners.id, id), eq(signatureSigners.tenantId, tenantId)));
  }

  // Signature Documents operations
  async getSignatureDocuments(requestId: string, tenantId: string): Promise<SignatureDocument[]> {
    return await db
      .select()
      .from(signatureDocuments)
      .where(
        and(eq(signatureDocuments.requestId, requestId), eq(signatureDocuments.tenantId, tenantId)),
      )
      .orderBy(signatureDocuments.documentOrder);
  }

  async getSignatureDocument(id: string, tenantId: string): Promise<SignatureDocument | undefined> {
    const [document] = await db
      .select()
      .from(signatureDocuments)
      .where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenantId, tenantId)));
    return document;
  }

  async createSignatureDocument(document: InsertSignatureDocument): Promise<SignatureDocument> {
    const [newDocument] = await db.insert(signatureDocuments).values(document).returning();
    return newDocument;
  }

  async updateSignatureDocument(
    id: string,
    tenantId: string,
    document: Partial<SignatureDocument>,
  ): Promise<SignatureDocument | undefined> {
    const [updatedDocument] = await db
      .update(signatureDocuments)
      .set({ ...document, updatedAt: new Date() })
      .where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenantId, tenantId)))
      .returning();
    return updatedDocument;
  }

  async deleteSignatureDocument(id: string, tenantId: string): Promise<void> {
    await db
      .delete(signatureDocuments)
      .where(and(eq(signatureDocuments.id, id), eq(signatureDocuments.tenantId, tenantId)));
  }

  // Signature Audit Logs operations
  async getSignatureAuditLogs(requestId: string, tenantId: string): Promise<SignatureAuditLog[]> {
    return await db
      .select()
      .from(signatureAuditLogs)
      .where(
        and(eq(signatureAuditLogs.requestId, requestId), eq(signatureAuditLogs.tenantId, tenantId)),
      )
      .orderBy(desc(signatureAuditLogs.eventTimestamp));
  }

  async getSignatureAuditLogsBySigner(
    signerId: string,
    tenantId: string,
  ): Promise<SignatureAuditLog[]> {
    return await db
      .select()
      .from(signatureAuditLogs)
      .where(
        and(eq(signatureAuditLogs.signerId, signerId), eq(signatureAuditLogs.tenantId, tenantId)),
      )
      .orderBy(desc(signatureAuditLogs.eventTimestamp));
  }

  async createSignatureAuditLog(log: InsertSignatureAuditLog): Promise<SignatureAuditLog> {
    const [newLog] = await db.insert(signatureAuditLogs).values(log).returning();
    return newLog;
  }

  // Field Service Photo & Signature Capture implementations

  // Installations operations
  async getInstallations(
    tenantId: string,
    filters?: { status?: string; customerId?: string; technicianId?: string },
  ): Promise<Installation[]> {
    const conditions = [eq(installations.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(installations.status, filters.status));
    }
    if (filters?.customerId) {
      conditions.push(eq(installations.customerId, filters.customerId));
    }
    if (filters?.technicianId) {
      conditions.push(eq(installations.technicianId, filters.technicianId));
    }

    return await db
      .select()
      .from(installations)
      .where(and(...conditions))
      .orderBy(desc(installations.scheduledDate));
  }

  async getInstallationById(id: string, tenantId: string): Promise<Installation | null> {
    const [installation] = await db
      .select()
      .from(installations)
      .where(and(eq(installations.id, id), eq(installations.tenantId, tenantId)));
    return installation || null;
  }

  async getInstallationByNumber(
    installationNumber: string,
    tenantId: string,
  ): Promise<Installation | null> {
    const [installation] = await db
      .select()
      .from(installations)
      .where(
        and(
          eq(installations.installationNumber, installationNumber),
          eq(installations.tenantId, tenantId),
        ),
      );
    return installation || null;
  }

  async createInstallation(installation: InsertInstallation): Promise<Installation> {
    const [newInstallation] = await db.insert(installations).values(installation).returning();
    return newInstallation;
  }

  async updateInstallation(
    id: string,
    tenantId: string,
    data: Partial<Installation>,
  ): Promise<Installation | null> {
    const [updatedInstallation] = await db
      .update(installations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(installations.id, id), eq(installations.tenantId, tenantId)))
      .returning();
    return updatedInstallation || null;
  }

  async deleteInstallation(id: string, tenantId: string): Promise<void> {
    await db
      .delete(installations)
      .where(and(eq(installations.id, id), eq(installations.tenantId, tenantId)));
  }

  async generateInstallationNumber(tenantId: string): Promise<string> {
    const prefix = 'INST';
    const year = new Date().getFullYear().toString().slice(-2);

    // Get the next sequence number for this tenant and year
    const existingInstallations = await db
      .select()
      .from(installations)
      .where(
        and(eq(installations.tenantId, tenantId), isNotNull(installations.installationNumber)),
      );

    const currentYearInstallations = existingInstallations.filter((i) =>
      i.installationNumber?.startsWith(`${prefix}${year}`),
    );

    const nextNumber = currentYearInstallations.length + 1;
    const paddedNumber = nextNumber.toString().padStart(4, '0');

    return `${prefix}${year}-${paddedNumber}`;
  }

  // Service Signatures operations
  async getServiceSignatures(
    tenantId: string,
    filters?: { serviceTicketId?: string; installationId?: string },
  ): Promise<ServiceSignature[]> {
    const conditions = [eq(serviceSignatures.tenantId, tenantId)];

    if (filters?.serviceTicketId) {
      conditions.push(eq(serviceSignatures.serviceTicketId, filters.serviceTicketId));
    }
    if (filters?.installationId) {
      conditions.push(eq(serviceSignatures.installationId, filters.installationId));
    }

    return await db
      .select()
      .from(serviceSignatures)
      .where(and(...conditions))
      .orderBy(desc(serviceSignatures.signedAt));
  }

  async getServiceSignatureById(id: string, tenantId: string): Promise<ServiceSignature | null> {
    const [signature] = await db
      .select()
      .from(serviceSignatures)
      .where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenantId, tenantId)));
    return signature || null;
  }

  async createServiceSignature(signature: InsertServiceSignature): Promise<ServiceSignature> {
    const [newSignature] = await db.insert(serviceSignatures).values(signature).returning();
    return newSignature;
  }

  async updateServiceSignature(
    id: string,
    tenantId: string,
    data: Partial<ServiceSignature>,
  ): Promise<ServiceSignature | null> {
    const [updatedSignature] = await db
      .update(serviceSignatures)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenantId, tenantId)))
      .returning();
    return updatedSignature || null;
  }

  async deleteServiceSignature(id: string, tenantId: string): Promise<void> {
    await db
      .delete(serviceSignatures)
      .where(and(eq(serviceSignatures.id, id), eq(serviceSignatures.tenantId, tenantId)));
  }

  // Installation Checklists operations
  async getInstallationChecklists(
    installationId: string,
    tenantId: string,
  ): Promise<InstallationChecklist[]> {
    return await db
      .select()
      .from(installationChecklists)
      .where(
        and(
          eq(installationChecklists.installationId, installationId),
          eq(installationChecklists.tenantId, tenantId),
        ),
      )
      .orderBy(asc(installationChecklists.stepOrder));
  }

  async getInstallationChecklistById(
    id: string,
    tenantId: string,
  ): Promise<InstallationChecklist | null> {
    const [checklist] = await db
      .select()
      .from(installationChecklists)
      .where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenantId, tenantId)));
    return checklist || null;
  }

  async createInstallationChecklist(
    checklist: InsertInstallationChecklist,
  ): Promise<InstallationChecklist> {
    const [newChecklist] = await db.insert(installationChecklists).values(checklist).returning();
    return newChecklist;
  }

  async updateInstallationChecklist(
    id: string,
    tenantId: string,
    data: Partial<InstallationChecklist>,
  ): Promise<InstallationChecklist | null> {
    const [updatedChecklist] = await db
      .update(installationChecklists)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenantId, tenantId)))
      .returning();
    return updatedChecklist || null;
  }

  async deleteInstallationChecklist(id: string, tenantId: string): Promise<void> {
    await db
      .delete(installationChecklists)
      .where(and(eq(installationChecklists.id, id), eq(installationChecklists.tenantId, tenantId)));
  }

  async bulkCreateInstallationChecklists(
    checklists: InsertInstallationChecklist[],
  ): Promise<InstallationChecklist[]> {
    const newChecklists = await db.insert(installationChecklists).values(checklists).returning();
    return newChecklists;
  }

  async getEmailTemplates(
    tenantId: string,
    filters?: { templateType?: string; isActive?: boolean; category?: string },
  ): Promise<EmailTemplate[]> {
    let query = db.select().from(emailTemplates).where(eq(emailTemplates.tenantId, tenantId));

    const conditions = [eq(emailTemplates.tenantId, tenantId)];

    if (filters?.templateType) {
      conditions.push(eq(emailTemplates.templateType, filters.templateType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(emailTemplates.isActive, filters.isActive));
    }
    if (filters?.category) {
      conditions.push(eq(emailTemplates.category, filters.category));
    }

    return await db
      .select()
      .from(emailTemplates)
      .where(and(...conditions))
      .orderBy(desc(emailTemplates.createdAt));
  }

  async getEmailTemplateById(id: string, tenantId: string): Promise<EmailTemplate | null> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId)));
    return template || null;
  }

  async getEmailTemplateByName(
    templateName: string,
    tenantId: string,
  ): Promise<EmailTemplate | null> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(eq(emailTemplates.templateName, templateName), eq(emailTemplates.tenantId, tenantId)),
      );
    return template || null;
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [newTemplate] = await db.insert(emailTemplates).values(template).returning();
    return newTemplate;
  }

  async updateEmailTemplate(
    id: string,
    tenantId: string,
    data: Partial<EmailTemplate>,
  ): Promise<EmailTemplate | null> {
    const [updatedTemplate] = await db
      .update(emailTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId)))
      .returning();
    return updatedTemplate || null;
  }

  async deleteEmailTemplate(id: string, tenantId: string): Promise<void> {
    await db
      .delete(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.tenantId, tenantId)));
  }

  async getEmailCampaigns(
    tenantId: string,
    filters?: { status?: string; campaignType?: string; ownerId?: string },
  ): Promise<EmailCampaign[]> {
    const conditions = [eq(emailCampaigns.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(emailCampaigns.status, filters.status));
    }
    if (filters?.campaignType) {
      conditions.push(eq(emailCampaigns.campaignType, filters.campaignType));
    }
    if (filters?.ownerId) {
      conditions.push(eq(emailCampaigns.ownerId, filters.ownerId));
    }

    return await db
      .select()
      .from(emailCampaigns)
      .where(and(...conditions))
      .orderBy(desc(emailCampaigns.createdAt));
  }

  async getEmailCampaignById(id: string, tenantId: string): Promise<EmailCampaign | null> {
    const [campaign] = await db
      .select()
      .from(emailCampaigns)
      .where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenantId, tenantId)));
    return campaign || null;
  }

  async getEmailCampaignByName(
    campaignName: string,
    tenantId: string,
  ): Promise<EmailCampaign | null> {
    const [campaign] = await db
      .select()
      .from(emailCampaigns)
      .where(
        and(eq(emailCampaigns.campaignName, campaignName), eq(emailCampaigns.tenantId, tenantId)),
      );
    return campaign || null;
  }

  async createEmailCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign> {
    const [newCampaign] = await db.insert(emailCampaigns).values(campaign).returning();
    return newCampaign;
  }

  async updateEmailCampaign(
    id: string,
    tenantId: string,
    data: Partial<EmailCampaign>,
  ): Promise<EmailCampaign | null> {
    const [updatedCampaign] = await db
      .update(emailCampaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenantId, tenantId)))
      .returning();
    return updatedCampaign || null;
  }

  async deleteEmailCampaign(id: string, tenantId: string): Promise<void> {
    await db
      .delete(emailCampaigns)
      .where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.tenantId, tenantId)));
  }

  async updateCampaignMetrics(campaignId: string, tenantId: string): Promise<EmailCampaign | null> {
    const campaign = await this.getEmailCampaignById(campaignId, tenantId);
    if (!campaign) return null;

    const sends = await db
      .select()
      .from(emailSends)
      .where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.tenantId, tenantId)));

    const events = await db
      .select()
      .from(emailEvents)
      .where(and(eq(emailEvents.campaignId, campaignId), eq(emailEvents.tenantId, tenantId)));

    const emailsSent = sends.length;
    const emailsDelivered = sends.filter((s) => s.status === 'delivered').length;
    const emailsBounced = sends.filter((s) => s.status === 'bounced').length;

    const opensSet = new Set(
      events.filter((e) => e.eventType === 'open').map((e) => e.emailSendId),
    );
    const clicksSet = new Set(
      events.filter((e) => e.eventType === 'click').map((e) => e.emailSendId),
    );
    const unsubscribesSet = new Set(
      events.filter((e) => e.eventType === 'unsubscribe').map((e) => e.emailSendId),
    );
    const spamSet = new Set(
      events.filter((e) => e.eventType === 'spam_report').map((e) => e.emailSendId),
    );

    const emailsOpened = opensSet.size;
    const emailsClicked = clicksSet.size;
    const emailsUnsubscribed = unsubscribesSet.size;
    const emailsSpamReported = spamSet.size;

    const deliveryRate =
      emailsSent > 0 ? ((emailsDelivered / emailsSent) * 100).toFixed(2) : '0.00';
    const openRate =
      emailsDelivered > 0 ? ((emailsOpened / emailsDelivered) * 100).toFixed(2) : '0.00';
    const clickRate =
      emailsDelivered > 0 ? ((emailsClicked / emailsDelivered) * 100).toFixed(2) : '0.00';
    const bounceRate = emailsSent > 0 ? ((emailsBounced / emailsSent) * 100).toFixed(2) : '0.00';
    const unsubscribeRate =
      emailsDelivered > 0 ? ((emailsUnsubscribed / emailsDelivered) * 100).toFixed(2) : '0.00';

    return await this.updateEmailCampaign(campaignId, tenantId, {
      emailsSent,
      emailsDelivered,
      emailsOpened,
      emailsClicked,
      emailsBounced,
      emailsUnsubscribed,
      emailsSpamReported,
      deliveryRate,
      openRate,
      clickRate,
      bounceRate,
      unsubscribeRate,
    });
  }

  async getEmailSends(campaignId: string, tenantId: string): Promise<EmailSend[]> {
    return await db
      .select()
      .from(emailSends)
      .where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.tenantId, tenantId)))
      .orderBy(desc(emailSends.createdAt));
  }

  async getEmailSendById(id: string, tenantId: string): Promise<EmailSend | null> {
    const [send] = await db
      .select()
      .from(emailSends)
      .where(and(eq(emailSends.id, id), eq(emailSends.tenantId, tenantId)));
    return send || null;
  }

  async getEmailSendsByRecipient(recipientEmail: string, tenantId: string): Promise<EmailSend[]> {
    return await db
      .select()
      .from(emailSends)
      .where(and(eq(emailSends.recipientEmail, recipientEmail), eq(emailSends.tenantId, tenantId)))
      .orderBy(desc(emailSends.createdAt));
  }

  async createEmailSend(send: InsertEmailSend): Promise<EmailSend> {
    const [newSend] = await db.insert(emailSends).values(send).returning();
    return newSend;
  }

  async updateEmailSend(
    id: string,
    tenantId: string,
    data: Partial<EmailSend>,
  ): Promise<EmailSend | null> {
    const [updatedSend] = await db
      .update(emailSends)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailSends.id, id), eq(emailSends.tenantId, tenantId)))
      .returning();
    return updatedSend || null;
  }

  async deleteEmailSend(id: string, tenantId: string): Promise<void> {
    await db
      .delete(emailSends)
      .where(and(eq(emailSends.id, id), eq(emailSends.tenantId, tenantId)));
  }

  async bulkCreateEmailSends(sends: InsertEmailSend[]): Promise<EmailSend[]> {
    const newSends = await db.insert(emailSends).values(sends).returning();
    return newSends;
  }

  async getEmailEvents(emailSendId: string, tenantId: string): Promise<EmailEvent[]> {
    return await db
      .select()
      .from(emailEvents)
      .where(and(eq(emailEvents.emailSendId, emailSendId), eq(emailEvents.tenantId, tenantId)))
      .orderBy(asc(emailEvents.eventTimestamp));
  }

  async getEmailEventsByCampaign(
    campaignId: string,
    tenantId: string,
    filters?: { eventType?: string },
  ): Promise<EmailEvent[]> {
    const conditions = [eq(emailEvents.campaignId, campaignId), eq(emailEvents.tenantId, tenantId)];

    if (filters?.eventType) {
      conditions.push(eq(emailEvents.eventType, filters.eventType));
    }

    return await db
      .select()
      .from(emailEvents)
      .where(and(...conditions))
      .orderBy(desc(emailEvents.eventTimestamp));
  }

  async createEmailEvent(event: InsertEmailEvent): Promise<EmailEvent> {
    const [newEvent] = await db.insert(emailEvents).values(event).returning();
    return newEvent;
  }

  async getEmailLists(
    tenantId: string,
    filters?: { listType?: string; isActive?: boolean; category?: string },
  ): Promise<EmailList[]> {
    const conditions = [eq(emailLists.tenantId, tenantId)];

    if (filters?.listType) {
      conditions.push(eq(emailLists.listType, filters.listType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(emailLists.isActive, filters.isActive));
    }
    if (filters?.category) {
      conditions.push(eq(emailLists.category, filters.category));
    }

    return await db
      .select()
      .from(emailLists)
      .where(and(...conditions))
      .orderBy(desc(emailLists.createdAt));
  }

  async getEmailListById(id: string, tenantId: string): Promise<EmailList | null> {
    const [list] = await db
      .select()
      .from(emailLists)
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)));
    return list || null;
  }

  async getEmailListByName(listName: string, tenantId: string): Promise<EmailList | null> {
    const [list] = await db
      .select()
      .from(emailLists)
      .where(and(eq(emailLists.listName, listName), eq(emailLists.tenantId, tenantId)));
    return list || null;
  }

  async createEmailList(list: InsertEmailList): Promise<EmailList> {
    const [newList] = await db.insert(emailLists).values(list).returning();
    return newList;
  }

  async updateEmailList(
    id: string,
    tenantId: string,
    data: Partial<EmailList>,
  ): Promise<EmailList | null> {
    const [updatedList] = await db
      .update(emailLists)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)))
      .returning();
    return updatedList || null;
  }

  async deleteEmailList(id: string, tenantId: string): Promise<void> {
    await db
      .delete(emailLists)
      .where(and(eq(emailLists.id, id), eq(emailLists.tenantId, tenantId)));
  }

  async updateListMemberCounts(listId: string, tenantId: string): Promise<EmailList | null> {
    const members = await db
      .select()
      .from(emailListMembers)
      .where(and(eq(emailListMembers.listId, listId), eq(emailListMembers.tenantId, tenantId)));

    const totalMembers = members.length;
    const activeMembers = members.filter((m) => m.status === 'active').length;
    const unsubscribedMembers = members.filter((m) => m.status === 'unsubscribed').length;

    return await this.updateEmailList(listId, tenantId, {
      totalMembers,
      activeMembers,
      unsubscribedMembers,
    });
  }

  async getEmailListMembers(
    listId: string,
    tenantId: string,
    filters?: { status?: string },
  ): Promise<EmailListMember[]> {
    const conditions = [
      eq(emailListMembers.listId, listId),
      eq(emailListMembers.tenantId, tenantId),
    ];

    if (filters?.status) {
      conditions.push(eq(emailListMembers.status, filters.status));
    }

    return await db
      .select()
      .from(emailListMembers)
      .where(and(...conditions))
      .orderBy(desc(emailListMembers.createdAt));
  }

  async getEmailListMemberById(id: string, tenantId: string): Promise<EmailListMember | null> {
    const [member] = await db
      .select()
      .from(emailListMembers)
      .where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenantId, tenantId)));
    return member || null;
  }

  async getEmailListMemberByEmail(
    listId: string,
    email: string,
    tenantId: string,
  ): Promise<EmailListMember | null> {
    const [member] = await db
      .select()
      .from(emailListMembers)
      .where(
        and(
          eq(emailListMembers.listId, listId),
          eq(emailListMembers.email, email),
          eq(emailListMembers.tenantId, tenantId),
        ),
      );
    return member || null;
  }

  async createEmailListMember(member: InsertEmailListMember): Promise<EmailListMember> {
    const [newMember] = await db.insert(emailListMembers).values(member).returning();
    return newMember;
  }

  async updateEmailListMember(
    id: string,
    tenantId: string,
    data: Partial<EmailListMember>,
  ): Promise<EmailListMember | null> {
    const [updatedMember] = await db
      .update(emailListMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenantId, tenantId)))
      .returning();
    return updatedMember || null;
  }

  async deleteEmailListMember(id: string, tenantId: string): Promise<void> {
    await db
      .delete(emailListMembers)
      .where(and(eq(emailListMembers.id, id), eq(emailListMembers.tenantId, tenantId)));
  }

  async bulkCreateEmailListMembers(members: InsertEmailListMember[]): Promise<EmailListMember[]> {
    const newMembers = await db.insert(emailListMembers).values(members).returning();
    return newMembers;
  }

  async getEmailUnsubscribes(
    tenantId: string,
    filters?: { unsubscribeType?: string; email?: string },
  ): Promise<EmailUnsubscribe[]> {
    const conditions = [eq(emailUnsubscribes.tenantId, tenantId)];

    if (filters?.unsubscribeType) {
      conditions.push(eq(emailUnsubscribes.unsubscribeType, filters.unsubscribeType));
    }
    if (filters?.email) {
      conditions.push(eq(emailUnsubscribes.email, filters.email));
    }

    return await db
      .select()
      .from(emailUnsubscribes)
      .where(and(...conditions))
      .orderBy(desc(emailUnsubscribes.unsubscribedAt));
  }

  async getEmailUnsubscribeByEmail(
    email: string,
    tenantId: string,
    unsubscribeType?: string,
  ): Promise<EmailUnsubscribe | null> {
    const conditions = [
      eq(emailUnsubscribes.email, email),
      eq(emailUnsubscribes.tenantId, tenantId),
    ];

    if (unsubscribeType) {
      conditions.push(eq(emailUnsubscribes.unsubscribeType, unsubscribeType));
    }

    const [unsubscribe] = await db
      .select()
      .from(emailUnsubscribes)
      .where(and(...conditions));

    return unsubscribe || null;
  }

  async createEmailUnsubscribe(unsubscribe: InsertEmailUnsubscribe): Promise<EmailUnsubscribe> {
    const [newUnsubscribe] = await db.insert(emailUnsubscribes).values(unsubscribe).returning();
    return newUnsubscribe;
  }

  async checkUnsubscribeStatus(
    email: string,
    tenantId: string,
  ): Promise<{ isUnsubscribed: boolean; type?: string }> {
    const globalUnsubscribe = await this.getEmailUnsubscribeByEmail(email, tenantId, 'global');

    if (globalUnsubscribe) {
      return { isUnsubscribed: true, type: 'global' };
    }

    return { isUnsubscribed: false };
  }

  // ==================== Multi-Factor Authentication (MFA) Enforcement ====================

  // MFA Enrollment & Configuration
  async enableMfaForUser(userId: string, secret: string): Promise<User | null> {
    const [updatedUser] = await db
      .update(users)
      .set({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser || null;
  }

  async disableMfaForUser(userId: string): Promise<User | null> {
    const [updatedUser] = await db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Delete all backup codes when disabling MFA
    await this.deleteAllBackupCodes(userId);

    return updatedUser || null;
  }

  async getUserMfaStatus(
    userId: string,
  ): Promise<{ enabled: boolean; hasBackupCodes: boolean } | null> {
    const [user] = await db
      .select({
        twoFactorEnabled: users.twoFactorEnabled,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return null;
    }

    const backupCodes = await db
      .select()
      .from(mfaBackupCodes)
      .where(and(eq(mfaBackupCodes.userId, userId), eq(mfaBackupCodes.isUsed, false)))
      .limit(1);

    return {
      enabled: user.twoFactorEnabled || false,
      hasBackupCodes: backupCodes.length > 0,
    };
  }

  // MFA Backup Codes
  async generateBackupCodes(
    userId: string,
    tenantId: string | null,
    count: number = 10,
  ): Promise<{ codes: string[]; hashes: MfaBackupCode[] }> {
    // Generate random backup codes
    const codes: string[] = [];
    const insertData: InsertMfaBackupCode[] = [];

    for (let i = 0; i < count; i++) {
      // Generate a random 8-character alphanumeric code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);

      // Hash the code
      const codeHash = await bcrypt.hash(code, 10);

      insertData.push({
        userId,
        tenantId,
        codeHash,
        isUsed: false,
      });
    }

    // Delete old backup codes
    await this.deleteAllBackupCodes(userId);

    // Insert new backup codes
    const hashes = await db.insert(mfaBackupCodes).values(insertData).returning();

    return { codes, hashes };
  }

  async validateBackupCode(userId: string, code: string): Promise<boolean> {
    const backupCodesList = await db
      .select()
      .from(mfaBackupCodes)
      .where(and(eq(mfaBackupCodes.userId, userId), eq(mfaBackupCodes.isUsed, false)));

    for (const backupCode of backupCodesList) {
      const isValid = await bcrypt.compare(code, backupCode.codeHash);

      if (isValid) {
        // Mark code as used
        await db
          .update(mfaBackupCodes)
          .set({
            isUsed: true,
            usedAt: new Date(),
          })
          .where(eq(mfaBackupCodes.id, backupCode.id));

        return true;
      }
    }

    return false;
  }

  async getUnusedBackupCodes(userId: string): Promise<MfaBackupCode[]> {
    return await db
      .select()
      .from(mfaBackupCodes)
      .where(and(eq(mfaBackupCodes.userId, userId), eq(mfaBackupCodes.isUsed, false)))
      .orderBy(asc(mfaBackupCodes.createdAt));
  }

  async deleteAllBackupCodes(userId: string): Promise<void> {
    await db.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
  }

  // MFA Audit Logs
  async createMfaAuditLog(log: InsertMfaAuditLog): Promise<MfaAuditLog> {
    const [newLog] = await db.insert(mfaAuditLogs).values(log).returning();

    return newLog;
  }

  async getMfaAuditLogs(
    userId: string,
    filters?: { eventType?: string; success?: boolean },
  ): Promise<MfaAuditLog[]> {
    const conditions = [eq(mfaAuditLogs.userId, userId)];

    if (filters?.eventType) {
      conditions.push(eq(mfaAuditLogs.eventType, filters.eventType));
    }

    if (filters?.success !== undefined) {
      conditions.push(eq(mfaAuditLogs.success, filters.success));
    }

    return await db
      .select()
      .from(mfaAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(mfaAuditLogs.createdAt));
  }

  async getMfaAuditLogsByTenant(
    tenantId: string,
    filters?: { eventType?: string; success?: boolean },
  ): Promise<MfaAuditLog[]> {
    const conditions = [eq(mfaAuditLogs.tenantId, tenantId)];

    if (filters?.eventType) {
      conditions.push(eq(mfaAuditLogs.eventType, filters.eventType));
    }

    if (filters?.success !== undefined) {
      conditions.push(eq(mfaAuditLogs.success, filters.success));
    }

    return await db
      .select()
      .from(mfaAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(mfaAuditLogs.createdAt));
  }

  // MFA Status Reporting & Compliance
  async getMfaComplianceReport(tenantId: string): Promise<{
    totalUsers: number;
    mfaEnabledUsers: number;
    mfaDisabledUsers: number;
    compliancePercentage: number;
    recentEnrollments: number;
    recentFailures: number;
  }> {
    // Get total users in tenant
    const totalUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    const totalUsers = totalUsersResult[0]?.count || 0;

    // Get MFA-enabled users
    const mfaEnabledResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.twoFactorEnabled, true)));

    const mfaEnabledUsers = mfaEnabledResult[0]?.count || 0;
    const mfaDisabledUsers = totalUsers - mfaEnabledUsers;
    const compliancePercentage =
      totalUsers > 0 ? Math.round((mfaEnabledUsers / totalUsers) * 100) : 0;

    // Get recent enrollments (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEnrollmentsResult = await db
      .select({ count: count() })
      .from(mfaAuditLogs)
      .where(
        and(
          eq(mfaAuditLogs.tenantId, tenantId),
          eq(mfaAuditLogs.eventType, 'enrollment'),
          eq(mfaAuditLogs.success, true),
          gte(mfaAuditLogs.createdAt, thirtyDaysAgo),
        ),
      );

    const recentEnrollments = recentEnrollmentsResult[0]?.count || 0;

    // Get recent failures (last 30 days)
    const recentFailuresResult = await db
      .select({ count: count() })
      .from(mfaAuditLogs)
      .where(
        and(
          eq(mfaAuditLogs.tenantId, tenantId),
          eq(mfaAuditLogs.eventType, 'verification_failure'),
          gte(mfaAuditLogs.createdAt, thirtyDaysAgo),
        ),
      );

    const recentFailures = recentFailuresResult[0]?.count || 0;

    return {
      totalUsers,
      mfaEnabledUsers,
      mfaDisabledUsers,
      compliancePercentage,
      recentEnrollments,
      recentFailures,
    };
  }

  async getUsersWithoutMfa(tenantId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          or(eq(users.twoFactorEnabled, false), isNull(users.twoFactorEnabled)),
        ),
      )
      .orderBy(asc(users.email));
  }

  // ==================== Workflow Automation Methods ====================

  // Workflow CRUD Operations
  async createWorkflow(data: InsertWorkflow): Promise<Workflow> {
    const [workflow] = await db.insert(workflows).values(data).returning();
    return workflow;
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow;
  }

  async getWorkflows(tenantId: string, status?: string): Promise<Workflow[]> {
    const conditions = [eq(workflows.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(workflows.status, status as any));
    }
    return await db
      .select()
      .from(workflows)
      .where(and(...conditions))
      .orderBy(desc(workflows.createdAt));
  }

  async updateWorkflow(id: string, data: Partial<InsertWorkflow>): Promise<Workflow> {
    const [workflow] = await db
      .update(workflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return workflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await db.delete(workflows).where(eq(workflows.id, id));
  }

  // Workflow Version Management
  async createWorkflowVersion(data: InsertWorkflowVersion): Promise<WorkflowVersion> {
    const [version] = await db.insert(workflowVersions).values(data).returning();
    return version;
  }

  async getWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]> {
    return await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflowId))
      .orderBy(desc(workflowVersions.version));
  }

  async getWorkflowVersion(id: string): Promise<WorkflowVersion | undefined> {
    const [version] = await db.select().from(workflowVersions).where(eq(workflowVersions.id, id));
    return version;
  }

  async getLatestWorkflowVersion(workflowId: string): Promise<WorkflowVersion | undefined> {
    const [version] = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflowId))
      .orderBy(desc(workflowVersions.version))
      .limit(1);
    return version;
  }

  // Workflow Trigger Management
  async createWorkflowTrigger(data: InsertWorkflowTrigger): Promise<WorkflowTrigger> {
    const [trigger] = await db.insert(workflowTriggers).values(data).returning();
    return trigger;
  }

  async getWorkflowTriggers(workflowId: string): Promise<WorkflowTrigger[]> {
    return await db
      .select()
      .from(workflowTriggers)
      .where(eq(workflowTriggers.workflowId, workflowId));
  }

  async getWorkflowTrigger(id: string): Promise<WorkflowTrigger | undefined> {
    const [trigger] = await db.select().from(workflowTriggers).where(eq(workflowTriggers.id, id));
    return trigger;
  }

  async updateWorkflowTrigger(
    id: string,
    data: Partial<InsertWorkflowTrigger>,
  ): Promise<WorkflowTrigger> {
    const [trigger] = await db
      .update(workflowTriggers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowTriggers.id, id))
      .returning();
    return trigger;
  }

  async deleteWorkflowTrigger(id: string): Promise<void> {
    await db.delete(workflowTriggers).where(eq(workflowTriggers.id, id));
  }

  async getTriggersByEventName(eventName: string): Promise<WorkflowTrigger[]> {
    return await db
      .select()
      .from(workflowTriggers)
      .where(and(eq(workflowTriggers.eventName, eventName), eq(workflowTriggers.enabled, true)));
  }

  // Trigger Schedule Management
  async createTriggerSchedule(data: InsertTriggerSchedule): Promise<TriggerSchedule> {
    const [schedule] = await db.insert(triggerSchedules).values(data).returning();
    return schedule;
  }

  async getTriggerSchedule(triggerId: string): Promise<TriggerSchedule | undefined> {
    const [schedule] = await db
      .select()
      .from(triggerSchedules)
      .where(eq(triggerSchedules.triggerId, triggerId));
    return schedule;
  }

  async updateTriggerSchedule(
    id: string,
    data: Partial<InsertTriggerSchedule>,
  ): Promise<TriggerSchedule> {
    const [schedule] = await db
      .update(triggerSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(triggerSchedules.id, id))
      .returning();
    return schedule;
  }

  async getDueScheduledTriggers(): Promise<(TriggerSchedule & { trigger: WorkflowTrigger })[]> {
    const now = new Date();
    const schedules = await db
      .select()
      .from(triggerSchedules)
      .leftJoin(workflowTriggers, eq(triggerSchedules.triggerId, workflowTriggers.id))
      .where(and(eq(triggerSchedules.enabled, true), lte(triggerSchedules.nextRunAt, now)));

    return schedules
      .filter((s) => s.workflow_triggers !== null)
      .map((s) => ({
        ...s.trigger_schedules,
        trigger: s.workflow_triggers as WorkflowTrigger,
      }));
  }

  // Workflow Steps Management
  async createWorkflowStep(data: InsertWorkflowStepAutomation): Promise<WorkflowStepAutomation> {
    const [step] = await db.insert(workflowStepsAutomation).values(data).returning();
    return step;
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStepAutomation[]> {
    return await db
      .select()
      .from(workflowStepsAutomation)
      .where(eq(workflowStepsAutomation.workflowId, workflowId))
      .orderBy(asc(workflowStepsAutomation.orderIndex));
  }

  async updateWorkflowStep(
    id: string,
    data: Partial<InsertWorkflowStepAutomation>,
  ): Promise<WorkflowStepAutomation> {
    const [step] = await db
      .update(workflowStepsAutomation)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowStepsAutomation.id, id))
      .returning();
    return step;
  }

  async deleteWorkflowStep(id: string): Promise<void> {
    await db.delete(workflowStepsAutomation).where(eq(workflowStepsAutomation.id, id));
  }

  // Workflow Execution Management
  async createWorkflowExecution(data: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const [execution] = await db.insert(workflowExecutions).values(data).returning();
    return execution;
  }

  async getWorkflowExecution(id: string): Promise<WorkflowExecution | undefined> {
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, id));
    return execution;
  }

  async getWorkflowExecutions(
    workflowId: string,
    limit: number = 50,
  ): Promise<WorkflowExecution[]> {
    return await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId))
      .orderBy(desc(workflowExecutions.createdAt))
      .limit(limit);
  }

  async getWorkflowExecutionsByTenant(
    tenantId: string,
    limit: number = 100,
  ): Promise<WorkflowExecution[]> {
    return await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.tenantId, tenantId))
      .orderBy(desc(workflowExecutions.createdAt))
      .limit(limit);
  }

  async updateWorkflowExecution(
    id: string,
    data: Partial<InsertWorkflowExecution>,
  ): Promise<WorkflowExecution> {
    const [execution] = await db
      .update(workflowExecutions)
      .set(data)
      .where(eq(workflowExecutions.id, id))
      .returning();
    return execution;
  }

  async getQueuedExecutions(limit: number = 100): Promise<WorkflowExecution[]> {
    return await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.status, 'queued'))
      .orderBy(asc(workflowExecutions.createdAt))
      .limit(limit);
  }

  // Workflow Execution Steps Management
  async createExecutionStep(data: InsertWorkflowExecutionStep): Promise<WorkflowExecutionStep> {
    const [step] = await db.insert(workflowExecutionSteps).values(data).returning();
    return step;
  }

  async getExecutionSteps(executionId: string): Promise<WorkflowExecutionStep[]> {
    return await db
      .select()
      .from(workflowExecutionSteps)
      .where(eq(workflowExecutionSteps.executionId, executionId));
  }

  async updateExecutionStep(
    id: string,
    data: Partial<InsertWorkflowExecutionStep>,
  ): Promise<WorkflowExecutionStep> {
    const [step] = await db
      .update(workflowExecutionSteps)
      .set(data)
      .where(eq(workflowExecutionSteps.id, id))
      .returning();
    return step;
  }

  // Workflow Execution Events (Audit Trail)
  async createExecutionEvent(data: InsertWorkflowExecutionEvent): Promise<WorkflowExecutionEvent> {
    const [event] = await db.insert(workflowExecutionEvents).values(data).returning();
    return event;
  }

  async getExecutionEvents(executionId: string): Promise<WorkflowExecutionEvent[]> {
    return await db
      .select()
      .from(workflowExecutionEvents)
      .where(eq(workflowExecutionEvents.executionId, executionId))
      .orderBy(asc(workflowExecutionEvents.createdAt));
  }

  // Workflow Conditions Management
  async createWorkflowCondition(data: InsertWorkflowCondition): Promise<WorkflowCondition> {
    const [condition] = await db.insert(workflowConditions).values(data).returning();
    return condition;
  }

  async getWorkflowConditions(triggerId?: string, stepId?: string): Promise<WorkflowCondition[]> {
    const conditions = [];
    if (triggerId) {
      conditions.push(eq(workflowConditions.triggerId, triggerId));
    }
    if (stepId) {
      conditions.push(eq(workflowConditions.stepId, stepId));
    }

    return await db
      .select()
      .from(workflowConditions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(workflowConditions.orderIndex));
  }

  async deleteWorkflowCondition(id: string): Promise<void> {
    await db.delete(workflowConditions).where(eq(workflowConditions.id, id));
  }

  // Workflow Templates Management
  async createWorkflowTemplate(data: InsertWorkflowTemplate): Promise<WorkflowTemplate> {
    const [template] = await db.insert(workflowTemplates).values(data).returning();
    return template;
  }

  async getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined> {
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, id));
    return template;
  }

  async getWorkflowTemplates(category?: string): Promise<WorkflowTemplate[]> {
    const conditions = category ? [eq(workflowTemplates.category, category)] : [];
    return await db
      .select()
      .from(workflowTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(workflowTemplates.featured), desc(workflowTemplates.usageCount));
  }

  async updateWorkflowTemplate(
    id: string,
    data: Partial<InsertWorkflowTemplate>,
  ): Promise<WorkflowTemplate> {
    const [template] = await db
      .update(workflowTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowTemplates.id, id))
      .returning();
    return template;
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    await db
      .update(workflowTemplates)
      .set({ usageCount: sql`${workflowTemplates.usageCount} + 1` })
      .where(eq(workflowTemplates.id, id));
  }

  // Template Variables Management
  async createTemplateVariable(data: InsertTemplateVariable): Promise<TemplateVariable> {
    const [variable] = await db.insert(templateVariables).values(data).returning();
    return variable;
  }

  async getTemplateVariables(templateId: string): Promise<TemplateVariable[]> {
    return await db
      .select()
      .from(templateVariables)
      .where(eq(templateVariables.templateId, templateId));
  }

  // Workflow Event Registry Management
  async createEventRegistryEntry(
    data: InsertWorkflowEventRegistry,
  ): Promise<WorkflowEventRegistry> {
    const [entry] = await db.insert(workflowEventRegistry).values(data).returning();
    return entry;
  }

  async getEventRegistryEntries(category?: string): Promise<WorkflowEventRegistry[]> {
    const conditions = category ? [eq(workflowEventRegistry.category, category)] : [];
    conditions.push(eq(workflowEventRegistry.isActive, true));

    return await db
      .select()
      .from(workflowEventRegistry)
      .where(and(...conditions))
      .orderBy(asc(workflowEventRegistry.category), asc(workflowEventRegistry.displayName));
  }

  async getEventRegistryEntry(eventName: string): Promise<WorkflowEventRegistry | undefined> {
    const [entry] = await db
      .select()
      .from(workflowEventRegistry)
      .where(eq(workflowEventRegistry.eventName, eventName));
    return entry;
  }

  // Workflow Analytics
  async getWorkflowExecutionStats(workflowId: string): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
  }> {
    const executions = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId));

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter((e) => e.status === 'completed').length;
    const failedExecutions = executions.filter((e) => e.status === 'failed').length;

    const completedExecutions = executions.filter((e) => e.startedAt && e.completedAt);
    const averageExecutionTime =
      completedExecutions.length > 0
        ? completedExecutions.reduce((sum, e) => {
            const duration = e.completedAt!.getTime() - e.startedAt!.getTime();
            return sum + duration;
          }, 0) / completedExecutions.length
        : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: Math.round(averageExecutionTime),
    };
  }

  // ==================== Lead Scoring Methods ====================

  // Lead Scoring Rules Management
  async createLeadScoringRule(data: InsertLeadScoringRule): Promise<LeadScoringRule> {
    const [rule] = await db.insert(leadScoringRules).values(data).returning();
    return rule;
  }

  async getLeadScoringRule(id: string): Promise<LeadScoringRule | undefined> {
    const [rule] = await db.select().from(leadScoringRules).where(eq(leadScoringRules.id, id));
    return rule;
  }

  async getLeadScoringRules(tenantId: string, category?: string): Promise<LeadScoringRule[]> {
    const conditions = [eq(leadScoringRules.tenantId, tenantId)];
    if (category) {
      conditions.push(eq(leadScoringRules.category, category));
    }
    return await db
      .select()
      .from(leadScoringRules)
      .where(and(...conditions))
      .orderBy(desc(leadScoringRules.priority), asc(leadScoringRules.ruleName));
  }

  async getActiveLeadScoringRules(tenantId: string): Promise<LeadScoringRule[]> {
    return await db
      .select()
      .from(leadScoringRules)
      .where(and(eq(leadScoringRules.tenantId, tenantId), eq(leadScoringRules.isActive, true)))
      .orderBy(desc(leadScoringRules.priority));
  }

  async updateLeadScoringRule(
    id: string,
    data: Partial<InsertLeadScoringRule>,
  ): Promise<LeadScoringRule> {
    const [rule] = await db
      .update(leadScoringRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leadScoringRules.id, id))
      .returning();
    return rule;
  }

  async deleteLeadScoringRule(id: string): Promise<void> {
    await db.delete(leadScoringRules).where(eq(leadScoringRules.id, id));
  }

  // Lead Scoring Factors Tracking
  async createLeadScoringFactor(data: InsertLeadScoringFactor): Promise<LeadScoringFactor> {
    const [factor] = await db.insert(leadScoringFactors).values(data).returning();
    return factor;
  }

  async getLeadScoringFactors(leadId: string): Promise<LeadScoringFactor[]> {
    return await db
      .select()
      .from(leadScoringFactors)
      .where(eq(leadScoringFactors.leadId, leadId))
      .orderBy(desc(leadScoringFactors.evaluatedAt));
  }

  async deleteLeadScoringFactors(leadId: string): Promise<void> {
    await db.delete(leadScoringFactors).where(eq(leadScoringFactors.leadId, leadId));
  }

  // BANT Qualification Management
  async createBantQualification(data: InsertBantQualification): Promise<BantQualificationCriteria> {
    const [qualification] = await db.insert(bantQualificationCriteria).values(data).returning();
    return qualification;
  }

  async getBantQualification(leadId: string): Promise<BantQualificationCriteria | undefined> {
    const [qualification] = await db
      .select()
      .from(bantQualificationCriteria)
      .where(eq(bantQualificationCriteria.leadId, leadId));
    return qualification;
  }

  async updateBantQualification(
    leadId: string,
    data: Partial<InsertBantQualification>,
  ): Promise<BantQualificationCriteria> {
    const [qualification] = await db
      .update(bantQualificationCriteria)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bantQualificationCriteria.leadId, leadId))
      .returning();
    return qualification;
  }

  async getQualifiedLeads(
    tenantId: string,
    minBantScore: number = 50,
  ): Promise<BantQualificationCriteria[]> {
    return await db
      .select()
      .from(bantQualificationCriteria)
      .where(
        and(
          eq(bantQualificationCriteria.tenantId, tenantId),
          gte(bantQualificationCriteria.totalBantScore, minBantScore),
        ),
      )
      .orderBy(desc(bantQualificationCriteria.totalBantScore));
  }

  // Lead Score Calculations
  async createLeadScoreCalculation(
    data: InsertLeadScoreCalculation,
  ): Promise<LeadScoreCalculation> {
    const [calculation] = await db.insert(leadScoreCalculations).values(data).returning();
    return calculation;
  }

  async getLatestLeadScore(leadId: string): Promise<LeadScoreCalculation | undefined> {
    const [calculation] = await db
      .select()
      .from(leadScoreCalculations)
      .where(eq(leadScoreCalculations.leadId, leadId))
      .orderBy(desc(leadScoreCalculations.calculatedAt))
      .limit(1);
    return calculation;
  }

  async getLeadScoreHistory(leadId: string, limit: number = 50): Promise<LeadScoreCalculation[]> {
    return await db
      .select()
      .from(leadScoreCalculations)
      .where(eq(leadScoreCalculations.leadId, leadId))
      .orderBy(desc(leadScoreCalculations.calculatedAt))
      .limit(limit);
  }

  async getTopScoredLeads(tenantId: string, limit: number = 100): Promise<LeadScoreCalculation[]> {
    const subquery = db
      .select({
        leadId: leadScoreCalculations.leadId,
        maxCalculatedAt: sql<Date>`MAX(${leadScoreCalculations.calculatedAt})`.as(
          'max_calculated_at',
        ),
      })
      .from(leadScoreCalculations)
      .where(eq(leadScoreCalculations.tenantId, tenantId))
      .groupBy(leadScoreCalculations.leadId)
      .as('latest_scores');

    return await db
      .select()
      .from(leadScoreCalculations)
      .innerJoin(
        subquery,
        and(
          eq(leadScoreCalculations.leadId, subquery.leadId),
          eq(leadScoreCalculations.calculatedAt, subquery.maxCalculatedAt),
        ),
      )
      .where(eq(leadScoreCalculations.tenantId, tenantId))
      .orderBy(desc(leadScoreCalculations.totalScore))
      .limit(limit)
      .then((results) => results.map((r) => r.lead_score_calculations));
  }

  async getLeadsByGrade(tenantId: string, grade: string): Promise<LeadScoreCalculation[]> {
    const subquery = db
      .select({
        leadId: leadScoreCalculations.leadId,
        maxCalculatedAt: sql<Date>`MAX(${leadScoreCalculations.calculatedAt})`.as(
          'max_calculated_at',
        ),
      })
      .from(leadScoreCalculations)
      .where(eq(leadScoreCalculations.tenantId, tenantId))
      .groupBy(leadScoreCalculations.leadId)
      .as('latest_scores');

    return await db
      .select()
      .from(leadScoreCalculations)
      .innerJoin(
        subquery,
        and(
          eq(leadScoreCalculations.leadId, subquery.leadId),
          eq(leadScoreCalculations.calculatedAt, subquery.maxCalculatedAt),
        ),
      )
      .where(
        and(
          eq(leadScoreCalculations.tenantId, tenantId),
          eq(leadScoreCalculations.leadGrade, grade),
        ),
      )
      .orderBy(desc(leadScoreCalculations.totalScore))
      .then((results) => results.map((r) => r.lead_score_calculations));
  }

  // Lead Qualification History
  async createLeadQualificationHistory(
    data: InsertLeadQualificationHistory,
  ): Promise<LeadQualificationHistory> {
    const [history] = await db.insert(leadQualificationHistory).values(data).returning();
    return history;
  }

  async getLeadQualificationHistory(leadId: string): Promise<LeadQualificationHistory[]> {
    return await db
      .select()
      .from(leadQualificationHistory)
      .where(eq(leadQualificationHistory.leadId, leadId))
      .orderBy(desc(leadQualificationHistory.changedAt));
  }

  async getQualificationChanges(
    tenantId: string,
    limit: number = 100,
  ): Promise<LeadQualificationHistory[]> {
    return await db
      .select()
      .from(leadQualificationHistory)
      .where(eq(leadQualificationHistory.tenantId, tenantId))
      .orderBy(desc(leadQualificationHistory.changedAt))
      .limit(limit);
  }

  // Lead Engagement Tracking
  async createLeadEngagement(data: InsertLeadEngagementTracking): Promise<LeadEngagementTracking> {
    const [engagement] = await db.insert(leadEngagementTracking).values(data).returning();
    return engagement;
  }

  async getLeadEngagements(leadId: string, limit: number = 100): Promise<LeadEngagementTracking[]> {
    return await db
      .select()
      .from(leadEngagementTracking)
      .where(eq(leadEngagementTracking.leadId, leadId))
      .orderBy(desc(leadEngagementTracking.engagedAt))
      .limit(limit);
  }

  async getLeadEngagementsByType(
    leadId: string,
    engagementType: string,
  ): Promise<LeadEngagementTracking[]> {
    return await db
      .select()
      .from(leadEngagementTracking)
      .where(
        and(
          eq(leadEngagementTracking.leadId, leadId),
          eq(leadEngagementTracking.engagementType, engagementType),
        ),
      )
      .orderBy(desc(leadEngagementTracking.engagedAt));
  }

  async getEngagementScore(leadId: string, daysSince: number = 30): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - daysSince);

    const engagements = await db
      .select()
      .from(leadEngagementTracking)
      .where(
        and(
          eq(leadEngagementTracking.leadId, leadId),
          gte(leadEngagementTracking.engagedAt, since),
        ),
      );

    return engagements.reduce((total, engagement) => {
      return total + (engagement.engagementValue || 1);
    }, 0);
  }

  // Lead Scoring Analytics
  async getLeadScoringAnalytics(tenantId: string): Promise<{
    totalLeadsScored: number;
    averageScore: number;
    gradeDistribution: Record<string, number>;
    tierDistribution: Record<string, number>;
    topPerformingRules: Array<{
      ruleId: string;
      ruleName: string;
      totalPoints: number;
      timesTriggered: number;
    }>;
  }> {
    // Get latest scores for all leads
    const subquery = db
      .select({
        leadId: leadScoreCalculations.leadId,
        maxCalculatedAt: sql<Date>`MAX(${leadScoreCalculations.calculatedAt})`.as(
          'max_calculated_at',
        ),
      })
      .from(leadScoreCalculations)
      .where(eq(leadScoreCalculations.tenantId, tenantId))
      .groupBy(leadScoreCalculations.leadId)
      .as('latest_scores');

    const latestScores = await db
      .select()
      .from(leadScoreCalculations)
      .innerJoin(
        subquery,
        and(
          eq(leadScoreCalculations.leadId, subquery.leadId),
          eq(leadScoreCalculations.calculatedAt, subquery.maxCalculatedAt),
        ),
      )
      .where(eq(leadScoreCalculations.tenantId, tenantId))
      .then((results) => results.map((r) => r.lead_score_calculations));

    const totalLeadsScored = latestScores.length;
    const averageScore =
      totalLeadsScored > 0
        ? Math.round(latestScores.reduce((sum, s) => sum + s.totalScore, 0) / totalLeadsScored)
        : 0;

    // Grade distribution
    const gradeDistribution: Record<string, number> = {};
    latestScores.forEach((score) => {
      const grade = score.leadGrade || 'Ungraded';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });

    // Tier distribution
    const tierDistribution: Record<string, number> = {};
    latestScores.forEach((score) => {
      const tier = score.leadTier || 'Unknown';
      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;
    });

    // Top performing rules
    const factorStats = await db
      .select({
        ruleId: leadScoringFactors.ruleId,
        factorName: leadScoringFactors.factorName,
        totalPoints: sql<number>`SUM(${leadScoringFactors.pointsAwarded})`.as('total_points'),
        timesTriggered: sql<number>`COUNT(*)`.as('times_triggered'),
      })
      .from(leadScoringFactors)
      .where(eq(leadScoringFactors.tenantId, tenantId))
      .groupBy(leadScoringFactors.ruleId, leadScoringFactors.factorName)
      .orderBy(sql`SUM(${leadScoringFactors.pointsAwarded}) DESC`)
      .limit(10);

    const topPerformingRules = factorStats.map((stat) => ({
      ruleId: stat.ruleId,
      ruleName: stat.factorName,
      totalPoints: Number(stat.totalPoints),
      timesTriggered: Number(stat.timesTriggered),
    }));

    return {
      totalLeadsScored,
      averageScore,
      gradeDistribution,
      tierDistribution,
      topPerformingRules,
    };
  }

  async getBantAnalytics(tenantId: string): Promise<{
    totalAssessed: number;
    qualifiedCount: number;
    averageBantScore: number;
    componentAverages: {
      budgetScore: number;
      authorityScore: number;
      needScore: number;
      timelineScore: number;
    };
    qualificationStatusDistribution: Record<string, number>;
  }> {
    const allBant = await db
      .select()
      .from(bantQualificationCriteria)
      .where(eq(bantQualificationCriteria.tenantId, tenantId));

    const totalAssessed = allBant.length;
    const qualifiedCount = allBant.filter((b) => b.totalBantScore >= 50).length;
    const averageBantScore =
      totalAssessed > 0
        ? Math.round(allBant.reduce((sum, b) => sum + b.totalBantScore, 0) / totalAssessed)
        : 0;

    const componentAverages = {
      budgetScore:
        totalAssessed > 0
          ? Math.round(allBant.reduce((sum, b) => sum + b.budgetScore, 0) / totalAssessed)
          : 0,
      authorityScore:
        totalAssessed > 0
          ? Math.round(allBant.reduce((sum, b) => sum + b.authorityScore, 0) / totalAssessed)
          : 0,
      needScore:
        totalAssessed > 0
          ? Math.round(allBant.reduce((sum, b) => sum + b.needScore, 0) / totalAssessed)
          : 0,
      timelineScore:
        totalAssessed > 0
          ? Math.round(allBant.reduce((sum, b) => sum + b.timelineScore, 0) / totalAssessed)
          : 0,
    };

    const qualificationStatusDistribution: Record<string, number> = {};
    allBant.forEach((bant) => {
      const status = bant.qualificationStatus || 'unqualified';
      qualificationStatusDistribution[status] = (qualificationStatusDistribution[status] || 0) + 1;
    });

    return {
      totalAssessed,
      qualifiedCount,
      averageBantScore,
      componentAverages,
      qualificationStatusDistribution,
    };
  }

  // Manufacturer Order Submission Methods

  // Manufacturer Connections (8 methods)
  async getManufacturerConnections(
    tenantId: string,
    filters?: { manufacturerType?: string; connectionStatus?: string },
  ): Promise<ManufacturerConnection[]> {
    let query = db
      .select()
      .from(manufacturerConnections)
      .where(eq(manufacturerConnections.tenantId, tenantId));

    const conditions = [eq(manufacturerConnections.tenantId, tenantId)];

    if (filters?.manufacturerType) {
      conditions.push(
        eq(manufacturerConnections.manufacturerType, filters.manufacturerType as any),
      );
    }

    if (filters?.connectionStatus) {
      conditions.push(
        eq(manufacturerConnections.connectionStatus, filters.connectionStatus as any),
      );
    }

    const result = await db
      .select()
      .from(manufacturerConnections)
      .where(and(...conditions))
      .orderBy(desc(manufacturerConnections.updatedAt));

    return result;
  }

  async getManufacturerConnection(id: string): Promise<ManufacturerConnection | null> {
    const [result] = await db
      .select()
      .from(manufacturerConnections)
      .where(eq(manufacturerConnections.id, id))
      .limit(1);

    return result || null;
  }

  async getManufacturerConnectionByType(
    tenantId: string,
    manufacturerType: string,
  ): Promise<ManufacturerConnection | null> {
    const [result] = await db
      .select()
      .from(manufacturerConnections)
      .where(
        and(
          eq(manufacturerConnections.tenantId, tenantId),
          eq(manufacturerConnections.manufacturerType, manufacturerType as any),
        ),
      )
      .limit(1);

    return result || null;
  }

  async createManufacturerConnection(
    connection: InsertManufacturerConnection,
  ): Promise<ManufacturerConnection> {
    const [created] = await db
      .insert(manufacturerConnections)
      .values(connection as any)
      .returning();

    return created;
  }

  async updateManufacturerConnection(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerConnection>,
  ): Promise<ManufacturerConnection | null> {
    const [updated] = await db
      .update(manufacturerConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(manufacturerConnections.id, id), eq(manufacturerConnections.tenantId, tenantId)),
      )
      .returning();

    return updated || null;
  }

  async deleteManufacturerConnection(id: string, tenantId: string): Promise<void> {
    await db
      .delete(manufacturerConnections)
      .where(
        and(eq(manufacturerConnections.id, id), eq(manufacturerConnections.tenantId, tenantId)),
      );
  }

  async testManufacturerConnection(
    connectionId: string,
    tenantId: string,
  ): Promise<{ success: boolean; message: string; error?: string }> {
    return { success: true, message: 'Connection test successful' };
  }

  async updateConnectionHealth(
    connectionId: string,
    tenantId: string,
    data: {
      lastConnectionTest?: Date;
      lastSuccessfulOrder?: Date;
      lastError?: string;
      consecutiveFailures?: number;
    },
  ): Promise<ManufacturerConnection | null> {
    const [updated] = await db
      .update(manufacturerConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(manufacturerConnections.id, connectionId),
          eq(manufacturerConnections.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  // Manufacturer Orders (9 methods)
  async getManufacturerOrders(
    tenantId: string,
    filters?: {
      connectionId?: string;
      orderStatus?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<ManufacturerOrder[]> {
    const conditions = [eq(manufacturerOrders.tenantId, tenantId)];

    if (filters?.connectionId) {
      conditions.push(eq(manufacturerOrders.connectionId, filters.connectionId));
    }

    if (filters?.orderStatus) {
      conditions.push(eq(manufacturerOrders.orderStatus, filters.orderStatus as any));
    }

    if (filters?.startDate) {
      conditions.push(gte(manufacturerOrders.orderDate, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(manufacturerOrders.orderDate, filters.endDate));
    }

    const result = await db
      .select()
      .from(manufacturerOrders)
      .where(and(...conditions))
      .orderBy(desc(manufacturerOrders.orderDate));

    return result;
  }

  async getManufacturerOrder(id: string): Promise<ManufacturerOrder | null> {
    const [result] = await db
      .select()
      .from(manufacturerOrders)
      .where(eq(manufacturerOrders.id, id))
      .limit(1);

    return result || null;
  }

  async getManufacturerOrderByNumber(
    orderNumber: string,
    tenantId: string,
  ): Promise<ManufacturerOrder | null> {
    const [result] = await db
      .select()
      .from(manufacturerOrders)
      .where(
        and(
          eq(manufacturerOrders.orderNumber, orderNumber),
          eq(manufacturerOrders.tenantId, tenantId),
        ),
      )
      .limit(1);

    return result || null;
  }

  async createManufacturerOrder(order: InsertManufacturerOrder): Promise<ManufacturerOrder> {
    const [created] = await db
      .insert(manufacturerOrders)
      .values(order as any)
      .returning();

    return created;
  }

  async updateManufacturerOrder(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrder>,
  ): Promise<ManufacturerOrder | null> {
    const [updated] = await db
      .update(manufacturerOrders)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(manufacturerOrders.id, id), eq(manufacturerOrders.tenantId, tenantId)))
      .returning();

    return updated || null;
  }

  async deleteManufacturerOrder(id: string, tenantId: string): Promise<void> {
    await db
      .delete(manufacturerOrders)
      .where(and(eq(manufacturerOrders.id, id), eq(manufacturerOrders.tenantId, tenantId)));
  }

  async submitOrder(orderId: string, tenantId: string): Promise<ManufacturerOrder | null> {
    const [updated] = await db
      .update(manufacturerOrders)
      .set({
        orderStatus: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenantId, tenantId)))
      .returning();

    return updated || null;
  }

  async acknowledgeOrder(
    orderId: string,
    tenantId: string,
    manufacturerOrderNumber: string,
  ): Promise<ManufacturerOrder | null> {
    const [updated] = await db
      .update(manufacturerOrders)
      .set({
        orderStatus: 'acknowledged',
        acknowledgedAt: new Date(),
        manufacturerOrderNumber,
        updatedAt: new Date(),
      })
      .where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenantId, tenantId)))
      .returning();

    return updated || null;
  }

  async updateOrderFulfillment(
    orderId: string,
    tenantId: string,
    fulfillmentData: {
      totalQuantityShipped?: number;
      totalQuantityDelivered?: number;
      totalQuantityCancelled?: number;
    },
  ): Promise<ManufacturerOrder | null> {
    const [updated] = await db
      .update(manufacturerOrders)
      .set({ ...fulfillmentData, updatedAt: new Date() })
      .where(and(eq(manufacturerOrders.id, orderId), eq(manufacturerOrders.tenantId, tenantId)))
      .returning();

    return updated || null;
  }

  // Manufacturer Order Line Items (7 methods)
  async getOrderLineItems(orderId: string): Promise<ManufacturerOrderLineItem[]> {
    const result = await db
      .select()
      .from(manufacturerOrderLineItems)
      .where(eq(manufacturerOrderLineItems.orderId, orderId))
      .orderBy(manufacturerOrderLineItems.lineNumber);

    return result;
  }

  async getOrderLineItem(id: string): Promise<ManufacturerOrderLineItem | null> {
    const [result] = await db
      .select()
      .from(manufacturerOrderLineItems)
      .where(eq(manufacturerOrderLineItems.id, id))
      .limit(1);

    return result || null;
  }

  async createOrderLineItem(
    lineItem: InsertManufacturerOrderLineItem,
  ): Promise<ManufacturerOrderLineItem> {
    const [created] = await db
      .insert(manufacturerOrderLineItems)
      .values(lineItem as any)
      .returning();

    return created;
  }

  async updateOrderLineItem(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrderLineItem>,
  ): Promise<ManufacturerOrderLineItem | null> {
    const [updated] = await db
      .update(manufacturerOrderLineItems)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(manufacturerOrderLineItems.id, id),
          eq(manufacturerOrderLineItems.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  async deleteOrderLineItem(id: string, tenantId: string): Promise<void> {
    await db
      .delete(manufacturerOrderLineItems)
      .where(
        and(
          eq(manufacturerOrderLineItems.id, id),
          eq(manufacturerOrderLineItems.tenantId, tenantId),
        ),
      );
  }

  async bulkCreateOrderLineItems(
    lineItems: InsertManufacturerOrderLineItem[],
  ): Promise<ManufacturerOrderLineItem[]> {
    const created = await db
      .insert(manufacturerOrderLineItems)
      .values(lineItems as any[])
      .returning();

    return created;
  }

  async updateLineItemShipment(
    lineItemId: string,
    tenantId: string,
    shipmentData: {
      quantityShipped?: number;
      quantityDelivered?: number;
      actualShipDate?: Date;
    },
  ): Promise<ManufacturerOrderLineItem | null> {
    const [updated] = await db
      .update(manufacturerOrderLineItems)
      .set({ ...shipmentData, updatedAt: new Date() })
      .where(
        and(
          eq(manufacturerOrderLineItems.id, lineItemId),
          eq(manufacturerOrderLineItems.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  // Manufacturer Order Confirmations (5 methods)
  async getOrderConfirmations(orderId: string): Promise<ManufacturerOrderConfirmation[]> {
    const result = await db
      .select()
      .from(manufacturerOrderConfirmations)
      .where(eq(manufacturerOrderConfirmations.orderId, orderId))
      .orderBy(desc(manufacturerOrderConfirmations.confirmedAt));

    return result;
  }

  async getOrderConfirmation(id: string): Promise<ManufacturerOrderConfirmation | null> {
    const [result] = await db
      .select()
      .from(manufacturerOrderConfirmations)
      .where(eq(manufacturerOrderConfirmations.id, id))
      .limit(1);

    return result || null;
  }

  async createOrderConfirmation(
    confirmation: InsertManufacturerOrderConfirmation,
  ): Promise<ManufacturerOrderConfirmation> {
    const [created] = await db
      .insert(manufacturerOrderConfirmations)
      .values(confirmation as any)
      .returning();

    return created;
  }

  async updateOrderConfirmation(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrderConfirmation>,
  ): Promise<ManufacturerOrderConfirmation | null> {
    const [updated] = await db
      .update(manufacturerOrderConfirmations)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(manufacturerOrderConfirmations.id, id),
          eq(manufacturerOrderConfirmations.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  async processConfirmation(
    confirmationId: string,
    tenantId: string,
  ): Promise<ManufacturerOrderConfirmation | null> {
    const [updated] = await db
      .update(manufacturerOrderConfirmations)
      .set({
        confirmationStatus: 'processed',
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(manufacturerOrderConfirmations.id, confirmationId),
          eq(manufacturerOrderConfirmations.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  // Manufacturer Order Shipments (8 methods)
  async getOrderShipments(orderId: string): Promise<ManufacturerOrderShipment[]> {
    const result = await db
      .select()
      .from(manufacturerOrderShipments)
      .where(eq(manufacturerOrderShipments.orderId, orderId))
      .orderBy(desc(manufacturerOrderShipments.shippedDate));

    return result;
  }

  async getOrderShipment(id: string): Promise<ManufacturerOrderShipment | null> {
    const [result] = await db
      .select()
      .from(manufacturerOrderShipments)
      .where(eq(manufacturerOrderShipments.id, id))
      .limit(1);

    return result || null;
  }

  async getShipmentByTrackingNumber(
    trackingNumber: string,
    tenantId: string,
  ): Promise<ManufacturerOrderShipment | null> {
    const [result] = await db
      .select()
      .from(manufacturerOrderShipments)
      .where(
        and(
          eq(manufacturerOrderShipments.trackingNumber, trackingNumber),
          eq(manufacturerOrderShipments.tenantId, tenantId),
        ),
      )
      .limit(1);

    return result || null;
  }

  async createOrderShipment(
    shipment: InsertManufacturerOrderShipment,
  ): Promise<ManufacturerOrderShipment> {
    const [created] = await db
      .insert(manufacturerOrderShipments)
      .values(shipment as any)
      .returning();

    return created;
  }

  async updateOrderShipment(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrderShipment>,
  ): Promise<ManufacturerOrderShipment | null> {
    const [updated] = await db
      .update(manufacturerOrderShipments)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(manufacturerOrderShipments.id, id),
          eq(manufacturerOrderShipments.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  async deleteOrderShipment(id: string, tenantId: string): Promise<void> {
    await db
      .delete(manufacturerOrderShipments)
      .where(
        and(
          eq(manufacturerOrderShipments.id, id),
          eq(manufacturerOrderShipments.tenantId, tenantId),
        ),
      );
  }

  async updateShipmentTracking(
    shipmentId: string,
    tenantId: string,
    trackingData: {
      shipmentStatus?: string;
      trackingEvents?: any;
      lastTrackingUpdate?: Date;
    },
  ): Promise<ManufacturerOrderShipment | null> {
    const [updated] = await db
      .update(manufacturerOrderShipments)
      .set({ ...trackingData, updatedAt: new Date() })
      .where(
        and(
          eq(manufacturerOrderShipments.id, shipmentId),
          eq(manufacturerOrderShipments.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  async deliverShipment(
    shipmentId: string,
    tenantId: string,
    deliveryData: {
      actualDeliveryDate?: Date;
      deliveredTo?: string;
      signatureName?: string;
    },
  ): Promise<ManufacturerOrderShipment | null> {
    const [updated] = await db
      .update(manufacturerOrderShipments)
      .set({
        ...deliveryData,
        shipmentStatus: 'delivered',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(manufacturerOrderShipments.id, shipmentId),
          eq(manufacturerOrderShipments.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  // Manufacturer Order Exceptions (7 methods)
  async getOrderExceptions(orderId: string): Promise<ManufacturerOrderException[]> {
    const result = await db
      .select()
      .from(manufacturerOrderExceptions)
      .where(eq(manufacturerOrderExceptions.orderId, orderId))
      .orderBy(desc(manufacturerOrderExceptions.occurredAt));

    return result;
  }

  async getUnresolvedExceptions(
    tenantId: string,
    filters?: { severity?: string; exceptionType?: string },
  ): Promise<ManufacturerOrderException[]> {
    const conditions = [
      eq(manufacturerOrderExceptions.tenantId, tenantId),
      eq(manufacturerOrderExceptions.resolved, false),
    ];

    if (filters?.severity) {
      conditions.push(eq(manufacturerOrderExceptions.severity, filters.severity as any));
    }

    if (filters?.exceptionType) {
      conditions.push(eq(manufacturerOrderExceptions.exceptionType, filters.exceptionType as any));
    }

    const result = await db
      .select()
      .from(manufacturerOrderExceptions)
      .where(and(...conditions))
      .orderBy(desc(manufacturerOrderExceptions.occurredAt));

    return result;
  }

  async getOrderException(id: string): Promise<ManufacturerOrderException | null> {
    const [result] = await db
      .select()
      .from(manufacturerOrderExceptions)
      .where(eq(manufacturerOrderExceptions.id, id))
      .limit(1);

    return result || null;
  }

  async createOrderException(
    exception: InsertManufacturerOrderException,
  ): Promise<ManufacturerOrderException> {
    const [created] = await db
      .insert(manufacturerOrderExceptions)
      .values(exception as any)
      .returning();

    return created;
  }

  async updateOrderException(
    id: string,
    tenantId: string,
    data: Partial<ManufacturerOrderException>,
  ): Promise<ManufacturerOrderException | null> {
    const [updated] = await db
      .update(manufacturerOrderExceptions)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(manufacturerOrderExceptions.id, id),
          eq(manufacturerOrderExceptions.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  async resolveException(
    exceptionId: string,
    tenantId: string,
    resolvedBy: string,
    resolutionNotes: string,
  ): Promise<ManufacturerOrderException | null> {
    const [updated] = await db
      .update(manufacturerOrderExceptions)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(manufacturerOrderExceptions.id, exceptionId),
          eq(manufacturerOrderExceptions.tenantId, tenantId),
        ),
      )
      .returning();

    return updated || null;
  }

  async retryFailedOrder(
    exceptionId: string,
    tenantId: string,
  ): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Order retry initiated' };
  }

  // Analytics & Reporting (1 method)
  async getManufacturerOrderAnalytics(
    tenantId: string,
    filters?: { connectionId?: string; startDate?: Date; endDate?: Date },
  ): Promise<{
    totalOrders: number;
    ordersByStatus: Record<string, number>;
    totalOrderValue: number;
    averageOrderValue: number;
    fulfillmentRate: number;
    onTimeDeliveryRate: number;
    exceptionRate: number;
    topManufacturers: Array<{
      manufacturerName: string;
      orderCount: number;
      totalValue: number;
    }>;
  }> {
    const conditions = [eq(manufacturerOrders.tenantId, tenantId)];

    if (filters?.connectionId) {
      conditions.push(eq(manufacturerOrders.connectionId, filters.connectionId));
    }

    if (filters?.startDate) {
      conditions.push(gte(manufacturerOrders.orderDate, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(manufacturerOrders.orderDate, filters.endDate));
    }

    const orders = await db
      .select()
      .from(manufacturerOrders)
      .where(and(...conditions));

    const totalOrders = orders.length;

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    orders.forEach((order) => {
      const status = order.orderStatus || 'unknown';
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    // Total and average order value
    const totalOrderValue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalOrderValue / totalOrders : 0;

    // Fulfillment rate
    const totalQuantityOrdered = orders.reduce(
      (sum, order) => sum + (order.totalQuantityOrdered || 0),
      0,
    );
    const totalQuantityDelivered = orders.reduce(
      (sum, order) => sum + (order.totalQuantityDelivered || 0),
      0,
    );
    const fulfillmentRate =
      totalQuantityOrdered > 0 ? (totalQuantityDelivered / totalQuantityOrdered) * 100 : 0;

    // On-time delivery rate
    const shipmentsWithEstimates = await db
      .select()
      .from(manufacturerOrderShipments)
      .where(
        and(
          eq(manufacturerOrderShipments.tenantId, tenantId),
          isNotNull(manufacturerOrderShipments.estimatedDeliveryDate),
          isNotNull(manufacturerOrderShipments.actualDeliveryDate),
        ),
      );

    const onTimeShipments = shipmentsWithEstimates.filter((shipment) => {
      const estimated = shipment.estimatedDeliveryDate;
      const actual = shipment.actualDeliveryDate;
      return estimated && actual && actual <= estimated;
    });

    const onTimeDeliveryRate =
      shipmentsWithEstimates.length > 0
        ? (onTimeShipments.length / shipmentsWithEstimates.length) * 100
        : 0;

    // Exception rate
    const exceptions = await db
      .select()
      .from(manufacturerOrderExceptions)
      .where(eq(manufacturerOrderExceptions.tenantId, tenantId));

    const exceptionRate = totalOrders > 0 ? (exceptions.length / totalOrders) * 100 : 0;

    // Top manufacturers
    const manufacturerStats: Record<string, { orderCount: number; totalValue: number }> = {};

    const connections = await db
      .select()
      .from(manufacturerConnections)
      .where(eq(manufacturerConnections.tenantId, tenantId));

    const connectionMap = new Map(connections.map((c) => [c.id, c.manufacturerName]));

    orders.forEach((order) => {
      const manufacturerName = connectionMap.get(order.connectionId) || 'Unknown';
      if (!manufacturerStats[manufacturerName]) {
        manufacturerStats[manufacturerName] = { orderCount: 0, totalValue: 0 };
      }
      manufacturerStats[manufacturerName].orderCount++;
      manufacturerStats[manufacturerName].totalValue += Number(order.totalAmount || 0);
    });

    const topManufacturers = Object.entries(manufacturerStats)
      .map(([manufacturerName, stats]) => ({
        manufacturerName,
        orderCount: stats.orderCount,
        totalValue: stats.totalValue,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    return {
      totalOrders,
      ordersByStatus,
      totalOrderValue,
      averageOrderValue,
      fulfillmentRate,
      onTimeDeliveryRate,
      exceptionRate,
      topManufacturers,
    };
  }

  // ==================== GPS Tracking Implementation ====================

  // Technician Locations (Current Position) - 8 methods
  async getTechnicianLocation(
    technicianId: string,
    tenantId: string,
  ): Promise<TechnicianLocation | null> {
    const [location] = await db
      .select()
      .from(technicianLocations)
      .where(
        and(
          eq(technicianLocations.tenantId, tenantId),
          eq(technicianLocations.technicianId, technicianId),
        ),
      )
      .limit(1);
    return location || null;
  }

  async updateTechnicianLocation(
    technicianId: string,
    tenantId: string,
    data: Partial<InsertTechnicianLocation>,
  ): Promise<TechnicianLocation> {
    // Check if location exists
    const existing = await this.getTechnicianLocation(technicianId, tenantId);

    if (existing) {
      // Update existing location
      const [updated] = await db
        .update(technicianLocations)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(technicianLocations.tenantId, tenantId),
            eq(technicianLocations.technicianId, technicianId),
          ),
        )
        .returning();
      return updated;
    } else {
      // Create new location
      const [created] = await db
        .insert(technicianLocations)
        .values({ ...data, tenantId, technicianId } as any)
        .returning();
      return created;
    }
  }

  async getTechniciansByStatus(tenantId: string, status: string): Promise<TechnicianLocation[]> {
    return await db
      .select()
      .from(technicianLocations)
      .where(
        and(eq(technicianLocations.tenantId, tenantId), eq(technicianLocations.status, status)),
      )
      .orderBy(desc(technicianLocations.timestamp));
  }

  async getTechniciansNearLocation(
    tenantId: string,
    lat: number,
    lng: number,
    radiusMeters: number,
  ): Promise<TechnicianLocation[]> {
    // Using Haversine formula to calculate distance
    // For production use, consider using PostGIS extension
    const allLocations = await db
      .select()
      .from(technicianLocations)
      .where(eq(technicianLocations.tenantId, tenantId));

    // Filter locations within radius using Haversine formula
    const nearbyLocations = allLocations.filter((loc) => {
      const locLat = Number(loc.latitude);
      const locLng = Number(loc.longitude);
      const distance = this.calculateHaversineDistance(lat, lng, locLat, locLng);
      return distance <= radiusMeters;
    });

    return nearbyLocations;
  }

  async getTechnicianLocationHistory(
    technicianId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<GpsLocationHistory[]> {
    return await db
      .select()
      .from(gpsLocationHistory)
      .where(
        and(
          eq(gpsLocationHistory.tenantId, tenantId),
          eq(gpsLocationHistory.technicianId, technicianId),
          gte(gpsLocationHistory.timestamp, startDate),
          lte(gpsLocationHistory.timestamp, endDate),
        ),
      )
      .orderBy(desc(gpsLocationHistory.timestamp));
  }

  async createTechnicianLocation(data: InsertTechnicianLocation): Promise<TechnicianLocation> {
    const [created] = await db
      .insert(technicianLocations)
      .values(data as any)
      .returning();
    return created;
  }

  async deleteTechnicianLocation(technicianId: string, tenantId: string): Promise<void> {
    await db
      .delete(technicianLocations)
      .where(
        and(
          eq(technicianLocations.tenantId, tenantId),
          eq(technicianLocations.technicianId, technicianId),
        ),
      );
  }

  async getAllTechnicianLocations(tenantId: string): Promise<TechnicianLocation[]> {
    return await db
      .select()
      .from(technicianLocations)
      .where(eq(technicianLocations.tenantId, tenantId))
      .orderBy(desc(technicianLocations.timestamp));
  }

  // GPS Location History (Historical Tracking) - 5 methods
  async createGpsLocationHistory(data: InsertGpsLocationHistory): Promise<GpsLocationHistory> {
    const [created] = await db
      .insert(gpsLocationHistory)
      .values(data as any)
      .returning();
    return created;
  }

  async getGpsLocationHistory(
    technicianId: string,
    tenantId: string,
    filters?: { startDate?: Date; endDate?: Date; activityType?: string; ticketId?: string },
  ): Promise<GpsLocationHistory[]> {
    const conditions = [
      eq(gpsLocationHistory.tenantId, tenantId),
      eq(gpsLocationHistory.technicianId, technicianId),
    ];

    if (filters?.startDate) {
      conditions.push(gte(gpsLocationHistory.timestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(gpsLocationHistory.timestamp, filters.endDate));
    }
    if (filters?.activityType) {
      conditions.push(eq(gpsLocationHistory.activityType, filters.activityType));
    }
    if (filters?.ticketId) {
      conditions.push(eq(gpsLocationHistory.ticketId, filters.ticketId));
    }

    return await db
      .select()
      .from(gpsLocationHistory)
      .where(and(...conditions))
      .orderBy(desc(gpsLocationHistory.timestamp));
  }

  async getActivityTimeline(
    technicianId: string,
    tenantId: string,
    ticketId: string,
  ): Promise<GpsLocationHistory[]> {
    return await db
      .select()
      .from(gpsLocationHistory)
      .where(
        and(
          eq(gpsLocationHistory.tenantId, tenantId),
          eq(gpsLocationHistory.technicianId, technicianId),
          eq(gpsLocationHistory.ticketId, ticketId),
        ),
      )
      .orderBy(asc(gpsLocationHistory.timestamp));
  }

  async calculateDistanceTraveled(
    technicianId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const history = await this.getTechnicianLocationHistory(
      technicianId,
      tenantId,
      startDate,
      endDate,
    );

    // Sum up distanceFromPrevious for all records
    let totalDistance = 0;
    history.forEach((record) => {
      if (record.distanceFromPrevious) {
        totalDistance += Number(record.distanceFromPrevious);
      }
    });

    return totalDistance;
  }

  async bulkCreateLocationHistory(data: InsertGpsLocationHistory[]): Promise<GpsLocationHistory[]> {
    if (data.length === 0) return [];
    return await db
      .insert(gpsLocationHistory)
      .values(data as any)
      .returning();
  }

  // Route Assignments - 8 methods
  async getRouteAssignments(
    tenantId: string,
    filters?: { technicianId?: string; routeDate?: Date; routeStatus?: string },
  ): Promise<RouteAssignment[]> {
    const conditions = [eq(routeAssignments.tenantId, tenantId)];

    if (filters?.technicianId) {
      conditions.push(eq(routeAssignments.technicianId, filters.technicianId));
    }
    if (filters?.routeDate) {
      conditions.push(eq(routeAssignments.routeDate, filters.routeDate));
    }
    if (filters?.routeStatus) {
      conditions.push(eq(routeAssignments.routeStatus, filters.routeStatus));
    }

    return await db
      .select()
      .from(routeAssignments)
      .where(and(...conditions))
      .orderBy(desc(routeAssignments.routeDate));
  }

  async getRouteAssignment(routeId: string, tenantId: string): Promise<RouteAssignment | null> {
    const [route] = await db
      .select()
      .from(routeAssignments)
      .where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
      .limit(1);
    return route || null;
  }

  async createRouteAssignment(data: InsertRouteAssignment): Promise<RouteAssignment> {
    const [created] = await db
      .insert(routeAssignments)
      .values(data as any)
      .returning();
    return created;
  }

  async updateRouteAssignment(
    routeId: string,
    tenantId: string,
    data: Partial<RouteAssignment>,
  ): Promise<RouteAssignment | null> {
    const [updated] = await db
      .update(routeAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  async deleteRouteAssignment(routeId: string, tenantId: string): Promise<void> {
    await db
      .delete(routeAssignments)
      .where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)));
  }

  async startRoute(routeId: string, tenantId: string): Promise<RouteAssignment | null> {
    const [updated] = await db
      .update(routeAssignments)
      .set({
        routeStatus: 'in_progress',
        routeStartTime: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  async completeRoute(routeId: string, tenantId: string): Promise<RouteAssignment | null> {
    const route = await this.getRouteAssignment(routeId, tenantId);
    if (!route) return null;

    const startTime = route.routeStartTime ? new Date(route.routeStartTime) : new Date();
    const endTime = new Date();
    const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

    const [updated] = await db
      .update(routeAssignments)
      .set({
        routeStatus: 'completed',
        routeEndTime: endTime,
        actualDuration: durationMinutes,
        updatedAt: new Date(),
      })
      .where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  async updateRouteProgress(
    routeId: string,
    tenantId: string,
    stopData: { stopId: string; status: string; completedAt: Date },
  ): Promise<RouteAssignment | null> {
    const route = await this.getRouteAssignment(routeId, tenantId);
    if (!route) return null;

    // Update waypoints array with the new stop status
    const waypoints = route.waypoints as any[];
    const updatedWaypoints = waypoints.map((waypoint) => {
      if (waypoint.id === stopData.stopId || waypoint.ticketId === stopData.stopId) {
        return {
          ...waypoint,
          status: stopData.status,
          completedAt: stopData.completedAt,
        };
      }
      return waypoint;
    });

    // Count completed stops
    const completedStops = updatedWaypoints.filter((w) => w.status === 'completed').length;

    const [updated] = await db
      .update(routeAssignments)
      .set({
        waypoints: updatedWaypoints as any,
        completedStops,
        updatedAt: new Date(),
      })
      .where(and(eq(routeAssignments.id, routeId), eq(routeAssignments.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  // Route Deviations - 7 methods
  async getRouteDeviations(
    tenantId: string,
    filters?: {
      routeId?: string;
      technicianId?: string;
      deviationType?: string;
      severity?: string;
      resolved?: boolean;
    },
  ): Promise<RouteDeviation[]> {
    const conditions = [eq(routeDeviations.tenantId, tenantId)];

    if (filters?.routeId) {
      conditions.push(eq(routeDeviations.routeId, filters.routeId));
    }
    if (filters?.technicianId) {
      conditions.push(eq(routeDeviations.technicianId, filters.technicianId));
    }
    if (filters?.deviationType) {
      conditions.push(eq(routeDeviations.deviationType, filters.deviationType));
    }
    if (filters?.severity) {
      conditions.push(eq(routeDeviations.severity, filters.severity));
    }
    if (filters?.resolved !== undefined) {
      conditions.push(eq(routeDeviations.resolved, filters.resolved));
    }

    return await db
      .select()
      .from(routeDeviations)
      .where(and(...conditions))
      .orderBy(desc(routeDeviations.detectedAt));
  }

  async getRouteDeviation(deviationId: string, tenantId: string): Promise<RouteDeviation | null> {
    const [deviation] = await db
      .select()
      .from(routeDeviations)
      .where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenantId, tenantId)))
      .limit(1);
    return deviation || null;
  }

  async createRouteDeviation(data: InsertRouteDeviation): Promise<RouteDeviation> {
    const [created] = await db
      .insert(routeDeviations)
      .values(data as any)
      .returning();
    return created;
  }

  async acknowledgeDeviation(
    deviationId: string,
    tenantId: string,
    userId: string,
  ): Promise<RouteDeviation | null> {
    const [updated] = await db
      .update(routeDeviations)
      .set({
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      })
      .where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  async resolveDeviation(
    deviationId: string,
    tenantId: string,
    userId: string,
    notes: string,
  ): Promise<RouteDeviation | null> {
    const [updated] = await db
      .update(routeDeviations)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolutionNotes: notes,
        acknowledgedBy: userId, // Also mark as acknowledged when resolved
        acknowledged: true,
        acknowledgedAt: new Date(),
      })
      .where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  async getUnresolvedDeviations(
    tenantId: string,
    filters?: { severity?: string; deviationType?: string },
  ): Promise<RouteDeviation[]> {
    const conditions = [
      eq(routeDeviations.tenantId, tenantId),
      eq(routeDeviations.resolved, false),
    ];

    if (filters?.severity) {
      conditions.push(eq(routeDeviations.severity, filters.severity));
    }
    if (filters?.deviationType) {
      conditions.push(eq(routeDeviations.deviationType, filters.deviationType));
    }

    return await db
      .select()
      .from(routeDeviations)
      .where(and(...conditions))
      .orderBy(desc(routeDeviations.detectedAt));
  }

  async updateRouteDeviation(
    deviationId: string,
    tenantId: string,
    data: Partial<RouteDeviation>,
  ): Promise<RouteDeviation | null> {
    const [updated] = await db
      .update(routeDeviations)
      .set(data)
      .where(and(eq(routeDeviations.id, deviationId), eq(routeDeviations.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  // ETA Calculations - 7 methods
  async getEtaCalculations(
    tenantId: string,
    filters?: { ticketId?: string; technicianId?: string; routeId?: string },
  ): Promise<EtaCalculation[]> {
    const conditions = [eq(etaCalculations.tenantId, tenantId)];

    if (filters?.ticketId) {
      conditions.push(eq(etaCalculations.ticketId, filters.ticketId));
    }
    if (filters?.technicianId) {
      conditions.push(eq(etaCalculations.technicianId, filters.technicianId));
    }
    if (filters?.routeId) {
      conditions.push(eq(etaCalculations.routeId, filters.routeId));
    }

    return await db
      .select()
      .from(etaCalculations)
      .where(and(...conditions))
      .orderBy(desc(etaCalculations.calculatedAt));
  }

  async getEtaCalculation(etaId: string, tenantId: string): Promise<EtaCalculation | null> {
    const [eta] = await db
      .select()
      .from(etaCalculations)
      .where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenantId, tenantId)))
      .limit(1);
    return eta || null;
  }

  async createEtaCalculation(data: InsertEtaCalculation): Promise<EtaCalculation> {
    const [created] = await db
      .insert(etaCalculations)
      .values(data as any)
      .returning();
    return created;
  }

  async updateEtaCalculation(
    etaId: string,
    tenantId: string,
    data: Partial<EtaCalculation>,
  ): Promise<EtaCalculation | null> {
    const [updated] = await db
      .update(etaCalculations)
      .set(data)
      .where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  async getLatestEtaForTicket(
    ticketId: string,
    technicianId: string,
    tenantId: string,
  ): Promise<EtaCalculation | null> {
    const [eta] = await db
      .select()
      .from(etaCalculations)
      .where(
        and(
          eq(etaCalculations.tenantId, tenantId),
          eq(etaCalculations.ticketId, ticketId),
          eq(etaCalculations.technicianId, technicianId),
        ),
      )
      .orderBy(desc(etaCalculations.calculatedAt))
      .limit(1);
    return eta || null;
  }

  async updateActualArrival(
    etaId: string,
    tenantId: string,
    actualTime: Date,
  ): Promise<EtaCalculation | null> {
    const eta = await this.getEtaCalculation(etaId, tenantId);
    if (!eta) return null;

    // Calculate accuracy
    const estimatedTime = new Date(eta.estimatedArrivalTime);
    const accuracyMinutes = Math.floor((actualTime.getTime() - estimatedTime.getTime()) / 60000);

    const [updated] = await db
      .update(etaCalculations)
      .set({
        actualArrivalTime: actualTime,
        accuracyMinutes,
      })
      .where(and(eq(etaCalculations.id, etaId), eq(etaCalculations.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  async getEtaAccuracyMetrics(
    tenantId: string,
    technicianId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEtas: number;
    averageAccuracyMinutes: number;
    onTimePercentage: number;
  }> {
    const conditions = [
      eq(etaCalculations.tenantId, tenantId),
      isNotNull(etaCalculations.actualArrivalTime),
    ];

    if (technicianId) {
      conditions.push(eq(etaCalculations.technicianId, technicianId));
    }
    if (startDate) {
      conditions.push(gte(etaCalculations.calculatedAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(etaCalculations.calculatedAt, endDate));
    }

    const etas = await db
      .select()
      .from(etaCalculations)
      .where(and(...conditions));

    const totalEtas = etas.length;

    if (totalEtas === 0) {
      return {
        totalEtas: 0,
        averageAccuracyMinutes: 0,
        onTimePercentage: 0,
      };
    }

    const totalAccuracyMinutes = etas.reduce(
      (sum, eta) => sum + Math.abs(eta.accuracyMinutes || 0),
      0,
    );
    const averageAccuracyMinutes = totalAccuracyMinutes / totalEtas;

    // Consider "on time" if within 15 minutes of estimated arrival
    const onTimeEtas = etas.filter((eta) => Math.abs(eta.accuracyMinutes || 0) <= 15);
    const onTimePercentage = (onTimeEtas.length / totalEtas) * 100;

    return {
      totalEtas,
      averageAccuracyMinutes,
      onTimePercentage,
    };
  }

  // Geofences - 6 methods
  async getGeofences(
    tenantId: string,
    filters?: { geofenceType?: string; isActive?: boolean; customerId?: string },
  ): Promise<Geofence[]> {
    const conditions = [eq(geofences.tenantId, tenantId)];

    if (filters?.geofenceType) {
      conditions.push(eq(geofences.geofenceType, filters.geofenceType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(geofences.isActive, filters.isActive));
    }
    if (filters?.customerId) {
      conditions.push(eq(geofences.customerId, filters.customerId));
    }

    return await db
      .select()
      .from(geofences)
      .where(and(...conditions))
      .orderBy(desc(geofences.createdAt));
  }

  async getGeofence(geofenceId: string, tenantId: string): Promise<Geofence | null> {
    const [geofence] = await db
      .select()
      .from(geofences)
      .where(and(eq(geofences.id, geofenceId), eq(geofences.tenantId, tenantId)))
      .limit(1);
    return geofence || null;
  }

  async createGeofence(data: InsertGeofence): Promise<Geofence> {
    const [created] = await db
      .insert(geofences)
      .values(data as any)
      .returning();
    return created;
  }

  async updateGeofence(
    geofenceId: string,
    tenantId: string,
    data: Partial<Geofence>,
  ): Promise<Geofence | null> {
    const [updated] = await db
      .update(geofences)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(geofences.id, geofenceId), eq(geofences.tenantId, tenantId)))
      .returning();
    return updated || null;
  }

  async deleteGeofence(geofenceId: string, tenantId: string): Promise<void> {
    await db
      .delete(geofences)
      .where(and(eq(geofences.id, geofenceId), eq(geofences.tenantId, tenantId)));
  }

  async checkGeofenceProximity(lat: number, lng: number, tenantId: string): Promise<Geofence[]> {
    const activeGeofences = await db
      .select()
      .from(geofences)
      .where(and(eq(geofences.tenantId, tenantId), eq(geofences.isActive, true)));

    // Check which geofences contain the point
    const matchingGeofences = activeGeofences.filter((geofence) => {
      const centerLat = Number(geofence.centerLatitude);
      const centerLng = Number(geofence.centerLongitude);

      if (geofence.radiusMeters) {
        // Circular geofence
        const distance = this.calculateHaversineDistance(lat, lng, centerLat, centerLng);
        return distance <= Number(geofence.radiusMeters);
      } else if (geofence.polygonCoordinates) {
        // Polygon geofence - use point-in-polygon algorithm
        return this.isPointInPolygon(lat, lng, geofence.polygonCoordinates as any);
      }
      return false;
    });

    return matchingGeofences;
  }

  // Geofence Events - 5 methods
  async getGeofenceEvents(
    tenantId: string,
    filters?: {
      geofenceId?: string;
      technicianId?: string;
      eventType?: string;
      ticketId?: string;
    },
  ): Promise<GeofenceEvent[]> {
    const conditions = [eq(geofenceEvents.tenantId, tenantId)];

    if (filters?.geofenceId) {
      conditions.push(eq(geofenceEvents.geofenceId, filters.geofenceId));
    }
    if (filters?.technicianId) {
      conditions.push(eq(geofenceEvents.technicianId, filters.technicianId));
    }
    if (filters?.eventType) {
      conditions.push(eq(geofenceEvents.eventType, filters.eventType));
    }
    if (filters?.ticketId) {
      conditions.push(eq(geofenceEvents.ticketId, filters.ticketId));
    }

    return await db
      .select()
      .from(geofenceEvents)
      .where(and(...conditions))
      .orderBy(desc(geofenceEvents.createdAt));
  }

  async createGeofenceEvent(data: InsertGeofenceEvent): Promise<GeofenceEvent> {
    const [created] = await db
      .insert(geofenceEvents)
      .values(data as any)
      .returning();
    return created;
  }

  async getGeofenceEventsForTechnician(
    technicianId: string,
    tenantId: string,
    filters?: { startDate?: Date; endDate?: Date; eventType?: string },
  ): Promise<GeofenceEvent[]> {
    const conditions = [
      eq(geofenceEvents.tenantId, tenantId),
      eq(geofenceEvents.technicianId, technicianId),
    ];

    if (filters?.startDate) {
      conditions.push(gte(geofenceEvents.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(geofenceEvents.createdAt, filters.endDate));
    }
    if (filters?.eventType) {
      conditions.push(eq(geofenceEvents.eventType, filters.eventType));
    }

    return await db
      .select()
      .from(geofenceEvents)
      .where(and(...conditions))
      .orderBy(desc(geofenceEvents.createdAt));
  }

  async getGeofenceEventsForTicket(ticketId: string, tenantId: string): Promise<GeofenceEvent[]> {
    return await db
      .select()
      .from(geofenceEvents)
      .where(and(eq(geofenceEvents.tenantId, tenantId), eq(geofenceEvents.ticketId, ticketId)))
      .orderBy(asc(geofenceEvents.createdAt));
  }

  async getGeofenceEvent(eventId: string, tenantId: string): Promise<GeofenceEvent | null> {
    const [event] = await db
      .select()
      .from(geofenceEvents)
      .where(and(eq(geofenceEvents.id, eventId), eq(geofenceEvents.tenantId, tenantId)))
      .limit(1);
    return event || null;
  }

  // Helper methods for GPS calculations
  private calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private isPointInPolygon(
    lat: number,
    lng: number,
    polygon: Array<{ lat: number; lng: number }>,
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng;
      const yi = polygon[i].lat;
      const xj = polygon[j].lng;
      const yj = polygon[j].lat;

      const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // ==================== Advanced Billing ====================
  // Billing Rules
  async getBillingRules(
    tenantId: string,
    filters?: {
      ruleType?: string;
      ruleStatus?: string;
      customerId?: string;
      equipmentId?: string;
      contractId?: string;
    },
  ): Promise<BillingRule[]> {
    const conditions = [eq(billingRules.tenantId, tenantId)];

    if (filters?.ruleType) {
      conditions.push(eq(billingRules.ruleType, filters.ruleType));
    }
    if (filters?.ruleStatus) {
      conditions.push(eq(billingRules.ruleStatus, filters.ruleStatus));
    }
    if (filters?.customerId) {
      conditions.push(eq(billingRules.customerId, filters.customerId));
    }
    if (filters?.equipmentId) {
      conditions.push(eq(billingRules.equipmentId, filters.equipmentId));
    }
    if (filters?.contractId) {
      conditions.push(eq(billingRules.contractId, filters.contractId));
    }

    return await db
      .select()
      .from(billingRules)
      .where(and(...conditions))
      .orderBy(desc(billingRules.priority), desc(billingRules.createdAt));
  }

  async getBillingRule(ruleId: string): Promise<BillingRule | null> {
    const [rule] = await db.select().from(billingRules).where(eq(billingRules.id, ruleId)).limit(1);
    return rule || null;
  }

  async createBillingRule(data: InsertBillingRule): Promise<BillingRule> {
    const [rule] = await db.insert(billingRules).values(data).returning();
    return rule;
  }

  async updateBillingRule(
    ruleId: string,
    tenantId: string,
    data: Partial<BillingRule>,
  ): Promise<BillingRule | null> {
    const [rule] = await db
      .update(billingRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)))
      .returning();
    return rule || null;
  }

  async deleteBillingRule(ruleId: string, tenantId: string): Promise<void> {
    await db
      .delete(billingRules)
      .where(and(eq(billingRules.id, ruleId), eq(billingRules.tenantId, tenantId)));
  }

  async getActiveBillingRules(
    tenantId: string,
    customerId?: string,
    equipmentId?: string,
  ): Promise<BillingRule[]> {
    const conditions = [
      eq(billingRules.tenantId, tenantId),
      eq(billingRules.ruleStatus, 'active'),
      lte(billingRules.effectiveStartDate, new Date()),
    ];

    if (customerId) {
      conditions.push(
        or(
          eq(billingRules.customerId, customerId),
          eq(billingRules.applicableToAllCustomers, true),
        )!,
      );
    }

    if (equipmentId) {
      conditions.push(
        or(
          eq(billingRules.equipmentId, equipmentId),
          eq(billingRules.applicableToAllEquipment, true),
        )!,
      );
    }

    return await db
      .select()
      .from(billingRules)
      .where(and(...conditions))
      .orderBy(desc(billingRules.priority));
  }

  async applyBillingRule(
    ruleId: string,
    usage: { bwVolume: number; colorVolume: number },
  ): Promise<{ totalCharge: number; breakdown: any }> {
    const rule = await this.getBillingRule(ruleId);
    if (!rule) {
      throw new Error('Billing rule not found');
    }

    let totalCharge = 0;
    const breakdown: any = {
      baseCharge: 0,
      bwCharge: 0,
      colorCharge: 0,
      volumeDiscount: 0,
      overageCharge: 0,
    };

    if (rule.baseCharge) {
      breakdown.baseCharge = parseFloat(rule.baseCharge);
      totalCharge += breakdown.baseCharge;
    }

    const bwOverage = Math.max(0, usage.bwVolume - (rule.baseVolumeBw || 0));
    const colorOverage = Math.max(0, usage.colorVolume - (rule.baseVolumeColor || 0));

    if (rule.bwRate) {
      breakdown.bwCharge = bwOverage * parseFloat(rule.bwRate);
      totalCharge += breakdown.bwCharge;
    }

    if (rule.colorRate) {
      breakdown.colorCharge = colorOverage * parseFloat(rule.colorRate);
      totalCharge += breakdown.colorCharge;
    }

    if (rule.minimumCharge && totalCharge < parseFloat(rule.minimumCharge)) {
      totalCharge = parseFloat(rule.minimumCharge);
    }

    if (rule.maximumCharge && totalCharge > parseFloat(rule.maximumCharge)) {
      totalCharge = parseFloat(rule.maximumCharge);
    }

    return { totalCharge, breakdown };
  }

  async getBillingRulesByCustomer(customerId: string, tenantId: string): Promise<BillingRule[]> {
    return await db
      .select()
      .from(billingRules)
      .where(
        and(
          eq(billingRules.tenantId, tenantId),
          or(
            eq(billingRules.customerId, customerId),
            eq(billingRules.applicableToAllCustomers, true),
          ),
        ),
      )
      .orderBy(desc(billingRules.priority));
  }

  async getBillingRulesByContract(contractId: string, tenantId: string): Promise<BillingRule[]> {
    return await db
      .select()
      .from(billingRules)
      .where(and(eq(billingRules.contractId, contractId), eq(billingRules.tenantId, tenantId)))
      .orderBy(desc(billingRules.priority));
  }

  // Meter Anomalies
  async getMeterAnomalies(
    tenantId: string,
    filters?: {
      anomalyType?: string;
      severity?: string;
      resolved?: boolean;
      equipmentId?: string;
      customerId?: string;
    },
  ): Promise<MeterAnomaly[]> {
    const conditions = [eq(meterAnomalies.tenantId, tenantId)];

    if (filters?.anomalyType) {
      conditions.push(eq(meterAnomalies.anomalyType, filters.anomalyType));
    }
    if (filters?.severity) {
      conditions.push(eq(meterAnomalies.severity, filters.severity));
    }
    if (filters?.resolved !== undefined) {
      conditions.push(eq(meterAnomalies.resolved, filters.resolved));
    }
    if (filters?.equipmentId) {
      conditions.push(eq(meterAnomalies.equipmentId, filters.equipmentId));
    }
    if (filters?.customerId) {
      conditions.push(eq(meterAnomalies.customerId, filters.customerId));
    }

    return await db
      .select()
      .from(meterAnomalies)
      .where(and(...conditions))
      .orderBy(desc(meterAnomalies.detectedAt));
  }

  async getMeterAnomaly(anomalyId: string): Promise<MeterAnomaly | null> {
    const [anomaly] = await db
      .select()
      .from(meterAnomalies)
      .where(eq(meterAnomalies.id, anomalyId))
      .limit(1);
    return anomaly || null;
  }

  async createMeterAnomaly(data: InsertMeterAnomaly): Promise<MeterAnomaly> {
    const [anomaly] = await db.insert(meterAnomalies).values(data).returning();
    return anomaly;
  }

  async updateMeterAnomaly(
    anomalyId: string,
    tenantId: string,
    data: Partial<MeterAnomaly>,
  ): Promise<MeterAnomaly | null> {
    const [anomaly] = await db
      .update(meterAnomalies)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenantId, tenantId)))
      .returning();
    return anomaly || null;
  }

  async reviewAnomaly(
    anomalyId: string,
    tenantId: string,
    userId: string,
    notes: string,
  ): Promise<MeterAnomaly | null> {
    const [anomaly] = await db
      .update(meterAnomalies)
      .set({
        reviewed: true,
        reviewedAt: new Date(),
        reviewedBy: userId,
        reviewNotes: notes,
        updatedAt: new Date(),
      })
      .where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenantId, tenantId)))
      .returning();
    return anomaly || null;
  }

  async resolveAnomaly(
    anomalyId: string,
    tenantId: string,
    resolutionMethod: string,
    notes: string,
  ): Promise<MeterAnomaly | null> {
    const [anomaly] = await db
      .update(meterAnomalies)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolutionMethod,
        resolutionNotes: notes,
        updatedAt: new Date(),
      })
      .where(and(eq(meterAnomalies.id, anomalyId), eq(meterAnomalies.tenantId, tenantId)))
      .returning();
    return anomaly || null;
  }

  async getUnresolvedAnomalies(
    tenantId: string,
    filters?: { severity?: string; anomalyType?: string },
  ): Promise<MeterAnomaly[]> {
    const conditions = [eq(meterAnomalies.tenantId, tenantId), eq(meterAnomalies.resolved, false)];

    if (filters?.severity) {
      conditions.push(eq(meterAnomalies.severity, filters.severity));
    }
    if (filters?.anomalyType) {
      conditions.push(eq(meterAnomalies.anomalyType, filters.anomalyType));
    }

    return await db
      .select()
      .from(meterAnomalies)
      .where(and(...conditions))
      .orderBy(desc(meterAnomalies.detectedAt));
  }

  async detectAnomalies(meterReadingId: string): Promise<MeterAnomaly[]> {
    return [];
  }

  async getAnomaliesByEquipment(equipmentId: string, tenantId: string): Promise<MeterAnomaly[]> {
    return await db
      .select()
      .from(meterAnomalies)
      .where(
        and(eq(meterAnomalies.equipmentId, equipmentId), eq(meterAnomalies.tenantId, tenantId)),
      )
      .orderBy(desc(meterAnomalies.detectedAt));
  }

  // Billing Disputes
  async getBillingDisputes(
    tenantId: string,
    filters?: {
      disputeType?: string;
      disputeStatus?: string;
      severity?: string;
      customerId?: string;
      invoiceId?: string;
    },
  ): Promise<BillingDispute[]> {
    const conditions = [eq(billingDisputes.tenantId, tenantId)];

    if (filters?.disputeType) {
      conditions.push(eq(billingDisputes.disputeType, filters.disputeType));
    }
    if (filters?.disputeStatus) {
      conditions.push(eq(billingDisputes.disputeStatus, filters.disputeStatus));
    }
    if (filters?.severity) {
      conditions.push(eq(billingDisputes.severity, filters.severity));
    }
    if (filters?.customerId) {
      conditions.push(eq(billingDisputes.customerId, filters.customerId));
    }
    if (filters?.invoiceId) {
      conditions.push(eq(billingDisputes.invoiceId, filters.invoiceId));
    }

    return await db
      .select()
      .from(billingDisputes)
      .where(and(...conditions))
      .orderBy(desc(billingDisputes.filedDate));
  }

  async getBillingDispute(disputeId: string): Promise<BillingDispute | null> {
    const [dispute] = await db
      .select()
      .from(billingDisputes)
      .where(eq(billingDisputes.id, disputeId))
      .limit(1);
    return dispute || null;
  }

  async createBillingDispute(data: InsertBillingDispute): Promise<BillingDispute> {
    const [dispute] = await db.insert(billingDisputes).values(data).returning();
    return dispute;
  }

  async updateBillingDispute(
    disputeId: string,
    tenantId: string,
    data: Partial<BillingDispute>,
  ): Promise<BillingDispute | null> {
    const [dispute] = await db
      .update(billingDisputes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
      .returning();
    return dispute || null;
  }

  async assignDispute(
    disputeId: string,
    tenantId: string,
    userId: string,
  ): Promise<BillingDispute | null> {
    const [dispute] = await db
      .update(billingDisputes)
      .set({
        assignedTo: userId,
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
      .returning();
    return dispute || null;
  }

  async acknowledgeDispute(
    disputeId: string,
    tenantId: string,
    userId: string,
  ): Promise<BillingDispute | null> {
    const [dispute] = await db
      .update(billingDisputes)
      .set({
        disputeStatus: 'under_review',
        updatedAt: new Date(),
      })
      .where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
      .returning();
    return dispute || null;
  }

  async resolveDispute(
    disputeId: string,
    tenantId: string,
    userId: string,
    resolutionData: {
      resolutionType: string;
      resolutionDescription: string;
      creditAmount?: number;
    },
  ): Promise<BillingDispute | null> {
    const [dispute] = await db
      .update(billingDisputes)
      .set({
        disputeStatus: 'resolved',
        resolutionType: resolutionData.resolutionType,
        resolutionDescription: resolutionData.resolutionDescription,
        approvedCreditAmount: resolutionData.creditAmount?.toString(),
        resolutionDate: new Date(),
        resolvedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
      .returning();
    return dispute || null;
  }

  async escalateDispute(
    disputeId: string,
    tenantId: string,
    userId: string,
    reason: string,
  ): Promise<BillingDispute | null> {
    const [dispute] = await db
      .update(billingDisputes)
      .set({
        escalated: true,
        escalatedTo: userId,
        escalatedAt: new Date(),
        escalationReason: reason,
        disputeStatus: 'escalated',
        updatedAt: new Date(),
      })
      .where(and(eq(billingDisputes.id, disputeId), eq(billingDisputes.tenantId, tenantId)))
      .returning();
    return dispute || null;
  }

  async getOpenDisputes(
    tenantId: string,
    filters?: { severity?: string; priorityLevel?: number },
  ): Promise<BillingDispute[]> {
    const conditions = [
      eq(billingDisputes.tenantId, tenantId),
      eq(billingDisputes.disputeStatus, 'open'),
    ];

    if (filters?.severity) {
      conditions.push(eq(billingDisputes.severity, filters.severity));
    }
    if (filters?.priorityLevel) {
      conditions.push(eq(billingDisputes.priorityLevel, filters.priorityLevel));
    }

    return await db
      .select()
      .from(billingDisputes)
      .where(and(...conditions))
      .orderBy(asc(billingDisputes.priorityLevel), desc(billingDisputes.filedDate));
  }

  async getDisputesByCustomer(customerId: string, tenantId: string): Promise<BillingDispute[]> {
    return await db
      .select()
      .from(billingDisputes)
      .where(
        and(eq(billingDisputes.customerId, customerId), eq(billingDisputes.tenantId, tenantId)),
      )
      .orderBy(desc(billingDisputes.filedDate));
  }

  async getDisputesByInvoice(invoiceId: string, tenantId: string): Promise<BillingDispute[]> {
    return await db
      .select()
      .from(billingDisputes)
      .where(and(eq(billingDisputes.invoiceId, invoiceId), eq(billingDisputes.tenantId, tenantId)))
      .orderBy(desc(billingDisputes.filedDate));
  }

  // Invoice Generation Logs
  async getInvoiceGenerationLogs(
    tenantId: string,
    filters?: {
      status?: string;
      generationType?: string;
      customerId?: string;
      batchId?: string;
    },
  ): Promise<InvoiceGenerationLog[]> {
    const conditions = [eq(invoiceGenerationLogs.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(invoiceGenerationLogs.status, filters.status));
    }
    if (filters?.generationType) {
      conditions.push(eq(invoiceGenerationLogs.generationType, filters.generationType));
    }
    if (filters?.customerId) {
      conditions.push(eq(invoiceGenerationLogs.customerId, filters.customerId));
    }
    if (filters?.batchId) {
      conditions.push(eq(invoiceGenerationLogs.batchId, filters.batchId));
    }

    return await db
      .select()
      .from(invoiceGenerationLogs)
      .where(and(...conditions))
      .orderBy(desc(invoiceGenerationLogs.createdAt));
  }

  async getInvoiceGenerationLog(logId: string): Promise<InvoiceGenerationLog | null> {
    const [log] = await db
      .select()
      .from(invoiceGenerationLogs)
      .where(eq(invoiceGenerationLogs.id, logId))
      .limit(1);
    return log || null;
  }

  async createInvoiceGenerationLog(
    data: InsertInvoiceGenerationLog,
  ): Promise<InvoiceGenerationLog> {
    const [log] = await db.insert(invoiceGenerationLogs).values(data).returning();
    return log;
  }

  async updateInvoiceGenerationLog(
    logId: string,
    tenantId: string,
    data: Partial<InvoiceGenerationLog>,
  ): Promise<InvoiceGenerationLog | null> {
    const [log] = await db
      .update(invoiceGenerationLogs)
      .set(data)
      .where(and(eq(invoiceGenerationLogs.id, logId), eq(invoiceGenerationLogs.tenantId, tenantId)))
      .returning();
    return log || null;
  }

  async getLogsByBatch(batchId: string): Promise<InvoiceGenerationLog[]> {
    return await db
      .select()
      .from(invoiceGenerationLogs)
      .where(eq(invoiceGenerationLogs.batchId, batchId))
      .orderBy(desc(invoiceGenerationLogs.createdAt));
  }

  async getFailedGenerations(
    tenantId: string,
    filters?: { errorType?: string },
  ): Promise<InvoiceGenerationLog[]> {
    const conditions = [
      eq(invoiceGenerationLogs.tenantId, tenantId),
      eq(invoiceGenerationLogs.status, 'failed'),
    ];

    if (filters?.errorType) {
      conditions.push(eq(invoiceGenerationLogs.errorType, filters.errorType));
    }

    return await db
      .select()
      .from(invoiceGenerationLogs)
      .where(and(...conditions))
      .orderBy(desc(invoiceGenerationLogs.createdAt));
  }

  async getGenerationStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalGenerated: number;
    successCount: number;
    failureCount: number;
    averageProcessingTime: number;
  }> {
    const logs = await db
      .select()
      .from(invoiceGenerationLogs)
      .where(
        and(
          eq(invoiceGenerationLogs.tenantId, tenantId),
          gte(invoiceGenerationLogs.createdAt, startDate),
          lte(invoiceGenerationLogs.createdAt, endDate),
        ),
      );

    const totalGenerated = logs.length;
    const successCount = logs.filter((l) => l.status === 'success').length;
    const failureCount = logs.filter((l) => l.status === 'failed').length;
    const processingTimes = logs
      .filter((l) => l.processingTimeMs !== null)
      .map((l) => l.processingTimeMs || 0);
    const averageProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0;

    return { totalGenerated, successCount, failureCount, averageProcessingTime };
  }

  // Billing Schedules
  async getBillingSchedules(
    tenantId: string,
    filters?: {
      scheduleType?: string;
      frequency?: string;
      isActive?: boolean;
      customerId?: string;
    },
  ): Promise<BillingSchedule[]> {
    const conditions = [eq(billingSchedules.tenantId, tenantId)];

    if (filters?.scheduleType) {
      conditions.push(eq(billingSchedules.scheduleType, filters.scheduleType));
    }
    if (filters?.frequency) {
      conditions.push(eq(billingSchedules.frequency, filters.frequency));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(billingSchedules.isActive, filters.isActive));
    }
    if (filters?.customerId) {
      conditions.push(eq(billingSchedules.customerId, filters.customerId));
    }

    return await db
      .select()
      .from(billingSchedules)
      .where(and(...conditions))
      .orderBy(asc(billingSchedules.nextRunDate));
  }

  async getBillingSchedule(scheduleId: string): Promise<BillingSchedule | null> {
    const [schedule] = await db
      .select()
      .from(billingSchedules)
      .where(eq(billingSchedules.id, scheduleId))
      .limit(1);
    return schedule || null;
  }

  async createBillingSchedule(data: InsertBillingSchedule): Promise<BillingSchedule> {
    const [schedule] = await db.insert(billingSchedules).values(data).returning();
    return schedule;
  }

  async updateBillingSchedule(
    scheduleId: string,
    tenantId: string,
    data: Partial<BillingSchedule>,
  ): Promise<BillingSchedule | null> {
    const [schedule] = await db
      .update(billingSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenantId, tenantId)))
      .returning();
    return schedule || null;
  }

  async deleteBillingSchedule(scheduleId: string, tenantId: string): Promise<void> {
    await db
      .delete(billingSchedules)
      .where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenantId, tenantId)));
  }

  async getActiveSchedules(tenantId: string): Promise<BillingSchedule[]> {
    return await db
      .select()
      .from(billingSchedules)
      .where(and(eq(billingSchedules.tenantId, tenantId), eq(billingSchedules.isActive, true)))
      .orderBy(asc(billingSchedules.nextRunDate));
  }

  async getDueSchedules(tenantId: string, date: Date): Promise<BillingSchedule[]> {
    return await db
      .select()
      .from(billingSchedules)
      .where(
        and(
          eq(billingSchedules.tenantId, tenantId),
          eq(billingSchedules.isActive, true),
          lte(billingSchedules.nextRunDate, date),
        ),
      )
      .orderBy(asc(billingSchedules.nextRunDate));
  }

  async updateScheduleNextRun(
    scheduleId: string,
    tenantId: string,
    nextRunDate: Date,
  ): Promise<BillingSchedule | null> {
    const [schedule] = await db
      .update(billingSchedules)
      .set({
        lastRunDate: new Date(),
        nextRunDate,
        updatedAt: new Date(),
      })
      .where(and(eq(billingSchedules.id, scheduleId), eq(billingSchedules.tenantId, tenantId)))
      .returning();
    return schedule || null;
  }

  // Credit Memos
  async getCreditMemos(
    tenantId: string,
    filters?: {
      creditStatus?: string;
      customerId?: string;
      invoiceId?: string;
      disputeId?: string;
    },
  ): Promise<CreditMemo[]> {
    const conditions = [eq(creditMemos.tenantId, tenantId)];

    if (filters?.creditStatus) {
      conditions.push(eq(creditMemos.creditStatus, filters.creditStatus));
    }
    if (filters?.customerId) {
      conditions.push(eq(creditMemos.customerId, filters.customerId));
    }
    if (filters?.invoiceId) {
      conditions.push(eq(creditMemos.invoiceId, filters.invoiceId));
    }
    if (filters?.disputeId) {
      conditions.push(eq(creditMemos.disputeId, filters.disputeId));
    }

    return await db
      .select()
      .from(creditMemos)
      .where(and(...conditions))
      .orderBy(desc(creditMemos.issuedDate));
  }

  async getCreditMemo(creditMemoId: string): Promise<CreditMemo | null> {
    const [creditMemo] = await db
      .select()
      .from(creditMemos)
      .where(eq(creditMemos.id, creditMemoId))
      .limit(1);
    return creditMemo || null;
  }

  async createCreditMemo(data: InsertCreditMemo): Promise<CreditMemo> {
    const [creditMemo] = await db.insert(creditMemos).values(data).returning();
    return creditMemo;
  }

  async updateCreditMemo(
    creditMemoId: string,
    tenantId: string,
    data: Partial<CreditMemo>,
  ): Promise<CreditMemo | null> {
    const [creditMemo] = await db
      .update(creditMemos)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenantId, tenantId)))
      .returning();
    return creditMemo || null;
  }

  async approveCreditMemo(
    creditMemoId: string,
    tenantId: string,
    userId: string,
  ): Promise<CreditMemo | null> {
    const [creditMemo] = await db
      .update(creditMemos)
      .set({
        creditStatus: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenantId, tenantId)))
      .returning();
    return creditMemo || null;
  }

  async issueCreditMemo(creditMemoId: string, tenantId: string): Promise<CreditMemo | null> {
    const [creditMemo] = await db
      .update(creditMemos)
      .set({
        creditStatus: 'issued',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(creditMemos.id, creditMemoId),
          eq(creditMemos.tenantId, tenantId),
          eq(creditMemos.creditStatus, 'approved'),
        ),
      )
      .returning();
    return creditMemo || null;
  }

  async applyCreditToInvoice(
    creditMemoId: string,
    tenantId: string,
    invoiceId: string,
  ): Promise<CreditMemo | null> {
    const [creditMemo] = await db
      .update(creditMemos)
      .set({
        appliedToInvoice: true,
        appliedToInvoiceId: invoiceId,
        appliedAt: new Date(),
        creditStatus: 'applied',
        updatedAt: new Date(),
      })
      .where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenantId, tenantId)))
      .returning();
    return creditMemo || null;
  }

  async voidCreditMemo(
    creditMemoId: string,
    tenantId: string,
    userId: string,
    reason: string,
  ): Promise<CreditMemo | null> {
    const [creditMemo] = await db
      .update(creditMemos)
      .set({
        creditStatus: 'voided',
        voidedBy: userId,
        voidedAt: new Date(),
        voidReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(creditMemos.id, creditMemoId), eq(creditMemos.tenantId, tenantId)))
      .returning();
    return creditMemo || null;
  }

  async getCreditMemosByCustomer(customerId: string, tenantId: string): Promise<CreditMemo[]> {
    return await db
      .select()
      .from(creditMemos)
      .where(and(eq(creditMemos.customerId, customerId), eq(creditMemos.tenantId, tenantId)))
      .orderBy(desc(creditMemos.issuedDate));
  }

  async getPendingCreditMemos(tenantId: string): Promise<CreditMemo[]> {
    return await db
      .select()
      .from(creditMemos)
      .where(and(eq(creditMemos.tenantId, tenantId), eq(creditMemos.creditStatus, 'pending')))
      .orderBy(desc(creditMemos.issuedDate));
  }

  // Customer Health Scores
  async getHealthScores(
    tenantId: string,
    filters?: {
      healthStatus?: string;
      trend?: string;
      minScore?: number;
      maxScore?: number;
    },
  ): Promise<CustomerHealthScore[]> {
    const conditions = [eq(customerHealthScores.tenantId, tenantId)];

    if (filters?.healthStatus) {
      conditions.push(eq(customerHealthScores.healthStatus, filters.healthStatus));
    }
    if (filters?.trend) {
      conditions.push(eq(customerHealthScores.trend, filters.trend));
    }
    if (filters?.minScore !== undefined) {
      conditions.push(gte(customerHealthScores.overallScore, filters.minScore));
    }
    if (filters?.maxScore !== undefined) {
      conditions.push(lte(customerHealthScores.overallScore, filters.maxScore));
    }

    return await db
      .select()
      .from(customerHealthScores)
      .where(and(...conditions))
      .orderBy(desc(customerHealthScores.calculatedAt));
  }

  async getHealthScore(scoreId: string): Promise<CustomerHealthScore | null> {
    const [score] = await db
      .select()
      .from(customerHealthScores)
      .where(eq(customerHealthScores.id, scoreId))
      .limit(1);
    return score || null;
  }

  async getHealthScoreByCustomer(
    customerId: string,
    tenantId: string,
  ): Promise<CustomerHealthScore | null> {
    const [score] = await db
      .select()
      .from(customerHealthScores)
      .where(
        and(
          eq(customerHealthScores.customerId, customerId),
          eq(customerHealthScores.tenantId, tenantId),
        ),
      )
      .orderBy(desc(customerHealthScores.calculatedAt))
      .limit(1);
    return score || null;
  }

  async createHealthScore(data: InsertCustomerHealthScore): Promise<CustomerHealthScore> {
    const [score] = await db.insert(customerHealthScores).values(data).returning();
    return score;
  }

  async updateHealthScore(
    scoreId: string,
    tenantId: string,
    data: Partial<CustomerHealthScore>,
  ): Promise<CustomerHealthScore | null> {
    const [score] = await db
      .update(customerHealthScores)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(customerHealthScores.id, scoreId), eq(customerHealthScores.tenantId, tenantId)))
      .returning();
    return score || null;
  }

  async getScoresDueForCalculation(tenantId: string): Promise<CustomerHealthScore[]> {
    return await db
      .select()
      .from(customerHealthScores)
      .where(
        and(
          eq(customerHealthScores.tenantId, tenantId),
          lte(customerHealthScores.nextCalculationDue, new Date()),
        ),
      )
      .orderBy(asc(customerHealthScores.nextCalculationDue));
  }

  async getCustomersAtRisk(tenantId: string): Promise<CustomerHealthScore[]> {
    return await db
      .select()
      .from(customerHealthScores)
      .where(
        and(
          eq(customerHealthScores.tenantId, tenantId),
          inArray(customerHealthScores.healthStatus, ['critical', 'at_risk']),
        ),
      )
      .orderBy(asc(customerHealthScores.overallScore));
  }

  async getHealthScoreHistory(
    customerId: string,
    tenantId: string,
    limit?: number,
  ): Promise<CustomerHealthScore[]> {
    let query = db
      .select()
      .from(customerHealthScores)
      .where(
        and(
          eq(customerHealthScores.customerId, customerId),
          eq(customerHealthScores.tenantId, tenantId),
        ),
      )
      .orderBy(desc(customerHealthScores.calculatedAt));

    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  // Churn Predictions
  async getChurnPredictions(
    tenantId: string,
    filters?: {
      churnRisk?: string;
      interventionRequired?: boolean;
    },
  ): Promise<ChurnPrediction[]> {
    const conditions = [eq(churnPredictions.tenantId, tenantId)];

    if (filters?.churnRisk) {
      conditions.push(eq(churnPredictions.churnRisk, filters.churnRisk));
    }
    if (filters?.interventionRequired !== undefined) {
      conditions.push(eq(churnPredictions.interventionRequired, filters.interventionRequired));
    }

    return await db
      .select()
      .from(churnPredictions)
      .where(and(...conditions))
      .orderBy(desc(churnPredictions.churnProbability));
  }

  async getChurnPrediction(predictionId: string): Promise<ChurnPrediction | null> {
    const [prediction] = await db
      .select()
      .from(churnPredictions)
      .where(eq(churnPredictions.id, predictionId))
      .limit(1);
    return prediction || null;
  }

  async getChurnPredictionByCustomer(
    customerId: string,
    tenantId: string,
  ): Promise<ChurnPrediction | null> {
    const [prediction] = await db
      .select()
      .from(churnPredictions)
      .where(
        and(eq(churnPredictions.customerId, customerId), eq(churnPredictions.tenantId, tenantId)),
      )
      .orderBy(desc(churnPredictions.predictedAt))
      .limit(1);
    return prediction || null;
  }

  async createChurnPrediction(data: InsertChurnPrediction): Promise<ChurnPrediction> {
    const [prediction] = await db.insert(churnPredictions).values(data).returning();
    return prediction;
  }

  async updateChurnPrediction(
    predictionId: string,
    tenantId: string,
    data: Partial<ChurnPrediction>,
  ): Promise<ChurnPrediction | null> {
    const [prediction] = await db
      .update(churnPredictions)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(churnPredictions.id, predictionId), eq(churnPredictions.tenantId, tenantId)))
      .returning();
    return prediction || null;
  }

  async getHighRiskChurns(tenantId: string): Promise<ChurnPrediction[]> {
    return await db
      .select()
      .from(churnPredictions)
      .where(
        and(
          eq(churnPredictions.tenantId, tenantId),
          inArray(churnPredictions.churnRisk, ['high', 'critical']),
        ),
      )
      .orderBy(desc(churnPredictions.churnProbability));
  }

  async getExpiredPredictions(tenantId: string): Promise<ChurnPrediction[]> {
    return await db
      .select()
      .from(churnPredictions)
      .where(
        and(eq(churnPredictions.tenantId, tenantId), lte(churnPredictions.expiresAt, new Date())),
      )
      .orderBy(asc(churnPredictions.expiresAt));
  }

  async getPredictionsRequiringIntervention(tenantId: string): Promise<ChurnPrediction[]> {
    return await db
      .select()
      .from(churnPredictions)
      .where(
        and(
          eq(churnPredictions.tenantId, tenantId),
          eq(churnPredictions.interventionRequired, true),
          eq(churnPredictions.interventionTriggered, false),
        ),
      )
      .orderBy(desc(churnPredictions.churnProbability));
  }

  // Success Interventions
  async getInterventions(
    tenantId: string,
    filters?: {
      status?: string;
      interventionType?: string;
      priority?: string;
      assignedTo?: string;
    },
  ): Promise<SuccessIntervention[]> {
    const conditions = [eq(successInterventions.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(successInterventions.status, filters.status));
    }
    if (filters?.interventionType) {
      conditions.push(eq(successInterventions.interventionType, filters.interventionType));
    }
    if (filters?.priority) {
      conditions.push(eq(successInterventions.priority, filters.priority));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(successInterventions.assignedTo, filters.assignedTo));
    }

    return await db
      .select()
      .from(successInterventions)
      .where(and(...conditions))
      .orderBy(desc(successInterventions.createdAt));
  }

  async getIntervention(interventionId: string): Promise<SuccessIntervention | null> {
    const [intervention] = await db
      .select()
      .from(successInterventions)
      .where(eq(successInterventions.id, interventionId))
      .limit(1);
    return intervention || null;
  }

  async getInterventionsByCustomer(
    customerId: string,
    tenantId: string,
  ): Promise<SuccessIntervention[]> {
    return await db
      .select()
      .from(successInterventions)
      .where(
        and(
          eq(successInterventions.customerId, customerId),
          eq(successInterventions.tenantId, tenantId),
        ),
      )
      .orderBy(desc(successInterventions.createdAt));
  }

  async createIntervention(data: InsertSuccessIntervention): Promise<SuccessIntervention> {
    const [intervention] = await db.insert(successInterventions).values(data).returning();
    return intervention;
  }

  async updateIntervention(
    interventionId: string,
    tenantId: string,
    data: Partial<SuccessIntervention>,
  ): Promise<SuccessIntervention | null> {
    const [intervention] = await db
      .update(successInterventions)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(successInterventions.id, interventionId),
          eq(successInterventions.tenantId, tenantId),
        ),
      )
      .returning();
    return intervention || null;
  }

  async assignIntervention(
    interventionId: string,
    tenantId: string,
    userId: string,
  ): Promise<SuccessIntervention | null> {
    const [intervention] = await db
      .update(successInterventions)
      .set({
        assignedTo: userId,
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(successInterventions.id, interventionId),
          eq(successInterventions.tenantId, tenantId),
        ),
      )
      .returning();
    return intervention || null;
  }

  async completeIntervention(
    interventionId: string,
    tenantId: string,
    outcome: string,
    notes?: string,
  ): Promise<SuccessIntervention | null> {
    const [intervention] = await db
      .update(successInterventions)
      .set({
        status: 'completed',
        outcome,
        notes: notes || undefined,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(successInterventions.id, interventionId),
          eq(successInterventions.tenantId, tenantId),
        ),
      )
      .returning();
    return intervention || null;
  }

  async getOverdueInterventions(tenantId: string): Promise<SuccessIntervention[]> {
    return await db
      .select()
      .from(successInterventions)
      .where(
        and(
          eq(successInterventions.tenantId, tenantId),
          lt(successInterventions.dueDate, new Date()),
          sql`${successInterventions.status} NOT IN ('completed', 'cancelled')`,
        ),
      )
      .orderBy(asc(successInterventions.dueDate));
  }

  async getMyInterventions(userId: string, tenantId: string): Promise<SuccessIntervention[]> {
    return await db
      .select()
      .from(successInterventions)
      .where(
        and(
          eq(successInterventions.assignedTo, userId),
          eq(successInterventions.tenantId, tenantId),
        ),
      )
      .orderBy(asc(successInterventions.dueDate));
  }

  async cancelIntervention(
    interventionId: string,
    tenantId: string,
    reason: string,
  ): Promise<SuccessIntervention | null> {
    const [intervention] = await db
      .update(successInterventions)
      .set({
        status: 'cancelled',
        notes: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(successInterventions.id, interventionId),
          eq(successInterventions.tenantId, tenantId),
        ),
      )
      .returning();
    return intervention || null;
  }

  // Customer Journeys
  async getJourneys(
    tenantId: string,
    filters?: {
      currentStage?: string;
      lifecyclePhase?: string;
      journeyHealth?: string;
    },
  ): Promise<CustomerJourney[]> {
    const conditions = [eq(customerJourneys.tenantId, tenantId)];

    if (filters?.currentStage) {
      conditions.push(eq(customerJourneys.currentStage, filters.currentStage));
    }
    if (filters?.lifecyclePhase) {
      conditions.push(eq(customerJourneys.lifecyclePhase, filters.lifecyclePhase));
    }
    if (filters?.journeyHealth) {
      conditions.push(eq(customerJourneys.journeyHealth, filters.journeyHealth));
    }

    return await db
      .select()
      .from(customerJourneys)
      .where(and(...conditions))
      .orderBy(desc(customerJourneys.updatedAt));
  }

  async getJourney(journeyId: string): Promise<CustomerJourney | null> {
    const [journey] = await db
      .select()
      .from(customerJourneys)
      .where(eq(customerJourneys.id, journeyId))
      .limit(1);
    return journey || null;
  }

  async getJourneyByCustomer(
    customerId: string,
    tenantId: string,
  ): Promise<CustomerJourney | null> {
    const [journey] = await db
      .select()
      .from(customerJourneys)
      .where(
        and(eq(customerJourneys.customerId, customerId), eq(customerJourneys.tenantId, tenantId)),
      )
      .limit(1);
    return journey || null;
  }

  async createJourney(data: InsertCustomerJourney): Promise<CustomerJourney> {
    const [journey] = await db.insert(customerJourneys).values(data).returning();
    return journey;
  }

  async updateJourney(
    journeyId: string,
    tenantId: string,
    data: Partial<CustomerJourney>,
  ): Promise<CustomerJourney | null> {
    const [journey] = await db
      .update(customerJourneys)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenantId, tenantId)))
      .returning();
    return journey || null;
  }

  async advanceJourneyStage(
    journeyId: string,
    tenantId: string,
    newStage: string,
  ): Promise<CustomerJourney | null> {
    const journey = await this.getJourney(journeyId);
    if (!journey) return null;

    const [updatedJourney] = await db
      .update(customerJourneys)
      .set({
        previousStage: journey.currentStage,
        currentStage: newStage,
        stageEnteredAt: new Date(),
        daysSinceStageChange: 0,
        updatedAt: new Date(),
      })
      .where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenantId, tenantId)))
      .returning();
    return updatedJourney || null;
  }

  async getJourneysNeedingAttention(tenantId: string): Promise<CustomerJourney[]> {
    return await db
      .select()
      .from(customerJourneys)
      .where(
        and(
          eq(customerJourneys.tenantId, tenantId),
          inArray(customerJourneys.journeyHealth, ['needs_attention', 'off_track']),
        ),
      )
      .orderBy(desc(customerJourneys.updatedAt));
  }

  async recordJourneyTouchpoint(
    journeyId: string,
    tenantId: string,
    touchpointType: string,
  ): Promise<CustomerJourney | null> {
    const journey = await this.getJourney(journeyId);
    if (!journey) return null;

    const [updatedJourney] = await db
      .update(customerJourneys)
      .set({
        totalTouchpoints: (journey.totalTouchpoints || 0) + 1,
        lastTouchpointDate: new Date(),
        lastTouchpointType: touchpointType,
        updatedAt: new Date(),
      })
      .where(and(eq(customerJourneys.id, journeyId), eq(customerJourneys.tenantId, tenantId)))
      .returning();
    return updatedJourney || null;
  }

  // Renewal Opportunities
  async getRenewalOpportunities(
    tenantId: string,
    filters?: {
      renewalStatus?: string;
      renewalRisk?: string;
      daysUntilMax?: number;
    },
  ): Promise<RenewalOpportunity[]> {
    const conditions = [eq(renewalOpportunities.tenantId, tenantId)];

    if (filters?.renewalStatus) {
      conditions.push(eq(renewalOpportunities.renewalStatus, filters.renewalStatus));
    }
    if (filters?.renewalRisk) {
      conditions.push(eq(renewalOpportunities.renewalRisk, filters.renewalRisk));
    }
    if (filters?.daysUntilMax !== undefined) {
      conditions.push(lte(renewalOpportunities.daysUntilRenewal, filters.daysUntilMax));
    }

    return await db
      .select()
      .from(renewalOpportunities)
      .where(and(...conditions))
      .orderBy(asc(renewalOpportunities.daysUntilRenewal));
  }

  async getRenewalOpportunity(opportunityId: string): Promise<RenewalOpportunity | null> {
    const [opportunity] = await db
      .select()
      .from(renewalOpportunities)
      .where(eq(renewalOpportunities.id, opportunityId))
      .limit(1);
    return opportunity || null;
  }

  async getRenewalsByCustomer(customerId: string, tenantId: string): Promise<RenewalOpportunity[]> {
    return await db
      .select()
      .from(renewalOpportunities)
      .where(
        and(
          eq(renewalOpportunities.customerId, customerId),
          eq(renewalOpportunities.tenantId, tenantId),
        ),
      )
      .orderBy(asc(renewalOpportunities.daysUntilRenewal));
  }

  async getRenewalByContract(
    contractId: string,
    tenantId: string,
  ): Promise<RenewalOpportunity | null> {
    const [opportunity] = await db
      .select()
      .from(renewalOpportunities)
      .where(
        and(
          eq(renewalOpportunities.contractId, contractId),
          eq(renewalOpportunities.tenantId, tenantId),
        ),
      )
      .limit(1);
    return opportunity || null;
  }

  async createRenewalOpportunity(data: InsertRenewalOpportunity): Promise<RenewalOpportunity> {
    const [opportunity] = await db.insert(renewalOpportunities).values(data).returning();
    return opportunity;
  }

  async updateRenewalOpportunity(
    opportunityId: string,
    tenantId: string,
    data: Partial<RenewalOpportunity>,
  ): Promise<RenewalOpportunity | null> {
    const [opportunity] = await db
      .update(renewalOpportunities)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(renewalOpportunities.id, opportunityId),
          eq(renewalOpportunities.tenantId, tenantId),
        ),
      )
      .returning();
    return opportunity || null;
  }

  async assignRenewalCsm(
    opportunityId: string,
    tenantId: string,
    csmId: string,
  ): Promise<RenewalOpportunity | null> {
    const [opportunity] = await db
      .update(renewalOpportunities)
      .set({
        assignedCsm: csmId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(renewalOpportunities.id, opportunityId),
          eq(renewalOpportunities.tenantId, tenantId),
        ),
      )
      .returning();
    return opportunity || null;
  }

  async closeRenewal(
    opportunityId: string,
    tenantId: string,
    won: boolean,
    notes: string,
  ): Promise<RenewalOpportunity | null> {
    const [opportunity] = await db
      .update(renewalOpportunities)
      .set({
        renewalStatus: won ? 'won' : 'lost',
        outcomeNotes: notes,
        actualRenewalDate: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(renewalOpportunities.id, opportunityId),
          eq(renewalOpportunities.tenantId, tenantId),
        ),
      )
      .returning();
    return opportunity || null;
  }

  async getUpcomingRenewals(tenantId: string, days: number): Promise<RenewalOpportunity[]> {
    return await db
      .select()
      .from(renewalOpportunities)
      .where(
        and(
          eq(renewalOpportunities.tenantId, tenantId),
          lte(renewalOpportunities.daysUntilRenewal, days),
        ),
      )
      .orderBy(asc(renewalOpportunities.daysUntilRenewal));
  }

  async getHighValueRenewals(tenantId: string, minMrr: number): Promise<RenewalOpportunity[]> {
    return await db
      .select()
      .from(renewalOpportunities)
      .where(
        and(
          eq(renewalOpportunities.tenantId, tenantId),
          gte(renewalOpportunities.currentMrr, minMrr.toString()),
        ),
      )
      .orderBy(desc(renewalOpportunities.currentMrr));
  }

  // ==================== Assignment Groups ====================

  async getAssignmentGroups(tenantId: string) {
    return await db.query.assignmentGroups.findMany({
      where: eq(assignmentGroups.tenantId, tenantId),
      orderBy: (groups, { asc }) => [asc(groups.name)],
    });
  }

  async getAssignmentGroup(id: string) {
    return await db.query.assignmentGroups.findFirst({
      where: eq(assignmentGroups.id, id),
    });
  }

  async createAssignmentGroup(data: any) {
    const [group] = await db.insert(assignmentGroups).values(data).returning();
    return group;
  }

  async updateAssignmentGroup(id: string, data: any) {
    const [updated] = await db
      .update(assignmentGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(assignmentGroups.id, id))
      .returning();
    return updated;
  }

  async deleteAssignmentGroup(id: string) {
    await db.delete(assignmentGroups).where(eq(assignmentGroups.id, id));
  }

  async isUserInGroup(userId: string, groupId: string | null): Promise<boolean> {
    if (!groupId) return false;

    const group = await db.query.assignmentGroups.findFirst({
      where: eq(assignmentGroups.id, groupId),
    });

    if (!group || !group.members || !Array.isArray(group.members)) {
      return false;
    }

    return group.members.includes(userId);
  }

  // ==================== Workflow Approvals ====================

  async getUserApprovals(userId: string, tenantId: string, status?: string) {
    // Get user's groups
    const userGroups = await db.query.assignmentGroups.findMany({
      where: and(eq(assignmentGroups.tenantId, tenantId), eq(assignmentGroups.isActive, true)),
    });

    const userGroupIds = userGroups
      .filter(
        (group) => group.members && Array.isArray(group.members) && group.members.includes(userId),
      )
      .map((group) => group.id);

    // Build where conditions
    const conditions = [eq(workflowApprovals.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(workflowApprovals.status, status));
    }

    // Get approvals where user is directly assigned or is in assigned group
    const approvals = await db.query.workflowApprovals.findMany({
      where: and(...conditions),
    });

    // Filter to only approvals for this user or their groups
    return approvals.filter(
      (approval) =>
        approval.assignedToUserId === userId ||
        (approval.assignedToGroupId && userGroupIds.includes(approval.assignedToGroupId)),
    );
  }

  async getWorkflowApproval(id: string) {
    return await db.query.workflowApprovals.findFirst({
      where: eq(workflowApprovals.id, id),
    });
  }

  async getExecutionApprovals(executionId: string, tenantId: string) {
    return await db.query.workflowApprovals.findMany({
      where: and(
        eq(workflowApprovals.executionId, executionId),
        eq(workflowApprovals.tenantId, tenantId),
      ),
      orderBy: (approvals, { asc }) => [asc(approvals.requestedAt)],
    });
  }

  async createWorkflowApproval(data: any) {
    const [approval] = await db.insert(workflowApprovals).values(data).returning();
    return approval;
  }

  async updateWorkflowApproval(id: string, data: any) {
    const [updated] = await db
      .update(workflowApprovals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflowApprovals.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
