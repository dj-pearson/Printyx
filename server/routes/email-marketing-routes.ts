import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { ensureAuthenticated } from "../auth";
import {
  insertEmailTemplateSchema,
  insertEmailCampaignSchema,
  insertEmailSendSchema,
  insertEmailEventSchema,
  insertEmailListSchema,
  insertEmailListMemberSchema,
  insertEmailUnsubscribeSchema,
} from "@shared/schema";
import { z } from "zod";

const router = Router();

router.use(ensureAuthenticated);

async function getTenantId(req: Request): Promise<string> {
  if (!req.user?.tenant_id) {
    throw new Error("Tenant ID not found");
  }
  return req.user.tenant_id;
}

async function getUserId(req: Request): Promise<string> {
  if (!req.user?.id) {
    throw new Error("User ID not found");
  }
  return req.user.id;
}

router.get("/email-templates", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { templateType, isActive, category } = req.query;

    const filters: any = {};
    if (templateType) filters.templateType = templateType as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (category) filters.category = category as string;

    const templates = await storage.getEmailTemplates(tenantId, filters);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

router.get("/email-templates/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const template = await storage.getEmailTemplateById(id, tenantId);
    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching email template:', error);
    res.status(500).json({ error: 'Failed to fetch email template' });
  }
});

router.post("/email-templates", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const userId = await getUserId(req);

    const validatedData = insertEmailTemplateSchema.parse({
      ...req.body,
      tenantId,
      createdBy: userId,
    });

    const template = await storage.createEmailTemplate(validatedData);
    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating email template:', error);
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

router.patch("/email-templates/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const userId = await getUserId(req);
    const { id } = req.params;

    const template = await storage.updateEmailTemplate(id, tenantId, {
      ...req.body,
      lastModifiedBy: userId,
    });

    if (!template) {
      return res.status(404).json({ error: 'Email template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

router.delete("/email-templates/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    await storage.deleteEmailTemplate(id, tenantId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting email template:', error);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
});

router.get("/email-campaigns", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { status, campaignType, ownerId } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (campaignType) filters.campaignType = campaignType as string;
    if (ownerId) filters.ownerId = ownerId as string;

    const campaigns = await storage.getEmailCampaigns(tenantId, filters);
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching email campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch email campaigns' });
  }
});

router.get("/email-campaigns/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const campaign = await storage.getEmailCampaignById(id, tenantId);
    if (!campaign) {
      return res.status(404).json({ error: 'Email campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching email campaign:', error);
    res.status(500).json({ error: 'Failed to fetch email campaign' });
  }
});

router.post("/email-campaigns", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const userId = await getUserId(req);

    const validatedData = insertEmailCampaignSchema.parse({
      ...req.body,
      tenantId,
      ownerId: req.body.ownerId || userId,
      createdBy: userId,
    });

    const campaign = await storage.createEmailCampaign(validatedData);
    res.status(201).json(campaign);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating email campaign:', error);
    res.status(500).json({ error: 'Failed to create email campaign' });
  }
});

router.patch("/email-campaigns/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const campaign = await storage.updateEmailCampaign(id, tenantId, req.body);

    if (!campaign) {
      return res.status(404).json({ error: 'Email campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error updating email campaign:', error);
    res.status(500).json({ error: 'Failed to update email campaign' });
  }
});

router.delete("/email-campaigns/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    await storage.deleteEmailCampaign(id, tenantId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting email campaign:', error);
    res.status(500).json({ error: 'Failed to delete email campaign' });
  }
});

router.post("/email-campaigns/:id/refresh-metrics", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const campaign = await storage.updateCampaignMetrics(id, tenantId);

    if (!campaign) {
      return res.status(404).json({ error: 'Email campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error refreshing campaign metrics:', error);
    res.status(500).json({ error: 'Failed to refresh campaign metrics' });
  }
});

router.get("/email-campaigns/:campaignId/sends", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { campaignId } = req.params;

    const sends = await storage.getEmailSends(campaignId, tenantId);
    res.json(sends);
  } catch (error) {
    console.error('Error fetching email sends:', error);
    res.status(500).json({ error: 'Failed to fetch email sends' });
  }
});

