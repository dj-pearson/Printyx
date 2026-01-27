/**
 * OpenAPI/Swagger Configuration
 * Auto-generates API documentation from route definitions and JSDoc comments
 */

import type { OpenAPIV3 } from 'openapi-types';

/**
 * Base OpenAPI configuration for the Printyx API
 */
export const openApiConfig: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Printyx API',
    version: '1.0.0',
    description: `
# Printyx API Documentation

Printyx is a comprehensive copier dealer CRM and service management platform. This API provides access to all platform functionality including:

- **CRM**: Business records, contacts, leads, opportunities
- **Service**: Tickets, dispatch, technician management
- **Billing**: Invoices, contracts, meter readings
- **Inventory**: Equipment, parts, supplies
- **Analytics**: Reports, KPIs, dashboards

## Authentication

All API endpoints require authentication via one of the following methods:

1. **JWT Token** (Supabase Auth): Include the token in the Authorization header
   \`\`\`
   Authorization: Bearer <your-jwt-token>
   \`\`\`

2. **API Key**: For service-to-service communication
   \`\`\`
   X-API-Key: <your-api-key>
   \`\`\`

## Multi-Tenant Architecture

All requests must include tenant context:
- **Header**: \`x-tenant-id: <tenant-uuid>\` (preferred)
- **JWT Claim**: \`app_metadata.tenantId\` (automatic)

## Rate Limiting

- **Global**: 1000 requests per 15 minutes per IP
- **Auth endpoints**: 10 requests per 15 minutes per IP
- **API Key**: Configurable per-key (minute/hour/day limits)

## Response Format

All responses follow a consistent format:

\`\`\`json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 25,
    "totalItems": 100,
    "totalPages": 4,
    "hasNextPage": true
  }
}
\`\`\`

Error responses:
\`\`\`json
{
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": { ... },
  "requestId": "uuid"
}
\`\`\`
    `,
    contact: {
      name: 'Printyx Support',
      email: 'support@printyx.net',
      url: 'https://printyx.net/support',
    },
    license: {
      name: 'Proprietary',
      url: 'https://printyx.net/terms',
    },
  },
  servers: [
    {
      url: 'https://api.printyx.net',
      description: 'Production server',
    },
    {
      url: 'http://localhost:5000',
      description: 'Development server',
    },
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication and session management' },
    { name: 'Business Records', description: 'Unified CRM records (leads and customers)' },
    { name: 'Contacts', description: 'Contact management' },
    { name: 'Deals', description: 'Deal pipeline and opportunity management' },
    { name: 'Service Tickets', description: 'Service dispatch and ticket management' },
    { name: 'Technicians', description: 'Technician management and scheduling' },
    { name: 'Equipment', description: 'Equipment lifecycle and tracking' },
    { name: 'Contracts', description: 'Service contracts and agreements' },
    { name: 'Invoices', description: 'Invoice generation and billing' },
    { name: 'Meter Readings', description: 'Equipment meter reading collection' },
    { name: 'Inventory', description: 'Inventory and parts management' },
    { name: 'Reports', description: 'Reporting and analytics' },
    { name: 'Knowledge Base', description: 'Support articles and documentation' },
    {
      name: 'Integrations',
      description: 'Third-party integrations (Salesforce, QuickBooks, etc.)',
    },
    { name: 'Admin', description: 'Platform administration' },
    { name: 'Health', description: 'System health and monitoring' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT authentication token',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for service-to-service communication',
      },
    },
    schemas: {
      // Common response schemas
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Error message' },
          code: { type: 'string', description: 'Error code' },
          details: { type: 'object', description: 'Additional error details' },
          requestId: { type: 'string', format: 'uuid', description: 'Request tracking ID' },
        },
        required: ['message'],
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, description: 'Current page number' },
          limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Items per page' },
          totalItems: { type: 'integer', description: 'Total number of items' },
          totalPages: { type: 'integer', description: 'Total number of pages' },
          hasNextPage: { type: 'boolean', description: 'Whether more pages exist' },
          hasPreviousPage: { type: 'boolean', description: 'Whether previous pages exist' },
        },
      },
      // Business Record schema
      BusinessRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          recordType: { type: 'string', enum: ['lead', 'customer', 'former_customer'] },
          status: { type: 'string' },
          companyName: { type: 'string' },
          companyDisplayId: { type: 'string' },
          urlSlug: { type: 'string' },
          primaryContactName: { type: 'string' },
          primaryContactEmail: { type: 'string', format: 'email' },
          primaryContactPhone: { type: 'string' },
          addressLine1: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          postalCode: { type: 'string' },
          leadScore: { type: 'integer', minimum: 0, maximum: 100 },
          estimatedAmount: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      // Service Ticket schema
      ServiceTicket: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          ticketNumber: { type: 'string' },
          customerId: { type: 'string', format: 'uuid' },
          equipmentId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          status: {
            type: 'string',
            enum: ['open', 'assigned', 'in-progress', 'completed', 'cancelled'],
          },
          assignedTechnicianId: { type: 'string', format: 'uuid' },
          scheduledDate: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      // Equipment schema
      Equipment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          customerId: { type: 'string', format: 'uuid' },
          modelNumber: { type: 'string' },
          serialNumber: { type: 'string' },
          installDate: { type: 'string', format: 'date' },
          status: { type: 'string' },
          contractId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Technician schema
      Technician: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          skills: { type: 'array', items: { type: 'string' } },
          isActive: { type: 'boolean' },
          isAvailable: { type: 'boolean' },
        },
      },
      // Invoice schema
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          invoiceNumber: { type: 'string' },
          customerId: { type: 'string', format: 'uuid' },
          amount: { type: 'number' },
          status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] },
          dueDate: { type: 'string', format: 'date' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Meter Reading schema
      MeterReading: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          equipmentId: { type: 'string', format: 'uuid' },
          readingDate: { type: 'string', format: 'date-time' },
          bwMeterReading: { type: 'integer' },
          colorMeterReading: { type: 'integer' },
          collectionMethod: {
            type: 'string',
            enum: ['manual', 'dca', 'email', 'api', 'remote_monitoring'],
          },
          isVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Contract schema
      Contract: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          contractNumber: { type: 'string' },
          customerId: { type: 'string', format: 'uuid' },
          contractType: { type: 'string' },
          status: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          monthlyAmount: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Deal schema
      Deal: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          customerId: { type: 'string', format: 'uuid' },
          stage: { type: 'string' },
          amount: { type: 'number' },
          probability: { type: 'integer', minimum: 0, maximum: 100 },
          expectedCloseDate: { type: 'string', format: 'date' },
          ownerId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      // Report schema
      ReportDefinition: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          scope: { type: 'string' },
          parameters: { type: 'object' },
          requiredPermissions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    parameters: {
      tenantId: {
        name: 'x-tenant-id',
        in: 'header',
        required: false,
        schema: { type: 'string', format: 'uuid' },
        description: 'Tenant ID for multi-tenant context (optional if included in JWT)',
      },
      page: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
        description: 'Page number for pagination',
      },
      limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        description: 'Number of items per page',
      },
      search: {
        name: 'search',
        in: 'query',
        schema: { type: 'string' },
        description: 'Search term for filtering results',
      },
      sortBy: {
        name: 'sortBy',
        in: 'query',
        schema: { type: 'string' },
        description: 'Field to sort by',
      },
      sortDirection: {
        name: 'sortDirection',
        in: 'query',
        schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        description: 'Sort direction',
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              message: 'Not authenticated',
              code: 'UNAUTHORIZED',
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
      Forbidden: {
        description: 'Permission denied',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              message: 'You do not have permission to access this resource',
              code: 'FORBIDDEN',
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              message: 'Resource not found',
              code: 'NOT_FOUND',
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              message: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: {
                email: ['Invalid email format'],
                name: ['Name is required'],
              },
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              message: 'Too many requests, please try again later',
              code: 'RATE_LIMITED',
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
        headers: {
          'X-RateLimit-Remaining': {
            schema: { type: 'integer' },
            description: 'Number of requests remaining',
          },
          'X-RateLimit-Reset': {
            schema: { type: 'integer' },
            description: 'Unix timestamp when the rate limit resets',
          },
        },
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              message: 'An internal error occurred',
              code: 'INTERNAL_ERROR',
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {},
};

/**
 * OpenAPI path definitions for core endpoints
 * These are manually defined for the most important endpoints
 */
export const corePaths: OpenAPIV3.PathsObject = {
  // Health endpoints
  '/health': {
    get: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns the overall health status of the application',
      security: [],
      responses: {
        '200': {
          description: 'Application is healthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                  timestamp: { type: 'string', format: 'date-time' },
                  version: { type: 'string' },
                  uptime: { type: 'number' },
                  database: { type: 'string', enum: ['connected', 'disconnected'] },
                },
              },
            },
          },
        },
        '503': {
          description: 'Application is unhealthy',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['unhealthy'] },
                  error: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },

  // Authentication endpoints
  '/api/auth/login': {
    post: {
      tags: ['Authentication'],
      summary: 'User login',
      description: 'Authenticate user with email and password',
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 12 },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      email: { type: 'string', format: 'email' },
                      tenantId: { type: 'string', format: 'uuid' },
                    },
                  },
                  session: {
                    type: 'object',
                    properties: {
                      access_token: { type: 'string' },
                      refresh_token: { type: 'string' },
                      expires_at: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': { $ref: '#/components/responses/RateLimited' },
      },
    },
  },

  // Business Records endpoints
  '/api/business-records': {
    get: {
      tags: ['Business Records'],
      summary: 'List business records',
      description: 'Get a paginated list of business records (leads and customers)',
      parameters: [
        { $ref: '#/components/parameters/tenantId' },
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/limit' },
        { $ref: '#/components/parameters/search' },
        { $ref: '#/components/parameters/sortBy' },
        { $ref: '#/components/parameters/sortDirection' },
        {
          name: 'recordType',
          in: 'query',
          schema: { type: 'string', enum: ['lead', 'customer', 'former_customer'] },
          description: 'Filter by record type',
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string' },
          description: 'Filter by status',
        },
      ],
      responses: {
        '200': {
          description: 'List of business records',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/BusinessRecord' },
                  },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Business Records'],
      summary: 'Create business record',
      description: 'Create a new lead or customer record',
      parameters: [{ $ref: '#/components/parameters/tenantId' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/BusinessRecord' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Business record created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BusinessRecord' },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/business-records/{id}': {
    get: {
      tags: ['Business Records'],
      summary: 'Get business record',
      description: 'Get a specific business record by ID',
      parameters: [
        { $ref: '#/components/parameters/tenantId' },
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'Business record details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BusinessRecord' },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFound' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    put: {
      tags: ['Business Records'],
      summary: 'Update business record',
      description: 'Update an existing business record',
      parameters: [
        { $ref: '#/components/parameters/tenantId' },
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/BusinessRecord' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Business record updated',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BusinessRecord' },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFound' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    delete: {
      tags: ['Business Records'],
      summary: 'Delete business record',
      description: 'Delete a business record (soft delete)',
      parameters: [
        { $ref: '#/components/parameters/tenantId' },
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '204': { description: 'Business record deleted' },
        '404': { $ref: '#/components/responses/NotFound' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  // Service Tickets endpoints
  '/api/service-tickets': {
    get: {
      tags: ['Service Tickets'],
      summary: 'List service tickets',
      description: 'Get a paginated list of service tickets',
      parameters: [
        { $ref: '#/components/parameters/tenantId' },
        { $ref: '#/components/parameters/page' },
        { $ref: '#/components/parameters/limit' },
        { $ref: '#/components/parameters/search' },
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['open', 'assigned', 'in-progress', 'completed', 'cancelled'],
          },
        },
        {
          name: 'priority',
          in: 'query',
          schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        },
        {
          name: 'technicianId',
          in: 'query',
          schema: { type: 'string', format: 'uuid' },
        },
        {
          name: 'customerId',
          in: 'query',
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        '200': {
          description: 'List of service tickets',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ServiceTicket' },
                  },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
    post: {
      tags: ['Service Tickets'],
      summary: 'Create service ticket',
      description: 'Create a new service ticket',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ServiceTicket' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Service ticket created',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ServiceTicket' },
            },
          },
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },

  // Reports endpoints
  '/api/reports': {
    get: {
      tags: ['Reports'],
      summary: 'List available reports',
      description: 'Get list of report definitions available to the current user',
      parameters: [
        { $ref: '#/components/parameters/tenantId' },
        {
          name: 'category',
          in: 'query',
          schema: { type: 'string' },
          description: 'Filter by report category',
        },
      ],
      responses: {
        '200': {
          description: 'List of report definitions',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/ReportDefinition' },
              },
            },
          },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
      },
    },
  },
  '/api/reports/{code}/execute': {
    post: {
      tags: ['Reports'],
      summary: 'Execute report',
      description: 'Execute a report with the specified parameters',
      parameters: [
        { $ref: '#/components/parameters/tenantId' },
        {
          name: 'code',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Report code (e.g., SALES_PIPELINE_INDIVIDUAL)',
        },
      ],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                filters: { type: 'object' },
                parameters: { type: 'object' },
                sort: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    direction: { type: 'string', enum: ['asc', 'desc'] },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: 'Report execution results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { type: 'object' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                  metadata: {
                    type: 'object',
                    properties: {
                      executionTime: { type: 'number' },
                      cached: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/NotFound' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': { $ref: '#/components/responses/Forbidden' },
      },
    },
  },
};
