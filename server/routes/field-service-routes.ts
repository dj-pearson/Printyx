import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertInstallationSchema,
  insertServiceSignatureSchema,
  insertInstallationChecklistSchema,
} from "@shared/schema";

const router = Router();

  // ============================================================================
  // INSTALLATIONS
  // ============================================================================

  router.get("/installations", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status, customerId, technicianId } = req.query;

      const filters: {
        status?: string;
        customerId?: string;
        technicianId?: string;
      } = {};

      if (status && typeof status === "string") filters.status = status;
      if (customerId && typeof customerId === "string")
        filters.customerId = customerId;
      if (technicianId && typeof technicianId === "string")
        filters.technicianId = technicianId;

      const installations = await storage.getInstallations(
        req.session.user.tenantId,
        filters
      );
      res.json(installations);
    } catch (error) {
      next(error);
    }
  });

  router.get("/installations/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const installation = await storage.getInstallationById(
        req.params.id,
        req.session.user.tenantId
      );

      if (!installation) {
        return res.status(404).json({ message: "Installation not found" });
      }

      res.json(installation);
    } catch (error) {
      next(error);
    }
  });

  router.post("/installations", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId || !req.session?.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = insertInstallationSchema
        .omit({ id: true, createdAt: true, updatedAt: true })
        .safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const installationData = {
        ...validationResult.data,
        tenantId: req.session.user.tenantId,
        createdBy: req.session.user.id,
      };

      if (!installationData.installationNumber) {
        installationData.installationNumber =
          await storage.generateInstallationNumber(req.session.user.tenantId);
      }

      const installation = await storage.createInstallation(installationData);
      res.status(201).json(installation);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/installations/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = insertInstallationSchema
        .omit({ id: true, createdAt: true, updatedAt: true })
        .partial()
        .safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const updated = await storage.updateInstallation(
        req.params.id,
        req.session.user.tenantId,
        validationResult.data
      );

      if (!updated) {
        return res.status(404).json({ message: "Installation not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/installations/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.deleteInstallation(
        req.params.id,
        req.session.user.tenantId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // SERVICE SIGNATURES
  // ============================================================================

  router.get("/service-signatures", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { serviceTicketId, installationId } = req.query;

      const filters: { serviceTicketId?: string; installationId?: string } = {};

      if (serviceTicketId && typeof serviceTicketId === "string")
        filters.serviceTicketId = serviceTicketId;
      if (installationId && typeof installationId === "string")
        filters.installationId = installationId;

      const signatures = await storage.getServiceSignatures(
        req.session.user.tenantId,
        filters
      );
      res.json(signatures);
    } catch (error) {
      next(error);
    }
  });

  router.get("/service-signatures/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const signature = await storage.getServiceSignatureById(
        req.params.id,
        req.session.user.tenantId
      );

      if (!signature) {
        return res.status(404).json({ message: "Signature not found" });
      }

      res.json(signature);
    } catch (error) {
      next(error);
    }
  });

  router.post("/service-signatures", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId || !req.session?.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = insertServiceSignatureSchema
        .omit({ id: true, createdAt: true, updatedAt: true })
        .safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const signatureData = {
        ...validationResult.data,
        tenantId: req.session.user.tenantId,
        capturedBy: req.session.user.id,
      };

      const signature = await storage.createServiceSignature(signatureData);
      res.status(201).json(signature);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/service-signatures/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = insertServiceSignatureSchema
        .omit({ id: true, createdAt: true, updatedAt: true })
        .partial()
        .safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const updated = await storage.updateServiceSignature(
        req.params.id,
        req.session.user.tenantId,
        validationResult.data
      );

      if (!updated) {
        return res.status(404).json({ message: "Signature not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/service-signatures/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.deleteServiceSignature(
        req.params.id,
        req.session.user.tenantId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // INSTALLATION CHECKLISTS
  // ============================================================================

  router.get("/installations/:installationId/checklists", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const checklists = await storage.getInstallationChecklists(
        req.params.installationId,
        req.session.user.tenantId
      );
      res.json(checklists);
    } catch (error) {
      next(error);
    }
  });

  router.get("/installation-checklists/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const checklist = await storage.getInstallationChecklistById(
        req.params.id,
        req.session.user.tenantId
      );

      if (!checklist) {
        return res.status(404).json({ message: "Checklist item not found" });
      }

      res.json(checklist);
    } catch (error) {
      next(error);
    }
  });

  router.post("/installation-checklists", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId || !req.session?.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = insertInstallationChecklistSchema
        .omit({ id: true, createdAt: true, updatedAt: true })
        .safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const checklistData = {
        ...validationResult.data,
        tenantId: req.session.user.tenantId,
      };

      const checklist = await storage.createInstallationChecklist(
        checklistData
      );
      res.status(201).json(checklist);
    } catch (error) {
      next(error);
    }
  });

  router.post("/installation-checklists/bulk", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const bulkSchema = z.array(
        insertInstallationChecklistSchema.omit({
          id: true,
          createdAt: true,
          updatedAt: true,
        })
      );

      const validationResult = bulkSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const checklistsData = validationResult.data.map((item) => ({
        ...item,
        tenantId: req.session.user!.tenantId,
      }));

      const checklists = await storage.bulkCreateInstallationChecklists(
        checklistsData
      );
      res.status(201).json(checklists);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/installation-checklists/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = insertInstallationChecklistSchema
        .omit({ id: true, createdAt: true, updatedAt: true })
        .partial()
        .safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors,
        });
      }

      const updated = await storage.updateInstallationChecklist(
        req.params.id,
        req.session.user.tenantId,
        validationResult.data
      );

      if (!updated) {
        return res.status(404).json({ message: "Checklist item not found" });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/installation-checklists/:id", async (req, res, next) => {
    try {
      if (!req.session?.user?.tenantId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.deleteInstallationChecklist(
        req.params.id,
        req.session.user.tenantId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

export default router;