router.get("/email-sends/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const send = await storage.getEmailSendById(id, tenantId);
    if (!send) {
      return res.status(404).json({ error: 'Email send not found' });
    }

    res.json(send);
  } catch (error) {
    console.error('Error fetching email send:', error);
    res.status(500).json({ error: 'Failed to fetch email send' });
  }
});

router.post("/email-sends", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);

    const validatedData = insertEmailSendSchema.parse({
      ...req.body,
      tenantId,
    });

    const send = await storage.createEmailSend(validatedData);
    res.status(201).json(send);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating email send:', error);
    res.status(500).json({ error: 'Failed to create email send' });
  }
});

router.post("/email-sends/bulk", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { sends } = req.body;

    if (!Array.isArray(sends)) {
      return res.status(400).json({ error: 'sends must be an array' });
    }

    const validatedSends = sends.map(send => ({
      ...send,
      tenantId,
    }));

    const createdSends = await storage.bulkCreateEmailSends(validatedSends);
    res.status(201).json(createdSends);
  } catch (error) {
    console.error('Error creating bulk email sends:', error);
    res.status(500).json({ error: 'Failed to create bulk email sends' });
  }
});

router.patch("/email-sends/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const send = await storage.updateEmailSend(id, tenantId, req.body);

    if (!send) {
      return res.status(404).json({ error: 'Email send not found' });
    }

    res.json(send);
  } catch (error) {
    console.error('Error updating email send:', error);
    res.status(500).json({ error: 'Failed to update email send' });
  }
});

router.get("/email-sends/:sendId/events", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { sendId } = req.params;

    const events = await storage.getEmailEvents(sendId, tenantId);
    res.json(events);
  } catch (error) {
    console.error('Error fetching email events:', error);
    res.status(500).json({ error: 'Failed to fetch email events' });
  }
});

router.get("/email-campaigns/:campaignId/events", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { campaignId } = req.params;
    const { eventType } = req.query;

    const filters: any = {};
    if (eventType) filters.eventType = eventType as string;

    const events = await storage.getEmailEventsByCampaign(campaignId, tenantId, filters);
    res.json(events);
  } catch (error) {
    console.error('Error fetching campaign events:', error);
    res.status(500).json({ error: 'Failed to fetch campaign events' });
  }
});

router.post("/email-events", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);

    const validatedData = insertEmailEventSchema.parse({
      ...req.body,
      tenantId,
    });

    const event = await storage.createEmailEvent(validatedData);
    res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating email event:', error);
    res.status(500).json({ error: 'Failed to create email event' });
  }
});

router.get("/email-lists", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { listType, isActive, category } = req.query;

    const filters: any = {};
    if (listType) filters.listType = listType as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (category) filters.category = category as string;

    const lists = await storage.getEmailLists(tenantId, filters);
    res.json(lists);
  } catch (error) {
    console.error('Error fetching email lists:', error);
    res.status(500).json({ error: 'Failed to fetch email lists' });
  }
});

router.get("/email-lists/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const list = await storage.getEmailListById(id, tenantId);
    if (!list) {
      return res.status(404).json({ error: 'Email list not found' });
    }

    res.json(list);
  } catch (error) {
    console.error('Error fetching email list:', error);
    res.status(500).json({ error: 'Failed to fetch email list' });
  }
});

router.post("/email-lists", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const userId = await getUserId(req);

    const validatedData = insertEmailListSchema.parse({
      ...req.body,
      tenantId,
      ownerId: req.body.ownerId || userId,
      createdBy: userId,
    });

    const list = await storage.createEmailList(validatedData);
    res.status(201).json(list);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating email list:', error);
    res.status(500).json({ error: 'Failed to create email list' });
  }
});

router.patch("/email-lists/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const list = await storage.updateEmailList(id, tenantId, req.body);

    if (!list) {
      return res.status(404).json({ error: 'Email list not found' });
    }

    res.json(list);
  } catch (error) {
    console.error('Error updating email list:', error);
    res.status(500).json({ error: 'Failed to update email list' });
  }
});

router.delete("/email-lists/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    await storage.deleteEmailList(id, tenantId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting email list:', error);
    res.status(500).json({ error: 'Failed to delete email list' });
  }
});

