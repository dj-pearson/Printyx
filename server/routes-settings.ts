import { Request, Response } from "express";
import { storage } from "./storage";
import { insertUserSettingsSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
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
  }
});

// Get user settings
export async function getUserSettings(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let settings = await storage.getUserSettings(user.id);
    
    // Return settings or fallback to defaults for UI
    if (!settings) {
      settings = {
        id: `settings-${user.id}`,
        userId: user.id,
        tenantId: user.tenantId || '550e8400-e29b-41d4-a716-446655440000',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        theme: "system",
        language: "en",
        timezone: "America/New_York",
        dateFormat: "MM/dd/yyyy",
        timeFormat: "12",
        currency: "USD",
        notifications: {
          email: true,
          push: true,
          sms: false,
          marketing: false,
        },
        accessibility: {
          highContrast: false,
          reducedMotion: false,
          fontSize: "medium",
          screenReader: false,
          keyboardNavigation: false,
          colorBlind: "none",
          soundEnabled: true,
          voiceCommands: false,
        },
        twoFactorEnabled: false,
      };
    }
    
    res.json(settings);
  } catch (error) {
    console.error("Error fetching user settings:", error);
    res.status(500).json({ message: "Failed to fetch user settings" });
  }
}

// Update user profile
export async function updateUserProfile(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
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

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
}

// Update user password
export async function updateUserPassword(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current user data
    const currentUser = await storage.getUserById(user.id);
    if (!currentUser || !currentUser.passwordHash) {
      return res.status(400).json({ message: "Current password not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await storage.updateUser(user.id, { passwordHash: newPasswordHash });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
}

// Update user preferences
export async function updateUserPreferences(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
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

    res.json({ message: "Preferences updated successfully" });
  } catch (error) {
    console.error("Error updating preferences:", error);
    res.status(500).json({ message: "Failed to update preferences" });
  }
}

// Update accessibility settings
export async function updateAccessibilitySettings(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validated = {
      accessibility: req.body.accessibility,
    };

    await storage.updateUserSettings(user.id, validated);

    res.json({ message: "Accessibility settings updated successfully" });
  } catch (error) {
    console.error("Error updating accessibility settings:", error);
    res.status(500).json({ message: "Failed to update accessibility settings" });
  }
}

// Upload avatar
export async function uploadAvatar(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    // Update user settings with new avatar URL
    await storage.updateUserSettings(user.id, { avatar: avatarUrl });

    res.json({ url: avatarUrl });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    res.status(500).json({ message: "Failed to upload avatar" });
  }
}

// Export user data
export async function exportUserData(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Gather all user-related data
    const userData = await storage.getUserById(user.id);
    const userSettings = await storage.getUserSettings(user.id);
    const userAssignments = await storage.getUserCustomerAssignments(user.id);

    const exportData = {
      profile: {
        id: userData?.id,
        email: userData?.email,
        firstName: userData?.firstName,
        lastName: userData?.lastName,
        profileImageUrl: userData?.profileImageUrl,
        createdAt: userData?.createdAt,
      },
      settings: userSettings,
      assignments: userAssignments,
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="printyx-user-data.json"');
    res.json(exportData);
  } catch (error) {
    console.error("Error exporting user data:", error);
    res.status(500).json({ message: "Failed to export user data" });
  }
}

// Delete user account
export async function deleteUserAccount(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Delete user settings first (due to foreign key constraint)
    await storage.deleteUserSettings(user.id);
    
    // Delete user assignments
    await storage.deleteUserCustomerAssignments(user.id);
    
    // Finally delete the user
    await storage.deleteUser(user.id);

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting user account:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
}

// Export avatar upload middleware
export { upload };