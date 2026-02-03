/**
 * Audit System Type Definitions
 * Comprehensive types for the audit framework
 */

// ============================================================================
// Route & Endpoint Types
// ============================================================================

export interface DiscoveredEndpoint {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Route path */
  path: string;
  /** Source file where route is defined */
  sourceFile: string;
  /** Line number in source file */
  lineNumber: number;
  /** Whether route requires authentication */
  requiresAuth: boolean;
  /** Required permissions */
  permissions?: string[];
  /** Route handler name */
  handlerName?: string;
  /** Middleware chain */
  middleware: string[];
}

export interface EndpointTestResult {
  endpoint: DiscoveredEndpoint;
  /** Test timestamp */
  timestamp: Date;
  /** Tests by user context */
  contextResults: {
    context: string;
    roleLevel: number;
    /** Response status code */
    statusCode: number;
    /** Response time in ms */
    responseTime: number;
    /** Response body (truncated) */
    responseBody?: string;
    /** Error if any */
    error?: string;
    /** Whether auth was properly enforced */
    authEnforced: boolean;
    /** Whether tenant isolation was verified */
    tenantIsolated: boolean;
  }[];
  /** Overall endpoint status */
  status: 'healthy' | 'failing' | 'partial' | 'untested';
  /** Issues found */
  issues: AuditIssue[];
}

// ============================================================================
// Edge Function Types
// ============================================================================

export interface DiscoveredEdgeFunction {
  /** Function name (directory name) */
  name: string;
  /** Function path */
  path: string;
  /** Endpoint URL */
  endpoint: string;
  /** HTTP methods detected */
  methods: string[];
  /** Whether function requires auth */
  requiresAuth: boolean;
  /** Has CORS configured */
  hasCors: boolean;
  /** Source code analysis */
  sourceAnalysis: {
    hasTodo: boolean;
    todoComments: string[];
    hasIncompleteHandlers: boolean;
    incompleteHandlers: string[];
    imports: string[];
    usesSupabaseClient: boolean;
  };
}

export interface EdgeFunctionTestResult {
  function: DiscoveredEdgeFunction;
  /** Test timestamp */
  timestamp: Date;
  /** Whether function is reachable */
  reachable: boolean;
  /** HTTP status code */
  statusCode?: number;
  /** Response time in ms */
  responseTime?: number;
  /** CORS headers */
  corsHeaders?: Record<string, string>;
  /** Auth test results */
  authTest?: {
    withoutAuth: { status: number; error?: string };
    withAuth?: { status: number; error?: string };
  };
  /** Overall status */
  status: 'healthy' | 'failing' | 'incomplete' | 'unreachable';
  /** Issues found */
  issues: AuditIssue[];
}

// ============================================================================
// Contract Types
// ============================================================================

export interface FrontendApiCall {
  /** File path where call is made */
  sourceFile: string;
  /** Line number */
  lineNumber: number;
  /** HTTP method */
  method: string;
  /** Endpoint URL or pattern */
  endpoint: string;
  /** Query client key if using TanStack Query */
  queryKey?: string;
  /** Is mutation or query */
  type: 'query' | 'mutation' | 'direct';
}

export interface ContractMismatch {
  /** Frontend call */
  frontendCall: FrontendApiCall;
  /** Type of mismatch */
  type: 'orphaned' | 'method-mismatch' | 'deprecated';
  /** Description */
  description: string;
}

// ============================================================================
// Database/RLS Types
// ============================================================================

export interface TableAuditResult {
  /** Table name */
  tableName: string;
  /** Whether table has tenant_id column */
  hasTenantId: boolean;
  /** Whether RLS is enforced */
  rlsEnforced: boolean;
  /** Test results for cross-tenant access */
  crossTenantTest?: {
    attempted: boolean;
    blocked: boolean;
    error?: string;
  };
  /** Role-based access test */
  roleAccessTest?: Record<
    string,
    {
      canRead: boolean;
      canWrite: boolean;
      scopeRespected: boolean;
    }
  >;
  /** Issues found */
  issues: AuditIssue[];
}

// ============================================================================
// Security Types
// ============================================================================

export interface SecurityTestResult {
  /** Test category */
  category: 'cors' | 'auth' | 'tenant' | 'input' | 'rate-limit' | 'security';
  /** Test name */
  name: string;
  /** Test passed */
  passed: boolean;
  /** Test details */
  details: string;
  /** Endpoint tested */
  endpoint?: string;
  /** Severity if failed */
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================================================
// Common Types
// ============================================================================

export interface AuditIssue {
  /** Issue ID */
  id: string;
  /** Issue type */
  type: 'error' | 'warning' | 'info';
  /** Issue category */
  category:
    | 'auth'
    | 'tenant'
    | 'cors'
    | 'performance'
    | 'incomplete'
    | 'security'
    | 'contract'
    | 'database';
  /** Issue message */
  message: string;
  /** Affected resource */
  resource: string;
  /** Source file if applicable */
  sourceFile?: string;
  /** Line number if applicable */
  lineNumber?: number;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Suggested fix */
  suggestedFix?: string;
}

export interface AuditReport {
  /** Report type */
  type:
    | 'api-endpoints'
    | 'edge-functions'
    | 'api-contracts'
    | 'route-overlaps'
    | 'database-rls'
    | 'security'
    | 'comprehensive';
  /** Report timestamp */
  timestamp: Date;
  /** Duration in ms */
  duration: number;
  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  /** Issues found */
  issues: AuditIssue[];
  /** Report-specific data */
  data: unknown;
}

// ============================================================================
// Error Tracker Types
// ============================================================================

export interface TrackedError {
  /** Unique error ID */
  id: string;
  /** Error signature (for deduplication) */
  signature: string;
  /** Error message */
  message: string;
  /** Error category */
  category: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Status */
  status: 'open' | 'investigating' | 'fixed' | 'wont-fix';
  /** First occurrence */
  firstSeen: Date;
  /** Last occurrence */
  lastSeen: Date;
  /** Occurrence count */
  occurrences: number;
  /** Affected resources */
  affectedResources: string[];
  /** Related audit types */
  auditTypes: string[];
  /** Notes */
  notes?: string[];
  /** Resolution details */
  resolution?: {
    date: Date;
    description: string;
    commitHash?: string;
  };
}

export interface ErrorDatabase {
  /** Version */
  version: number;
  /** Last updated */
  lastUpdated: Date;
  /** Errors */
  errors: TrackedError[];
  /** Historical snapshots */
  history: {
    date: Date;
    totalErrors: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
  }[];
}

// ============================================================================
// User Context Types
// ============================================================================

export interface TestUserContext {
  /** Context name */
  name: string;
  /** User ID */
  userId: string;
  /** Tenant ID */
  tenantId: string;
  /** Role level (1-8) */
  roleLevel: number;
  /** Role name */
  roleName: string;
  /** Organizational scope */
  organizationalScope: 'own' | 'location' | 'regional' | 'company' | 'platform';
  /** Location ID */
  locationId?: string;
  /** Regional ID */
  regionalId?: string;
  /** Company ID */
  companyId?: string;
  /** Permissions */
  permissions: string[];
}
