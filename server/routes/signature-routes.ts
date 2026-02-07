import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('signature-routes');

import {
  insertIntegrationCredentialSchema,
  insertSignatureRequestSchema,
  insertSignatureSignerSchema,
  insertSignatureDocumentSchema,
  insertSignatureAuditLogSchema,
} from '@shared/schema';

const router = Router();

// ============================================================================
// INTEGRATION CREDENTIALS ENDPOINTS
// ============================================================================

// Get all integration credentials for tenant
router.get('/integration-credentials', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const provider = req.query.provider as string | undefined;
    const credentials = await storage.getIntegrationCredentials(tenantId, provider);

    // Don't expose sensitive credentials in list view
    const safeCredentials = credentials.map((cred) => ({
      ...cred,
      apiKey: cred.apiKey ? '***' : null,
      apiSecret: cred.apiSecret ? '***' : null,
      accessToken: cred.accessToken ? '***' : null,
      refreshToken: cred.refreshToken ? '***' : null,
      webhookSecret: cred.webhookSecret ? '***' : null,
    }));

    res.json(safeCredentials);
  } catch (error) {
    log.error('Error fetching integration credentials:', error);
    res.status(500).json({ error: 'Failed to fetch integration credentials' });
  }
});

// Get single integration credential
router.get('/integration-credentials/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const credential = await storage.getIntegrationCredential(req.params.id, tenantId);
    if (!credential) {
      return res.status(404).json({ error: 'Integration credential not found' });
    }

    // Don't expose sensitive credentials
    const safeCredential = {
      ...credential,
      apiKey: credential.apiKey ? '***' : null,
      apiSecret: credential.apiSecret ? '***' : null,
      accessToken: credential.accessToken ? '***' : null,
      refreshToken: credential.refreshToken ? '***' : null,
      webhookSecret: credential.webhookSecret ? '***' : null,
    };

    res.json(safeCredential);
  } catch (error) {
    log.error('Error fetching integration credential:', error);
    res.status(500).json({ error: 'Failed to fetch integration credential' });
  }
});

// Create integration credential
router.post('/integration-credentials', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = insertIntegrationCredentialSchema.parse({
      ...req.body,
      tenantId,
      createdBy: req.session.user?.id,
    });

    const credential = await storage.createIntegrationCredential(data);

    // Don't expose sensitive credentials in response
    const safeCredential = {
      ...credential,
      apiKey: credential.apiKey ? '***' : null,
      apiSecret: credential.apiSecret ? '***' : null,
      accessToken: credential.accessToken ? '***' : null,
      refreshToken: credential.refreshToken ? '***' : null,
      webhookSecret: credential.webhookSecret ? '***' : null,
    };

    res.status(201).json(safeCredential);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    log.error('Error creating integration credential:', error);
    res.status(500).json({ error: 'Failed to create integration credential' });
  }
});

// Update integration credential
router.patch('/integration-credentials/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate update data with partial schema
    const updateData = insertIntegrationCredentialSchema
      .partial()
      .omit({ tenantId: true, createdBy: true })
      .parse(req.body);

    const data = {
      ...updateData,
      updatedBy: req.session.user?.id,
    };

    const credential = await storage.updateIntegrationCredential(req.params.id, tenantId, data);
    if (!credential) {
      return res.status(404).json({ error: 'Integration credential not found' });
    }

    // Don't expose sensitive credentials
    const safeCredential = {
      ...credential,
      apiKey: credential.apiKey ? '***' : null,
      apiSecret: credential.apiSecret ? '***' : null,
      accessToken: credential.accessToken ? '***' : null,
      refreshToken: credential.refreshToken ? '***' : null,
      webhookSecret: credential.webhookSecret ? '***' : null,
    };

    res.json(safeCredential);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    log.error('Error updating integration credential:', error);
    res.status(500).json({ error: 'Failed to update integration credential' });
  }
});

// Delete integration credential
router.delete('/integration-credentials/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await storage.deleteIntegrationCredential(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    log.error('Error deleting integration credential:', error);
    res.status(500).json({ error: 'Failed to delete integration credential' });
  }
});

// Test integration connection
router.post('/integration-credentials/:id/test', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await storage.testIntegrationConnection(req.params.id, tenantId);
    res.json(result);
  } catch (error) {
    log.error('Error testing integration connection:', error);
    res.status(500).json({ error: 'Failed to test integration connection' });
  }
});

// ============================================================================
// SIGNATURE REQUESTS ENDPOINTS
// ============================================================================

