/**
 * CR-008: remove server-controlled columns from a parsed request body so a
 * client cannot over-post them (mass assignment). Handlers add the real
 * tenantId / createdBy / etc. themselves after calling this.
 */
export function stripServerFields(obj: Record<string, unknown>): Record<string, unknown> {
  const { id, tenantId, createdBy, createdAt, updatedAt, ...rest } = obj;
  void id;
  void tenantId;
  void createdBy;
  void createdAt;
  void updatedAt;
  return rest;
}
