# Knowledge Base Admin - RBAC Security Implementation

## Overview

The Knowledge Base Admin system implements comprehensive Role-Based Access Control (RBAC) to ensure only authorized users can access and modify knowledge base content.

## Role Hierarchy

### 8-Level Role System

| Level | Role Name | KB Admin Permissions |
|-------|-----------|---------------------|
| **8** | Platform Administrator | Full platform-level access |
| **7** | Company Executive / Root Admin | **Full KB Admin Access** |
| **6** | Company Director | **Full KB Admin Access** |
| **5** | System Administrator | **KB Admin Dashboard & Operations** |
| **4** | Department Manager | Analytics view only |
| **3** | Team Manager | Analytics view only |
| **2** | Standard User | No KB admin access |
| **1** | Guest / Read-Only | No KB admin access |

## Access Control Matrix

### Knowledge Base Admin Routes

| Endpoint | Method | Min Role Level | Role Name | Reason |
|----------|--------|----------------|-----------|--------|
| `/dashboard` | GET | 5 | System Admin | View admin statistics |
| `/articles/bulk-update` | POST | 5 | System Admin | Modify multiple articles |
| `/articles/bulk-delete` | DELETE | **7** | **Root Admin** | **Destructive operation** |
| `/feedback/pending` | GET | 5 | System Admin | View user feedback |
| `/feedback/:id/resolve` | PUT | 5 | System Admin | Resolve feedback |
| `/ai-queue` | GET | 5 | System Admin | View AI generation queue |
| `/ai-queue/:id/retry` | POST | 5 | System Admin | Retry AI operations |
| `/articles/:id/versions` | GET | 5 | System Admin | View version history |
| `/articles/:id/restore-version` | POST | 5 | System Admin | Restore previous versions |
| `/import` | POST | **7** | **Root Admin** | **Bulk import articles** |
| `/export` | GET | **7** | **Root Admin** | **Export sensitive data** |
| `/analytics/detailed` | GET | 3 | Manager | Read-only analytics |
| `/categories/reorder` | POST | 5 | System Admin | Modify category structure |

### Key Security Decisions

**Root Admin Only (Level 7+):**
- ❌ **Bulk Delete**: Permanent data loss requires highest privilege
- ❌ **Import**: Can create/modify many articles at once
- ❌ **Export**: Contains potentially sensitive content and metadata

**System Admin (Level 5+):**
- ✅ **Dashboard**: Non-destructive read access to statistics
- ✅ **Bulk Update**: Modify existing articles (non-destructive)
- ✅ **Feedback Management**: Customer service function
- ✅ **AI Queue**: Monitor and manage content generation
- ✅ **Version Control**: Restore and review changes

**Manager (Level 3+):**
- ✅ **Analytics**: Read-only reporting and metrics

## Middleware Implementation

### File: `server/routes/knowledge-base-admin-routes.ts`

```typescript
import { requireRootAdmin } from '../routes-root-admin';
import { requireRole } from '../rbac-middleware';

// System Admin (Level 5+)
const requireSystemAdmin = requireRole(5);

// Manager (Level 3+)
const requireManager = requireRole(3);

// Example usage:
router.delete('/articles/bulk-delete',
  requireAuth,           // Check authentication
  requireRootAdmin,      // Check role level 7+
  async (req, res) => {
    // Handler code
  }
);
```

### Authentication Flow

```
1. Request → requireAuth middleware
   ↓
2. Check session/token exists
   ↓
3. Extract userId from session
   ↓
4. requireRole/requireRootAdmin middleware
   ↓
5. Query database for user's role
   ↓
6. Check role level >= required level
   ↓
7. Allow/Deny access
   ↓
8. Add role context to req.user
   ↓
9. Continue to route handler
```

## Security Features

### 1. Multi-Layer Protection

**Layer 1: Authentication**
- Session-based authentication
- Token validation
- User must be logged in

**Layer 2: Authorization**
- Role level checking
- Department-based access (if applicable)
- Tenant isolation

**Layer 3: Audit Logging**
- All admin actions logged
- User ID and role recorded
- Timestamp and action type

### 2. Tenant Isolation

Every admin operation includes tenant context:

```typescript
const tenantId = (req as any).tenantId;

// All database queries filter by tenant
await db.query.knowledgeArticles.findMany({
  where: eq(knowledgeArticles.tenantId, tenantId)
});
```

### 3. Error Handling

**Unauthorized (401):**
```json
{
  "message": "Authentication required"
}
```

**Forbidden (403):**
```json
{
  "message": "Access denied - Requires level 5 or higher"
}
```

**Root Admin Required (403):**
```json
{
  "message": "Root admin access required - insufficient privileges"
}
```

## CLI Tool Security

The CLI tool bypasses RBAC as it requires direct server access. Security considerations:

**Physical Security:**
- CLI requires server shell access
- Only available to infrastructure administrators
- Not exposed via web interface

**Recommendations:**
- Restrict SSH access to server
- Use sudo/privilege escalation
- Audit CLI usage via system logs

**Tenant Parameter:**
```bash
# Explicitly require tenant ID to prevent cross-tenant operations
npm run kb -- delete --tenant REQUIRED --id article-123
```

## Chrome Extension Security

**No Direct RBAC:**
The Chrome extension uses API tokens with embedded role information.

**Security Measures:**
1. **API Token Authentication**: User provides token with role embedded
2. **Server-Side Validation**: All API calls validate role on server
3. **Token Expiration**: Tokens expire after configured time
4. **Tenant Scoping**: Extension can only access assigned tenant

**User Responsibility:**
- Users must not share API tokens
- Tokens should be regenerated periodically
- Revoke tokens for ex-employees

## Admin UI Security

