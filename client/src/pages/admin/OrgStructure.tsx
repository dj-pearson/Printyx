/**
 * The tenant org structure (WF-R-08).
 *
 * WF-R-04 through WF-R-07 scope every list on users.manager_id, users.team_id,
 * users.primary_location_id and users.region_id. Nothing wrote any of them - the
 * admin invite set role_id and team_id and stopped - so location and region scope
 * degraded to team for every user in every tenant. This page is what fills the
 * tree, and until a tenant uses it their directors see their own team rather than
 * their region.
 *
 * Everything here goes through /api/admin, which is behind checkAdminPermission on
 * the server. The route gate is a convenience; the server is the control.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus } from 'lucide-react';

interface OrgUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  teamId?: string | null;
  managerId?: string | null;
  primaryLocationId?: string | null;
  regionId?: string | null;
}

interface Named {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean | null;
  regionId?: string | null;
  locationId?: string | null;
  managerId?: string | null;
}

interface RoleRow {
  id: string;
  name: string;
  code?: string | null;
  level?: number | null;
}

/** '' is how a Select clears a placement; the server maps it to null. */
const NONE = '__none__';
const toValue = (v: string | null | undefined) => v ?? NONE;
const fromValue = (v: string) => (v === NONE ? '' : v);

function extract<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const bag = payload as { data?: unknown; users?: unknown } | null;
  if (Array.isArray(bag?.data)) return bag.data as T[];
  if (Array.isArray(bag?.users)) return bag.users as T[];
  return [];
}

