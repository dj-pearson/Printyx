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
  const { data: users = [] } = useOrgUsers();

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
