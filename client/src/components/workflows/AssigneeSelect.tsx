/**
 * AssigneeSelect — pick a tenant user (or leave unassigned) for a workflow step.
 * Sources users from /api/users, the same endpoint the Task Hub uses.
 */
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { type OrgUser, userInitials, userLabel } from '@/lib/workflows/types';

const UNASSIGNED = '__unassigned__';

interface AssigneeSelectProps {
  value: string | null | undefined;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function useOrgUsers() {
  return useQuery<OrgUser[]>({
    queryKey: ['/api/users'],
    queryFn: async () => apiRequest('/api/users'),
    staleTime: 5 * 60 * 1000,
  });
}

export function AssigneeSelect({
  value,
  onChange,
  placeholder = 'Unassigned',
  disabled,
  className,
}: AssigneeSelectProps) {
  // CR-033: a failed /api/users left this dropdown holding nothing but
  // "Unassigned", which is indistinguishable from a tenant that genuinely has no
  // other users — so a workflow step silently could not be assigned and nothing
  // said why. A picker cannot show a full-width error panel, so the state is
  // reported as a row inside the list, where the user is already looking.
  const usersQuery = useOrgUsers();
  const users = usersQuery.data ?? [];

  return (
    <Select
      value={value || UNASSIGNED}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className} data-testid="select-assignee">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {usersQuery.isLoading && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading users…</div>
        )}
        {usersQuery.isError && (
          <div className="px-2 py-1.5 text-sm text-destructive">
            Could not load users.{' '}
            <button type="button" className="underline" onClick={() => void usersQuery.refetch()}>
              Retry
            </button>
          </div>
        )}
        {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No other users in this organization
          </div>
        )}
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            <span className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">{userInitials(u)}</AvatarFallback>
              </Avatar>
              {userLabel(u)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