// Get all signature requests
router.get('/signature-requests', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = req.query.status as string | undefined;
    const requests = await storage.getSignatureRequests(tenantId, status);
    res.json(requests);
  } catch (error) {
    log.error('Error fetching signature requests:', error);
    res.status(500).json({ error: 'Failed to fetch signature requests' });
  }
});

// Get single signature request
router.get('/signature-requests/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request = await storage.getSignatureRequest(req.params.id, tenantId);
    if (!request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    res.json(request);
  } catch (error) {
    log.error('Error fetching signature request:', error);
    res.status(500).json({ error: 'Failed to fetch signature request' });
  }
});

// Get signature requests by customer
router.get('/customers/:customerId/signature-requests', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requests = await storage.getSignatureRequestsByCustomer(req.params.customerId, tenantId);
    res.json(requests);
  } catch (error) {
    log.error('Error fetching signature requests by customer:', error);
    res.status(500).json({ error: 'Failed to fetch signature requests' });
  }
});

// Get expiring signature requests
router.get('/signature-requests/expiring/soon', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const days = parseInt(req.query.days as string) || 7;
    const requests = await storage.getExpiringSignatureRequests(tenantId, days);
    res.json(requests);
  } catch (error) {
    log.error('Error fetching expiring signature requests:', error);
    res.status(500).json({ error: 'Failed to fetch expiring signature requests' });
  }
});

// Create signature request
router.post('/signature-requests', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = insertSignatureRequestSchema.parse({
      ...req.body,
      tenantId,
      createdBy: req.session.user?.id,
    });

    const request = await storage.createSignatureRequest(data);

    // Create audit log
    await storage.createSignatureAuditLog({
      tenantId,
      requestId: request.id,
      eventType: 'request_created',
      eventDescription: `Signature request "${request.title}" created`,
      actorType: 'user',
      actorId: req.session.user?.id,
      actorName: req.session.user?.fullName,
      actorEmail: req.session.user?.email,
    });

    res.status(201).json(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    log.error('Error creating signature request:', error);
    res.status(500).json({ error: 'Failed to create signature request' });
  }
});

// Update signature request
router.patch('/signature-requests/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = {
      ...req.body,
      updatedBy: req.session.user?.id,
    };

    const request = await storage.updateSignatureRequest(req.params.id, tenantId, data);
    if (!request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    res.json(request);
  } catch (error) {
    log.error('Error updating signature request:', error);
    res.status(500).json({ error: 'Failed to update signature request' });
  }
});

// Delete signature request
router.delete('/signature-requests/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await storage.deleteSignatureRequest(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    log.error('Error deleting signature request:', error);
    res.status(500).json({ error: 'Failed to delete signature request' });
  }
});

// Send signature request (initiate with provider)
router.post('/signature-requests/:id/send', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request = await storage.getSignatureRequest(req.params.id, tenantId);
    if (!request) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    // TODO: Integrate with actual e-signature provider (DocuSign, Adobe Sign, etc.)
    // For now, update status to 'sent'
    const updatedRequest = await storage.updateSignatureRequest(req.params.id, tenantId, {
      status: 'sent',
      sentAt: new Date(),
    });

    // Create audit log
    await storage.createSignatureAuditLog({
      tenantId,
      requestId: req.params.id,
      eventType: 'sent',
      eventDescription: 'Signature request sent to signers',
      actorType: 'user',
      actorId: req.session.user?.id,
      actorName: req.session.user?.fullName,
      actorEmail: req.session.user?.email,
    });

    res.json(updatedRequest);
  } catch (error) {
    log.error('Error sending signature request:', error);
    res.status(500).json({ error: 'Failed to send signature request' });
  }
});

// Void signature request
router.post('/signature-requests/:id/void', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reason } = req.body;
    const updatedRequest = await storage.updateSignatureRequest(req.params.id, tenantId, {
      status: 'voided',
      voidedReason: reason,
    });

    if (!updatedRequest) {
      return res.status(404).json({ error: 'Signature request not found' });
    }

    // Create audit log
    await storage.createSignatureAuditLog({
      tenantId,
      requestId: req.params.id,
      eventType: 'voided',
      eventDescription: `Signature request voided: ${reason}`,
      actorType: 'user',
      actorId: req.session.user?.id,
      actorName: req.session.user?.fullName,
      actorEmail: req.session.user?.email,
    });

    res.json(updatedRequest);
  } catch (error) {
    log.error('Error voiding signature request:', error);
    res.status(500).json({ error: 'Failed to void signature request' });
  }
});

