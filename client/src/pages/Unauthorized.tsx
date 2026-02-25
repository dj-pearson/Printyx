import { ShieldAlert, Lock, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { usePermissions } from '@/hooks/usePermissions';

const levelNames: Record<number, string> = {
  1: 'Individual Contributor',
  2: 'Team Lead',
  3: 'Supervisor',
  4: 'Manager',
  5: 'Regional Director',
  6: 'Company Director',
  7: 'Executive',
  8: 'Platform Admin',
};

export default function Unauthorized() {
  const { level } = usePermissions();

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center max-w-md p-8">
        <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-4">
          You don't have the required permissions to view this page.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-500">
          <div className="flex items-center gap-2 justify-center">
            <Lock className="w-4 h-4" />
            <span>
              Your role: <strong>{levelNames[level] || `Level ${level}`}</strong>
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          If you believe you should have access, contact your administrator to request the
          appropriate permissions.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <Mail className="w-4 h-4 mr-2" />
              Request Access
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
