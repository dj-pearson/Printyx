import { Request, Response } from 'express';
import { storage } from './storage';
import { insertUserSettingsSchema } from '@shared/schema';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import { createModuleLogger } from './lib/logger';
import { getUserId, getTenantId } from './utils/auth-helpers';
import {
  gdprDataExportService,
  DATA_CATEGORIES,
  type DataCategory,
} from './services/gdpr-data-export-service';
import { gdprErasureService } from './services/gdpr-erasure-service';
import { logAuditEvent } from './security-compliance';
const log = createModuleLogger('routes-settings');

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Get user settings
export async function getUserSettings(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let settings = await storage.getUserSettings(user.id);

    // Return settings or fallback to defaults for UI
    if (!settings) {
      settings = {
        id: `settings-${user.id}`,
        userId: user.id,
        tenantId: user.tenantId || (req as any).tenantId || 'demo-tenant',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
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
    }

    res.json(settings);
  } catch (error) {
    log.error('Error fetching user settings:', error);
    res.status(500).json({ message: 'Failed to fetch user settings' });
  }
}

// Update user profile
export async function updateUserProfile(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const profileData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
    };

    const settingsData = {
      phone: req.body.phone,
      jobTitle: req.body.jobTitle,
      department: req.body.department,
      bio: req.body.bio,
      avatar: req.body.avatar,
    };

    // Update user basic info
    await storage.updateUser(user.id, profileData);

    // Update or create user settings
    await storage.updateUserSettings(user.id, settingsData);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    log.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
}

// Update user password
export async function updateUserPassword(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current user data
    const currentUser = await storage.getUserById(user.id);
    if (!currentUser || !currentUser.passwordHash) {
      return res.status(400).json({ message: 'Current password not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await storage.updateUser(user.id, { passwordHash: newPasswordHash });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    log.error('Error updating password:', error);
    res.status(500).json({ message: 'Failed to update password' });
  }
}

// Update user preferences
export async function updateUserPreferences(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const requestData = req.body;
    const validated = {
      theme: requestData.theme,
      language: requestData.language,
      timezone: requestData.timezone,
      dateFormat: requestData.dateFormat,
      timeFormat: requestData.timeFormat,
      currency: requestData.currency,
      notifications: requestData.notifications,
    };

    await storage.updateUserSettings(user.id, validated);

    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    log.error('Error updating preferences:', error);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
}

// Update accessibility settings
export async function updateAccessibilitySettings(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validated = {
      accessibility: req.body.accessibility,
    };

    await storage.updateUserSettings(user.id, validated);

    res.json({ message: 'Accessibility settings updated successfully' });
  } catch (error) {
    log.error('Error updating accessibility settings:', error);
    res.status(500).json({ message: 'Failed to update accessibility settings' });
  }
}

// Upload avatar
export async function uploadAvatar(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Update user settings with new avatar URL
    await storage.updateUserSettings(user.id, { avatar: avatarUrl });

    res.json({ url: avatarUrl });
  } catch (error) {
    log.error('Error uploading avatar:', error);
    res.status(500).json({ message: 'Failed to upload avatar' });
  }
}

// Export user data
export async function exportUserData(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);
    if (!userId || !tenantId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Comprehensive DSAR (GDPR Art. 20 portability): collect the subject's
    // personal data across every category via the shared export service rather
    // than the previous profile-only dump. Credential hashes are stripped inside
    // the service.
    const exportData = await gdprDataExportService.collectPersonalData(
      tenantId,
      'user',
      userId,
      Object.keys(DATA_CATEGORIES) as DataCategory[],
      [],
    );

    await logAuditEvent({
      tenantId,
      userId,
      action: 'SELF_SERVICE_DATA_EXPORT',
      resource: 'users',
      resourceId: userId,
      newValues: { exportedAt: new Date().toISOString() },
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sessionId: 'system',
      severity: 'high',
      category: 'data_access',
    }).catch((e) => log.error('Audit log failed for data export:', e));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="printyx-user-data.json"');
    res.json(exportData);
  } catch (error) {
    log.error('Error exporting user data:', error);
    res.status(500).json({ message: 'Failed to export user data' });
  }
}

// Delete user account (GDPR Art. 17 self-service erasure).
//
// This ANONYMIZES the account in place (clears PII, credentials and 2FA, and
// deactivates the login) via the shared erasure service, rather than hard-
// deleting the row. Anonymization is irreversible for the data subject while
// preserving referential integrity and any records the controller must retain
// for a legal obligation (Art. 17(3)(b)). It is also consistent with the
// admin-executed erasure path.
export async function deleteUserAccount(req: Request, res: Response) {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);
    if (!userId || !tenantId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Remove the user's customer assignments (relationship data, not the
    // subject's own PII) before anonymizing the account.
    await storage.deleteUserCustomerAssignments(userId).catch((e) => {
      log.error('Failed to remove user assignments during erasure:', e);
    });

    const erasure = await gdprErasureService.executeErasure(tenantId, {
      subjectType: 'user',
      subjectId: userId,
    });

    await logAuditEvent({
      tenantId,
      userId,
      action: 'SELF_SERVICE_ACCOUNT_ERASURE',
      resource: 'users',
      resourceId: userId,
      newValues: {
        rowsAnonymized: erasure.anonymized,
        totalRowsAnonymized: erasure.totalRows,
        executedAt: new Date().toISOString(),
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sessionId: 'system',
      severity: 'high',
      category: 'data_modification',
    }).catch((e) => log.error('Audit log failed for account erasure:', e));

    res.json({
      message:
        'Your account has been deactivated and your personal information has been erased. You have been signed out.',
      rowsAnonymized: erasure.anonymized,
    });
  } catch (error) {
    log.error('Error deleting user account:', error);
    res.status(500).json({ message: 'Failed to delete account' });
  }
}

// Export avatar upload middleware
export { upload };