**Route Protection:**
```typescript
// In React Router or navigation guard
if (user.roleLevel < 3) {
  redirect('/unauthorized');
}

// Show/hide UI elements based on role
{user.roleLevel >= 5 && (
  <Button onClick={handleBulkUpdate}>
    Bulk Update
  </Button>
)}

{user.roleLevel >= 7 && (
  <Button onClick={handleExport}>
    Export All
  </Button>
)}
```

## Audit Trail

All admin operations are audited:

### Logged Information

```typescript
{
  timestamp: "2025-11-25T10:30:00Z",
  userId: "user-uuid",
  userEmail: "admin@example.com",
  roleLevel: 7,
  roleName: "Root Admin",
  action: "KB_BULK_DELETE",
  tenantId: "tenant-uuid",
  resource: "knowledge_articles",
  resourceIds: ["article-1", "article-2"],
  ipAddress: "192.168.1.100",
  userAgent: "Chrome/120.0",
  success: true
}
```

### Audit Log Location

- **File**: `server/audit.log`
- **Retention**: 90 days (configurable)
- **Format**: JSON lines (JSONL)

## Testing RBAC

### Manual Testing

```bash
# 1. Test as Manager (Level 3)
# Should succeed:
curl -X GET http://localhost:5000/api/admin/knowledge-base/analytics/detailed \
  -H "Cookie: session=manager-session"

# Should fail:
curl -X GET http://localhost:5000/api/admin/knowledge-base/dashboard \
  -H "Cookie: session=manager-session"
# Expected: 403 Forbidden

# 2. Test as System Admin (Level 5)
# Should succeed:
curl -X GET http://localhost:5000/api/admin/knowledge-base/dashboard \
  -H "Cookie: session=sysadmin-session"

# Should fail:
curl -X DELETE http://localhost:5000/api/admin/knowledge-base/articles/bulk-delete \
  -H "Cookie: session=sysadmin-session"
# Expected: 403 Forbidden

# 3. Test as Root Admin (Level 7)
# Should succeed:
curl -X DELETE http://localhost:5000/api/admin/knowledge-base/articles/bulk-delete \
  -H "Cookie: session=rootadmin-session" \
  -d '{"articleIds":["test-id"]}'
# Expected: 200 OK
```

### Automated Testing

```typescript
describe('KB Admin RBAC', () => {
  it('should deny Manager access to dashboard', async () => {
    const response = await request(app)
      .get('/api/admin/knowledge-base/dashboard')
      .set('Cookie', managerSession);

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('level 5');
  });

  it('should allow System Admin dashboard access', async () => {
    const response = await request(app)
      .get('/api/admin/knowledge-base/dashboard')
      .set('Cookie', sysAdminSession);

    expect(response.status).toBe(200);
  });

  it('should deny System Admin bulk delete', async () => {
    const response = await request(app)
      .delete('/api/admin/knowledge-base/articles/bulk-delete')
      .set('Cookie', sysAdminSession);

    expect(response.status).toBe(403);
  });

  it('should allow Root Admin bulk delete', async () => {
    const response = await request(app)
      .delete('/api/admin/knowledge-base/articles/bulk-delete')
      .set('Cookie', rootAdminSession);

    expect(response.status).toBe(200);
  });
});
```

## Best Practices

### 1. Principle of Least Privilege

- Grant minimum required access level
- Regularly review role assignments
- Remove access when no longer needed

### 2. Separation of Duties

- Different roles for different functions
- Managers can view but not modify
- System Admins can modify but not delete bulk
- Root Admins can perform destructive operations

### 3. Regular Audits

- Review audit logs weekly
- Check for suspicious activity
- Verify role assignments quarterly

### 4. Token Management

- Rotate API tokens every 90 days
- Revoke tokens for inactive users
- Monitor token usage patterns

### 5. Documentation

- Document all role changes
- Maintain list of users by role
- Update documentation when adding endpoints

## Security Checklist

Before deploying to production:

- [ ] All admin routes have RBAC middleware
- [ ] No hardcoded credentials in code
- [ ] Audit logging enabled
- [ ] Rate limiting configured
- [ ] HTTPS enforced
- [ ] CSRF protection enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (using ORM)
- [ ] XSS protection (Content-Security-Policy)
- [ ] Session timeout configured
- [ ] Token expiration set
- [ ] Backup procedures documented
- [ ] Incident response plan ready

## Troubleshooting

### "Access Denied" Errors

**Problem:** User gets 403 Forbidden

**Check:**
1. Verify user's role level: `SELECT level FROM roles r JOIN users u ON u.roleId = r.id WHERE u.id = ?`
2. Check required role level in route definition
3. Verify session is active
4. Confirm tenant context is correct

### Audit Log Not Recording

**Problem:** Actions not appearing in audit.log

**Check:**
1. Verify audit middleware is active
2. Check file permissions on `server/audit.log`
3. Ensure disk space available
4. Review error logs for write failures

### CLI Bypassing RBAC

**Expected Behavior:** CLI has full access

**Reason:** Direct server access implies physical/infrastructure admin

**Mitigation:**
- Restrict server SSH access
- Use sudo for CLI commands
- Monitor system logs

## Future Enhancements

1. **Multi-Factor Authentication (MFA)**
   - Require MFA for Root Admin actions
   - TOTP or hardware key support

2. **IP Whitelisting**
   - Restrict admin access by IP range
   - Corporate VPN requirement

3. **Time-Based Access**
   - Temporary elevated privileges
   - Scheduled role grants

4. **Approval Workflows**
   - Require approval for bulk deletes
   - Multi-person authorization

5. **Real-Time Alerting**
   - Notify on sensitive operations
   - Slack/email integration

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
**Security Level**: Production-Ready