router.post("/email-lists/:id/refresh-counts", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const list = await storage.updateListMemberCounts(id, tenantId);

    if (!list) {
      return res.status(404).json({ error: 'Email list not found' });
    }

    res.json(list);
  } catch (error) {
    console.error('Error refreshing list counts:', error);
    res.status(500).json({ error: 'Failed to refresh list counts' });
  }
});

router.get("/email-lists/:listId/members", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { listId } = req.params;
    const { status } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;

    const members = await storage.getEmailListMembers(listId, tenantId, filters);
    res.json(members);
  } catch (error) {
    console.error('Error fetching list members:', error);
    res.status(500).json({ error: 'Failed to fetch list members' });
  }
});

router.get("/email-list-members/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const member = await storage.getEmailListMemberById(id, tenantId);
    if (!member) {
      return res.status(404).json({ error: 'List member not found' });
    }

    res.json(member);
  } catch (error) {
    console.error('Error fetching list member:', error);
    res.status(500).json({ error: 'Failed to fetch list member' });
  }
});

router.post("/email-list-members", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);

    const validatedData = insertEmailListMemberSchema.parse({
      ...req.body,
      tenantId,
    });

    const member = await storage.createEmailListMember(validatedData);
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating list member:', error);
    res.status(500).json({ error: 'Failed to create list member' });
  }
});

router.post("/email-list-members/bulk", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { members } = req.body;

    if (!Array.isArray(members)) {
      return res.status(400).json({ error: 'members must be an array' });
    }

    const validatedMembers = members.map(member => ({
      ...member,
      tenantId,
    }));

    const createdMembers = await storage.bulkCreateEmailListMembers(validatedMembers);
    res.status(201).json(createdMembers);
  } catch (error) {
    console.error('Error creating bulk list members:', error);
    res.status(500).json({ error: 'Failed to create bulk list members' });
  }
});

router.patch("/email-list-members/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    const member = await storage.updateEmailListMember(id, tenantId, req.body);

    if (!member) {
      return res.status(404).json({ error: 'List member not found' });
    }

    res.json(member);
  } catch (error) {
    console.error('Error updating list member:', error);
    res.status(500).json({ error: 'Failed to update list member' });
  }
});

router.delete("/email-list-members/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { id } = req.params;

    await storage.deleteEmailListMember(id, tenantId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting list member:', error);
    res.status(500).json({ error: 'Failed to delete list member' });
  }
});

router.get("/email-unsubscribes", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { unsubscribeType, email } = req.query;

    const filters: any = {};
    if (unsubscribeType) filters.unsubscribeType = unsubscribeType as string;
    if (email) filters.email = email as string;

    const unsubscribes = await storage.getEmailUnsubscribes(tenantId, filters);
    res.json(unsubscribes);
  } catch (error) {
    console.error('Error fetching unsubscribes:', error);
    res.status(500).json({ error: 'Failed to fetch unsubscribes' });
  }
});

router.post("/email-unsubscribes", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);

    const validatedData = insertEmailUnsubscribeSchema.parse({
      ...req.body,
      tenantId,
    });

    const unsubscribe = await storage.createEmailUnsubscribe(validatedData);
    res.status(201).json(unsubscribe);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating unsubscribe:', error);
    res.status(500).json({ error: 'Failed to create unsubscribe' });
  }
});

router.get("/email-unsubscribes/check/:email", async (req: Request, res: Response) => {
  try {
    const tenantId = await getTenantId(req);
    const { email } = req.params;

    const status = await storage.checkUnsubscribeStatus(email, tenantId);
    res.json(status);
  } catch (error) {
    console.error('Error checking unsubscribe status:', error);
    res.status(500).json({ error: 'Failed to check unsubscribe status' });
  }
});

router.post("/webhooks/sendgrid", async (req: Request, res: Response) => {
  try {
    const events = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    for (const event of events) {
      const sendgridEventType = event.event;
      const messageId = event.sg_message_id;
      
      const send = await storage.getEmailSends('', '');
      
      const eventTypeMap: Record<string, string> = {
        'delivered': 'delivered',
        'open': 'open',
        'click': 'click',
        'bounce': 'bounce',
        'dropped': 'bounce',
        'spamreport': 'spam_report',
        'unsubscribe': 'unsubscribe',
      };

      const eventType = eventTypeMap[sendgridEventType];
      if (!eventType) continue;

    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error processing SendGrid webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

export default router;