export default function OrgStructure() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => extract<OrgUser>(await apiRequest('/api/admin/users?limit=200', 'GET')),
  });
  const rolesQuery = useQuery({
    queryKey: ['/api/admin/roles'],
    queryFn: async () => extract<RoleRow>(await apiRequest('/api/admin/roles', 'GET')),
  });
  const locationsQuery = useQuery({
    queryKey: ['/api/admin/locations'],
    queryFn: async () => extract<Named>(await apiRequest('/api/admin/locations', 'GET')),
  });
  const regionsQuery = useQuery({
    queryKey: ['/api/admin/regions'],
    queryFn: async () => extract<Named>(await apiRequest('/api/admin/regions', 'GET')),
  });
  const teamsQuery = useQuery({
    queryKey: ['/api/admin/teams'],
    queryFn: async () => extract<Named>(await apiRequest('/api/admin/teams', 'GET')),
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const roles = rolesQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const regions = regionsQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  const nameOf = (u: OrgUser) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id;

  const placeUser = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      apiRequest(`/api/admin/users/${id}`, 'PATCH', patch),
    onSuccess: () => {
      // A role change rewrites the WF-R-03 claim server-side, so the level the
      // gates read moves with it on the user's next request.
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Placement saved' });
    },
    onError: (error: Error) =>
      toast({
        title: 'Could not save placement',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const createRow = useMutation({
    mutationFn: ({
      kind,
      body,
    }: {
      kind: 'locations' | 'regions' | 'teams';
      body: Record<string, unknown>;
    }) => apiRequest(`/api/admin/${kind}`, 'POST', body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.kind}`] });
      toast({ title: 'Created' });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not create', description: error.message, variant: 'destructive' }),
  });

  const inviteUser = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest('/api/admin/users', 'POST', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'Invitation sent' });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not invite', description: error.message, variant: 'destructive' }),
  });

  const loading =
    usersQuery.isLoading ||
    rolesQuery.isLoading ||
    locationsQuery.isLoading ||
    regionsQuery.isLoading ||
    teamsQuery.isLoading;

  const unplaced = useMemo(
    () => users.filter((u) => !u.primaryLocationId && !u.regionId && !u.managerId).length,
    [users],
  );

  return (
    <MainLayout
      title="Org structure"
      description="Managers, locations, regions and teams — what every list is scoped by"
    >
      <div className="space-y-6">
        {!loading && users.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Why this matters</CardTitle>
              <CardDescription>
                Record visibility is resolved from a user&apos;s manager, team, location and region.
                {unplaced > 0
                  ? ` ${unplaced} of ${users.length} people have none of them set, so their scope falls back to their own records.`
                  : ' Everyone here has at least one placement.'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Tabs defaultValue="people">
          <TabsList>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="regions">Regions</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          <TabsContent value="people" className="space-y-4">
            <InviteCard
              roles={roles}
              onInvite={(body) => inviteUser.mutate(body)}
              pending={inviteUser.isPending}
            />

            {loading ? (
              <div className="flex items-center gap-2 p-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading people…
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <Card key={u.id}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base">{nameOf(u)}</CardTitle>
                        {u.roleName && <Badge variant="secondary">{u.roleName}</Badge>}
                      </div>
                      <CardDescription>{u.email}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <PlacementSelect
                        label="Role"
                        value={u.roleId}
                        options={roles.map((r) => ({ id: r.id, name: r.name }))}
                        onChange={(v) =>
                          placeUser.mutate({ id: u.id, patch: { roleId: fromValue(v) } })
                        }
                      />
                      <PlacementSelect
                        label="Manager"
                        value={u.managerId}
                        options={users
                          .filter((o) => o.id !== u.id)
                          .map((o) => ({ id: o.id, name: nameOf(o) }))}
                        onChange={(v) =>
                          placeUser.mutate({ id: u.id, patch: { managerId: fromValue(v) } })
                        }
                      />
                      <PlacementSelect
                        label="Location"
                        value={u.primaryLocationId}
                        options={locations}
                        onChange={(v) =>
                          placeUser.mutate({ id: u.id, patch: { primaryLocationId: fromValue(v) } })
                        }
                      />
                      <PlacementSelect
                        label="Region"
                        value={u.regionId}
                        options={regions}
                        onChange={(v) =>
                          placeUser.mutate({ id: u.id, patch: { regionId: fromValue(v) } })
                        }
                      />
                      <PlacementSelect
                        label="Team"
                        value={u.teamId}
                        options={teams}
                        onChange={(v) =>
                          placeUser.mutate({ id: u.id, patch: { teamId: fromValue(v) } })
                        }
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="locations">
            <NamedRowTab
              kind="locations"
              rows={locations}
              extraField={{ label: 'Region', key: 'regionId', options: regions }}
              onCreate={(body) => createRow.mutate({ kind: 'locations', body })}
              pending={createRow.isPending}
            />
          </TabsContent>

          <TabsContent value="regions">
            <NamedRowTab
              kind="regions"
              rows={regions}
              onCreate={(body) => createRow.mutate({ kind: 'regions', body })}
              pending={createRow.isPending}
            />
          </TabsContent>

          <TabsContent value="teams">
            <NamedRowTab
              kind="teams"
              rows={teams}
              extraField={{ label: 'Location', key: 'locationId', options: locations }}
              onCreate={(body) => createRow.mutate({ kind: 'teams', body })}
              pending={createRow.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function PlacementSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={toValue(value)} onValueChange={onChange}>
        <SelectTrigger className="min-h-[44px]">
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not set</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function InviteCard({
  roles,
  onInvite,
  pending,
}: {
  roles: RoleRow[];
  onInvite: (body: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleId, setRoleId] = useState(NONE);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Invite someone</CardTitle>
        <CardDescription>They are placed below once the invitation is accepted.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-[44px]"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">First name</span>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="min-h-[44px]"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Last name</span>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="min-h-[44px]"
          />
        </label>
        <PlacementSelect
          label="Role"
          value={roleId === NONE ? null : roleId}
          options={roles.map((r) => ({ id: r.id, name: r.name }))}
          onChange={setRoleId}
        />
        <div className="flex items-end">
          <Button
            className="min-h-[44px] w-full"
            disabled={!email || pending}
            onClick={() => {
              onInvite({ email, firstName, lastName, roleId: fromValue(roleId) });
              setEmail('');
              setFirstName('');
              setLastName('');
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Invite
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NamedRowTab({
  kind,
  rows,
  extraField,
  onCreate,
  pending,
}: {
  kind: 'locations' | 'regions' | 'teams';
  rows: Named[];
  extraField?: { label: string; key: 'regionId' | 'locationId'; options: Named[] };
  onCreate: (body: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [extra, setExtra] = useState(NONE);

  // `teams` has no code column - name, department, location_id, manager_id,
  // parent_team_id, is_active and nothing else - so the field is not offered
  // rather than accepted and silently dropped.
  const hasCode = kind !== 'teams';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base capitalize">Add a {kind.slice(0, -1)}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px]"
            />
          </label>
          {hasCode && (
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Code</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-h-[44px]"
              />
            </label>
          )}
          {extraField && (
            <PlacementSelect
              label={extraField.label}
              value={extra === NONE ? null : extra}
              options={extraField.options}
              onChange={setExtra}
            />
          )}
          <div className="flex items-end">
            <Button
              className="min-h-[44px] w-full"
              disabled={!name || pending}
              onClick={() => {
                onCreate({
                  name,
                  ...(hasCode && code ? { code } : {}),
                  ...(extraField ? { [extraField.key]: fromValue(extra) || undefined } : {}),
                });
                setName('');
                setCode('');
                setExtra(NONE);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          Nothing here yet. Until at least one exists, scoping by {kind.slice(0, -1)} falls back to
          team.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{row.name}</p>
                  {row.code && <p className="text-xs text-muted-foreground">{row.code}</p>}
                </div>
                {row.isActive === false && <Badge variant="outline">Retired</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
