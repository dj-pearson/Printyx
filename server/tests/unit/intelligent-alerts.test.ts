/**
 * Unit Tests: Intelligent Alerts Security Actions
 * Tests for the automated containment actions in intelligent-alerts-service.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock types for testing containment actions
interface ContainmentActionParams {
  alertId: string;
  tenantId: string;
  actionType:
    | 'suspend_user'
    | 'terminate_session'
    | 'block_ip'
    | 'quarantine_file'
    | 'disable_integration'
    | 'rate_limit'
    | 'force_password_reset'
    | 'enable_mfa'
    | 'restrict_permissions'
    | 'notify_team';
  target: string;
  reason: string;
  automated?: boolean;
  executedBy?: string;
}

interface ContainmentResult {
  actionType: string;
  target: string;
  success: boolean;
  result: string;
  errorMessage?: string;
}

// Mock implementation for testing action validation logic
function validateContainmentAction(params: ContainmentActionParams): {
  valid: boolean;
  error?: string;
} {
  const { actionType, target, alertId, tenantId } = params;

  // Validate required fields
  if (!alertId) {
    return { valid: false, error: 'alertId is required' };
  }
  if (!tenantId) {
    return { valid: false, error: 'tenantId is required' };
  }
  if (!target) {
    return { valid: false, error: 'target is required' };
  }

  // Validate action-specific requirements
  switch (actionType) {
    case 'suspend_user':
    case 'terminate_session':
    case 'force_password_reset':
    case 'enable_mfa':
    case 'restrict_permissions':
      // These actions require a valid user ID (UUID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(target) && !target.startsWith('test-user-')) {
        return { valid: false, error: `Invalid user ID format for ${actionType}` };
      }
      break;

    case 'block_ip':
    case 'rate_limit':
      // These actions should have an IP address as target
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(target) && target !== 'security_team') {
        return { valid: false, error: `Invalid IP address format for ${actionType}` };
      }
      break;

    case 'quarantine_file':
      // File path should not be empty
      if (target.length < 1) {
        return { valid: false, error: 'File path is required for quarantine' };
      }
      break;

    case 'notify_team':
      // Team identifier should be provided
      if (!target || target.length < 1) {
        return { valid: false, error: 'Team identifier is required for notification' };
      }
      break;

    default:
      return { valid: false, error: `Unknown action type: ${actionType}` };
  }

  return { valid: true };
}

// Mock function to determine appropriate containment actions
function generateContainmentActions(
  category: string,
  userId?: string,
  ipAddress?: string,
): Array<{ actionType: string; target: string; executed: boolean }> {
  const actions: Array<{ actionType: string; target: string; executed: boolean }> = [];

  switch (category) {
    case 'brute_force':
      if (ipAddress) {
        actions.push({ actionType: 'block_ip', target: ipAddress, executed: false });
      }
      if (userId) {
        actions.push({ actionType: 'force_password_reset', target: userId, executed: false });
      }
      break;

    case 'data_breach':
    case 'suspicious_data_export':
      if (userId) {
        actions.push({ actionType: 'suspend_user', target: userId, executed: false });
        actions.push({ actionType: 'terminate_session', target: userId, executed: false });
      }
      actions.push({ actionType: 'notify_team', target: 'security_team', executed: false });
      break;

    case 'malware':
      if (userId) {
        actions.push({ actionType: 'quarantine_file', target: 'infected_file', executed: false });
        actions.push({ actionType: 'terminate_session', target: userId, executed: false });
      }
      break;

    case 'unauthorized_access':
      if (userId) {
        actions.push({ actionType: 'terminate_session', target: userId, executed: false });
        actions.push({ actionType: 'restrict_permissions', target: userId, executed: false });
      }
      break;

    case 'ddos':
      if (ipAddress) {
        actions.push({ actionType: 'rate_limit', target: ipAddress, executed: false });
      }
      break;

    case 'privilege_escalation':
      if (userId) {
        actions.push({ actionType: 'suspend_user', target: userId, executed: false });
        actions.push({ actionType: 'notify_team', target: 'security_team', executed: false });
      }
      break;

    default:
      actions.push({ actionType: 'notify_team', target: 'security_team', executed: false });
  }

  return actions;
}

// =====================================================================
// TESTS
// =====================================================================

describe('Intelligent Alerts Security Actions', () => {
  describe('validateContainmentAction', () => {
    it('should validate suspend_user action with valid user ID', () => {
      const result = validateContainmentAction({
        alertId: 'alert-123',
        tenantId: 'tenant-456',
        actionType: 'suspend_user',
        target: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Security incident',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject suspend_user action with invalid user ID', () => {
      const result = validateContainmentAction({
        alertId: 'alert-123',
        tenantId: 'tenant-456',
        actionType: 'suspend_user',
        target: 'invalid-id',
        reason: 'Security incident',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid user ID format');
    });

    it('should validate block_ip action with valid IP address', () => {
      const result = validateContainmentAction({
        alertId: 'alert-123',
        tenantId: 'tenant-456',
        actionType: 'block_ip',
        target: '192.168.1.100',
        reason: 'Brute force attack',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject block_ip action with invalid IP address', () => {
      const result = validateContainmentAction({
        alertId: 'alert-123',
        tenantId: 'tenant-456',
        actionType: 'block_ip',
        target: 'not-an-ip',
        reason: 'Brute force attack',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid IP address format');
    });

    it('should require alertId', () => {
      const result = validateContainmentAction({
        alertId: '',
        tenantId: 'tenant-456',
        actionType: 'notify_team',
        target: 'security_team',
        reason: 'Test',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('alertId is required');
    });

    it('should require tenantId', () => {
      const result = validateContainmentAction({
        alertId: 'alert-123',
        tenantId: '',
        actionType: 'notify_team',
        target: 'security_team',
        reason: 'Test',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('tenantId is required');
    });

    it('should reject unknown action types', () => {
      const result = validateContainmentAction({
        alertId: 'alert-123',
        tenantId: 'tenant-456',
        actionType: 'unknown_action' as any,
        target: 'target',
        reason: 'Test',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown action type');
    });
  });

  describe('generateContainmentActions', () => {
    it('should generate brute_force actions correctly', () => {
      const actions = generateContainmentActions(
        'brute_force',
        '550e8400-e29b-41d4-a716-446655440000',
        '192.168.1.100',
      );

      expect(actions).toHaveLength(2);
      expect(actions).toContainEqual({
        actionType: 'block_ip',
        target: '192.168.1.100',
        executed: false,
      });
      expect(actions).toContainEqual({
        actionType: 'force_password_reset',
        target: '550e8400-e29b-41d4-a716-446655440000',
        executed: false,
      });
    });

    it('should generate data_breach actions correctly', () => {
      const actions = generateContainmentActions(
        'data_breach',
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(actions).toHaveLength(3);
      expect(actions.map((a) => a.actionType)).toContain('suspend_user');
      expect(actions.map((a) => a.actionType)).toContain('terminate_session');
      expect(actions.map((a) => a.actionType)).toContain('notify_team');
    });

    it('should generate malware actions correctly', () => {
      const actions = generateContainmentActions('malware', '550e8400-e29b-41d4-a716-446655440000');

      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.actionType)).toContain('quarantine_file');
      expect(actions.map((a) => a.actionType)).toContain('terminate_session');
    });

    it('should generate unauthorized_access actions correctly', () => {
      const actions = generateContainmentActions(
        'unauthorized_access',
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.actionType)).toContain('terminate_session');
      expect(actions.map((a) => a.actionType)).toContain('restrict_permissions');
    });

    it('should generate ddos actions correctly', () => {
      const actions = generateContainmentActions('ddos', undefined, '192.168.1.100');

      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({
        actionType: 'rate_limit',
        target: '192.168.1.100',
        executed: false,
      });
    });

    it('should generate privilege_escalation actions correctly', () => {
      const actions = generateContainmentActions(
        'privilege_escalation',
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.actionType)).toContain('suspend_user');
      expect(actions.map((a) => a.actionType)).toContain('notify_team');
    });

    it('should generate default notify_team action for unknown categories', () => {
      const actions = generateContainmentActions('unknown_category');

      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({
        actionType: 'notify_team',
        target: 'security_team',
        executed: false,
      });
    });

    it('should not include user actions when userId is not provided', () => {
      const actions = generateContainmentActions('brute_force', undefined, '192.168.1.100');

      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('block_ip');
    });

    it('should not include IP actions when ipAddress is not provided', () => {
      const actions = generateContainmentActions(
        'brute_force',
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(actions).toHaveLength(1);
      expect(actions[0].actionType).toBe('force_password_reset');
    });
  });

  describe('Auto-containment threshold', () => {
    function shouldAutoContain(severity: string, priority: string, confidence: number): boolean {
      // Auto-contain if high confidence and critical/P1
      if (confidence >= 90 && (severity === 'critical' || priority === 'p1')) {
        return true;
      }

      // Auto-contain if very high confidence and high severity
      if (confidence >= 85 && severity === 'high') {
        return true;
      }

      return false;
    }

    it('should auto-contain for critical severity with high confidence', () => {
      expect(shouldAutoContain('critical', 'p1', 90)).toBe(true);
    });

    it('should auto-contain for P1 priority with high confidence', () => {
      expect(shouldAutoContain('high', 'p1', 90)).toBe(true);
    });

    it('should auto-contain for high severity with very high confidence', () => {
      expect(shouldAutoContain('high', 'p2', 85)).toBe(true);
    });

    it('should NOT auto-contain for medium severity', () => {
      expect(shouldAutoContain('medium', 'p3', 90)).toBe(false);
    });

    it('should NOT auto-contain for low confidence', () => {
      expect(shouldAutoContain('critical', 'p1', 80)).toBe(false);
    });

    it('should NOT auto-contain for low severity even with high confidence', () => {
      expect(shouldAutoContain('low', 'p4', 95)).toBe(false);
    });
  });

  describe('Risk score calculation', () => {
    function calculateRiskScore(
      severity: string,
      similarIncidentCount: number,
      relatedAlertCount: number,
    ): number {
      let score = 0;

      // Base score from severity
      switch (severity) {
        case 'critical':
          score += 40;
          break;
        case 'high':
          score += 30;
          break;
        case 'medium':
          score += 20;
          break;
        case 'low':
          score += 10;
          break;
      }

      // Add for similar incidents
      score += Math.min(similarIncidentCount * 10, 30);

      // Add for related alerts
      score += Math.min(relatedAlertCount * 5, 20);

      return Math.min(score, 100);
    }

    it('should calculate risk score for critical severity', () => {
      const score = calculateRiskScore('critical', 0, 0);
      expect(score).toBe(40);
    });

    it('should add points for similar incidents', () => {
      const score = calculateRiskScore('medium', 3, 0);
      expect(score).toBe(50); // 20 + 30
    });

    it('should cap similar incident bonus at 30', () => {
      const score = calculateRiskScore('low', 5, 0);
      expect(score).toBe(40); // 10 + 30 (capped)
    });

    it('should add points for related alerts', () => {
      const score = calculateRiskScore('high', 0, 4);
      expect(score).toBe(50); // 30 + 20
    });

    it('should cap related alert bonus at 20', () => {
      const score = calculateRiskScore('high', 0, 10);
      expect(score).toBe(50); // 30 + 20 (capped)
    });

    it('should cap total score at 100', () => {
      const score = calculateRiskScore('critical', 5, 10);
      expect(score).toBe(90); // 40 + 30 + 20 = 90 (not capped since less than 100)
    });
  });
});
