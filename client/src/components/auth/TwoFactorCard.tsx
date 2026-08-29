/**
 * Two-factor authentication, in Settings.
 *
 * There was a card here holding a <Switch checked={userSettings?.twoFactorEnabled}>
 * with no onCheckedChange - a security control that rendered a state it could
 * not change. Behind it sat a complete MFA implementation nothing called:
 * supabase/functions/mfa/ (700 lines - TOTP enrolment, backup codes, email and
 * SMS OTP, admin reset, a compliance report) plus a registered Express router,
 * and no client tree naming /api/mfa anywhere. This is the enrolment surface
 * for it.
 *
 * Two notes on what it does. Turning MFA off and regenerating backup codes both
 * send a current code, because those endpoints now require one (SEC-MFA-001) -
 * a valid session alone used to be enough to switch the second factor off. And
 * the QR image loads lazily and is optional: `qrcode` is a server-side
 * dependency in this repo, so if it will not load in the browser the dialog
 * falls back to the secret and the otpauth URI, both of which every
 * authenticator accepts by hand.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MfaStatus {
  enrolled: boolean;
  methods: string[];
  primary: string | null;
}

type Stage = 'closed' | 'enrolling' | 'codes' | 'disabling' | 'regenerating';

export function TwoFactorCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState<Stage>('closed');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const { data: status, isLoading } = useQuery<MfaStatus>({
    queryKey: ['/api/mfa/status'],
    queryFn: () => apiRequest('/api/mfa/status'),
  });

  const { data: codeCount } = useQuery<{ remaining: number }>({
    queryKey: ['/api/mfa/backup-codes/count'],
    queryFn: () => apiRequest('/api/mfa/backup-codes/count'),
    enabled: Boolean(status?.enrolled),
  });

  const reset = () => {
    setStage('closed');
    setSecret('');
    setOtpauthUrl('');
    setQrDataUrl('');
    setCode('');
    setBackupCodes([]);
  };

  const refreshStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/mfa/status'] });
    queryClient.invalidateQueries({ queryKey: ['/api/mfa/backup-codes/count'] });
  };

  const fail = (title: string) => (err: Error) =>
    toast({ title, description: err.message, variant: 'destructive' });

  const beginEnrolment = useMutation({
    mutationFn: () => apiRequest('/api/mfa/enroll/init', 'POST', {}),
    onSuccess: async (data: { secret: string; otpauthUrl: string }) => {
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setStage('enrolling');
      try {
        const qrcode = await import('qrcode');
        setQrDataUrl(await qrcode.default.toDataURL(data.otpauthUrl));
      } catch {
        // Manual entry below is the fallback; there is nothing to report.
      }
    },
    onError: fail('Could not start setup'),
  });

  const confirmEnrolment = useMutation({
    mutationFn: () => apiRequest('/api/mfa/enroll/verify', 'POST', { code }),
    onSuccess: (data: { backupCodes?: string[] }) => {
      setBackupCodes(data.backupCodes ?? []);
      setCode('');
      setStage('codes');
      refreshStatus();
    },
    onError: fail('That code did not match'),
  });

  const disable = useMutation({
    mutationFn: () => apiRequest('/api/mfa/disable', 'POST', { code }),
    onSuccess: () => {
      toast({ title: 'Two-factor authentication turned off' });
      reset();
      refreshStatus();
    },
    onError: fail('Could not turn it off'),
  });

  const regenerate = useMutation({
    mutationFn: () => apiRequest('/api/mfa/backup-codes/regenerate', 'POST', { code }),
    onSuccess: (data: { codes?: string[] }) => {
      setBackupCodes(data.codes ?? []);
      setCode('');
      setStage('codes');
      refreshStatus();
    },
    onError: fail('Could not regenerate the codes'),
  });

  const enrolled = Boolean(status?.enrolled);
  const askingForCode = stage === 'disabling' || stage === 'regenerating';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Two-Factor Authentication
            {!isLoading && (
              <Badge variant={enrolled ? 'default' : 'secondary'}>{enrolled ? 'On' : 'Off'}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            An authenticator app code, in addition to your password, when you sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {enrolled ? (
            <>
              <p className="text-sm text-muted-foreground">
                {status?.primary === 'totp' ? 'Authenticator app' : (status?.primary ?? 'Enabled')}
                {typeof codeCount?.remaining === 'number'
                  ? ` · ${codeCount.remaining} backup codes left`
                  : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setStage('regenerating')}>
                  Regenerate backup codes
                </Button>
                <Button variant="outline" onClick={() => setStage('disabling')}>
                  Turn off
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => beginEnrolment.mutate()} disabled={beginEnrolment.isPending}>
              {beginEnrolment.isPending ? 'Preparing…' : 'Set up'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={stage === 'enrolling'} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up your authenticator</DialogTitle>
            <DialogDescription>
              Scan this in your authenticator app, then enter the six-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code for your authenticator app"
                className="mx-auto h-44 w-44"
              />
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="mfa-secret">Or enter this key by hand</Label>
              <Input id="mfa-secret" readOnly value={secret} className="font-mono" />
              {otpauthUrl ? (
                <p className="break-all text-xs text-muted-foreground">{otpauthUrl}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="mfa-code">Code from your app</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmEnrolment.mutate()}
              disabled={code.length < 6 || confirmEnrolment.isPending}
            >
              {confirmEnrolment.isPending ? 'Checking…' : 'Turn on'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stage === 'codes'} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your backup codes</DialogTitle>
            <DialogDescription>
              Each one works once, and this is the only time they are shown. They are how you get in
              if you lose the device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((c) => (
              <span key={c} className="rounded border px-2 py-1 text-center">
                {c}
              </span>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={reset}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={askingForCode} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {stage === 'disabling'
                ? 'Turn off two-factor authentication'
                : 'Regenerate backup codes'}
            </DialogTitle>
            <DialogDescription>
              Enter a current code from your authenticator, or one of your backup codes.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertDescription>
              {stage === 'disabling'
                ? 'A code is required so that a stolen session cannot switch this off on its own.'
                : 'Regenerating invalidates the codes you already hold, so a code is required first.'}
            </AlertDescription>
          </Alert>
          <div className="space-y-1">
            <Label htmlFor="mfa-confirm-code">Code</Label>
            <Input
              id="mfa-confirm-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            {stage === 'disabling' ? (
              <Button
                variant="destructive"
                onClick={() => disable.mutate()}
                disabled={!code || disable.isPending}
              >
                {disable.isPending ? 'Turning off…' : 'Turn off'}
              </Button>
            ) : (
              <Button onClick={() => regenerate.mutate()} disabled={!code || regenerate.isPending}>
                {regenerate.isPending ? 'Regenerating…' : 'Regenerate'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
