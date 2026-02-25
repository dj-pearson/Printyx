/**
 * Collaboration Indicator
 *
 * FN-007: Real-time collaboration indicators showing who else is viewing/editing
 * the same record. Prevents conflicts by warning users when edits overlap.
 */

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Edit3, AlertCircle } from 'lucide-react';

export interface CollaboratorInfo {
  userId: string;
  name: string;
  avatar?: string;
  mode: 'viewing' | 'editing';
  since: string;
}

interface CollaborationIndicatorProps {
  entityType: string;
  entityId: string;
  collaborators: CollaboratorInfo[];
  currentUserId: string;
}

export function CollaborationIndicator({
  collaborators,
  currentUserId,
}: CollaborationIndicatorProps) {
  const others = collaborators.filter((c) => c.userId !== currentUserId);
  const editingUsers = others.filter((c) => c.mode === 'editing');
  const viewingUsers = others.filter((c) => c.mode === 'viewing');

  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Editing conflict warning */}
      {editingUsers.length > 0 && (
        <Badge variant="destructive" className="gap-1 text-xs animate-pulse">
          <AlertCircle className="h-3 w-3" />
          {editingUsers.length === 1
            ? `${editingUsers[0].name} is editing`
            : `${editingUsers.length} others editing`}
        </Badge>
      )}

      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {others.slice(0, 5).map((collab) => (
          <Tooltip key={collab.userId}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className="h-7 w-7 border-2 border-white">
                  <AvatarFallback
                    className={`text-xs ${collab.mode === 'editing' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}
                  >
                    {collab.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white flex items-center justify-center ${
                    collab.mode === 'editing' ? 'bg-orange-500' : 'bg-blue-500'
                  }`}
                >
                  {collab.mode === 'editing' ? (
                    <Edit3 className="h-1.5 w-1.5 text-white" />
                  ) : (
                    <Eye className="h-1.5 w-1.5 text-white" />
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {collab.name} ({collab.mode === 'editing' ? 'editing' : 'viewing'})
            </TooltipContent>
          </Tooltip>
        ))}
        {others.length > 5 && (
          <div className="h-7 w-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-600">
            +{others.length - 5}
          </div>
        )}
      </div>

      {/* Viewing count */}
      {viewingUsers.length > 0 && editingUsers.length === 0 && (
        <span className="text-xs text-gray-500">
          {viewingUsers.length} {viewingUsers.length === 1 ? 'viewer' : 'viewers'}
        </span>
      )}
    </div>
  );
}