// ============================================================================
// SIGNATURE SIGNERS ENDPOINTS
// ============================================================================

// Get signers for a request
router.get('/signature-requests/:requestId/signers', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const signers = await storage.getSignatureSigners(req.params.requestId, tenantId);
    res.json(signers);
  } catch (error) {
    log.error('Error fetching signers:', error);
    res.status(500).json({ error: 'Failed to fetch signers' });
  }
});

// Get single signer
router.get('/signature-signers/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const signer = await storage.getSignatureSigner(req.params.id, tenantId);
    if (!signer) {
      return res.status(404).json({ error: 'Signer not found' });
    }

    res.json(signer);
  } catch (error) {
    log.error('Error fetching signer:', error);
    res.status(500).json({ error: 'Failed to fetch signer' });
  }
});

// Create signer
router.post('/signature-signers', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = insertSignatureSignerSchema.parse({
      ...req.body,
      tenantId,
    });

    const signer = await storage.createSignatureSigner(data);
    res.status(201).json(signer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    log.error('Error creating signer:', error);
    res.status(500).json({ error: 'Failed to create signer' });
  }
});

// Update signer
router.patch('/signature-signers/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const signer = await storage.updateSignatureSigner(req.params.id, tenantId, req.body);
    if (!signer) {
      return res.status(404).json({ error: 'Signer not found' });
    }

    res.json(signer);
  } catch (error) {
    log.error('Error updating signer:', error);
    res.status(500).json({ error: 'Failed to update signer' });
  }
});

// Delete signer
router.delete('/signature-signers/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await storage.deleteSignatureSigner(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    log.error('Error deleting signer:', error);
    res.status(500).json({ error: 'Failed to delete signer' });
  }
});

// ============================================================================
// SIGNATURE DOCUMENTS ENDPOINTS
// ============================================================================

// Get documents for a request
router.get('/signature-requests/:requestId/documents', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const documents = await storage.getSignatureDocuments(req.params.requestId, tenantId);
    res.json(documents);
  } catch (error) {
    log.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get single document
router.get('/signature-documents/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const document = await storage.getSignatureDocument(req.params.id, tenantId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    log.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Create document
router.post('/signature-documents', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data = insertSignatureDocumentSchema.parse({
      ...req.body,
      tenantId,
    });

    const document = await storage.createSignatureDocument(data);
    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    log.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Update document
router.patch('/signature-documents/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const document = await storage.updateSignatureDocument(req.params.id, tenantId, req.body);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    log.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/signature-documents/:id', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await storage.deleteSignatureDocument(req.params.id, tenantId);
    res.status(204).send();
  } catch (error) {
    log.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ============================================================================
// SIGNATURE AUDIT LOGS ENDPOINTS
// ============================================================================

// Get audit logs for a request
router.get('/signature-requests/:requestId/audit-logs', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const logs = await storage.getSignatureAuditLogs(req.params.requestId, tenantId);
    res.json(logs);
  } catch (error) {
    log.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit logs by signer
router.get('/signature-signers/:signerId/audit-logs', async (req, res) => {
  try {
    const tenantId = req.session.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const logs = await storage.getSignatureAuditLogsBySigner(req.params.signerId, tenantId);
    res.json(logs);
  } catch (error) {
    log.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ============================================================================
// WEBHOOK ENDPOINTS (for provider callbacks)
// ============================================================================

// DocuSign webhook
router.post('/webhooks/docusign', async (req, res) => {
  try {
    // TODO: Verify webhook signature
    // TODO: Process DocuSign events and update signature requests accordingly

    log.info('DocuSign webhook received:', req.body);
    res.status(200).json({ received: true });
  } catch (error) {
    log.error('Error processing DocuSign webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Adobe Sign webhook
router.post('/webhooks/adobe-sign', async (req, res) => {
  try {
    // TODO: Verify webhook signature
    // TODO: Process Adobe Sign events and update signature requests accordingly

    log.info('Adobe Sign webhook received:', req.body);
    res.status(200).json({ received: true });
  } catch (error) {
    log.error('Error processing Adobe Sign webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// HelloSign webhook
router.post('/webhooks/hellosign', async (req, res) => {
  try {
    // TODO: Verify webhook signature
    // TODO: Process HelloSign events and update signature requests accordingly

    log.info('HelloSign webhook received:', req.body);
    res.status(200).json({ received: true });
  } catch (error) {
    log.error('Error processing HelloSign webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
