/**
 * PWA Install Prompt Component
 * Shows an install button when the app can be installed
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { X, Download, Smartphone, Zap } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';
import { useToast } from '@/hooks/use-toast';

interface PWAInstallPromptProps {
  onDismiss?: () => void;
  variant?: 'banner' | 'card' | 'button';
}

export function PWAInstallPrompt({ onDismiss, variant = 'card' }: PWAInstallPromptProps) {
  const { canInstall, isInstalled, promptInstall } = usePWA();
  const { toast } = useToast();

  if (isInstalled || !canInstall) {
    return null;
  }

  const handleInstall = async () => {
    const result = await promptInstall();

    if (result === 'accepted') {
      toast({
        title: 'App Installed!',
        description:
          'Printyx has been installed successfully. You can now access it from your home screen.',
      });
    } else if (result === 'dismissed') {
      toast({
        title: 'Installation Cancelled',
        description: 'You can install Printyx anytime from your browser menu.',
        variant: 'default',
      });
    }

    onDismiss?.();
  };

  // Button variant - just a button
  if (variant === 'button') {
    return (
      <Button onClick={handleInstall} size="sm" variant="outline">
        <Download className="h-4 w-4 mr-2" />
        Install App
      </Button>
    );
  }

  // Banner variant - compact banner
  if (variant === 'banner') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 pb-safe-bottom shadow-lg md:hidden">
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Smartphone className="h-6 w-6 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Install Printyx</p>
              <p className="text-xs text-white/90">Add to home screen for faster access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleInstall}
              size="sm"
              variant="secondary"
              className="whitespace-nowrap"
            >
              Install
            </Button>
            {onDismiss && (
              <Button
                onClick={onDismiss}
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Card variant - full card (default)
  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Install Printyx App</CardTitle>
              <CardDescription className="mt-1">
                Get the full experience with offline access and faster loading
              </CardDescription>
            </div>
          </div>
          {onDismiss && (
            <Button onClick={onDismiss} size="sm" variant="ghost" className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <span>Works offline - access your data anywhere</span>
          </li>
          <li className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <span>Faster loading with intelligent caching</span>
          </li>
          <li className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <span>Home screen icon for quick access</span>
          </li>
          <li className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <span>Push notifications for important updates</span>
          </li>
        </ul>
      </CardContent>
      <CardFooter>
        <Button onClick={handleInstall} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          Install Now
        </Button>
      </CardFooter>
    </Card>
  );
}
