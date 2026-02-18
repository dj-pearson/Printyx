/**
 * Error Boundary with Remote Logging
 *
 * Catches unhandled rendering errors in child components and logs
 * them to the Express server via the remote logger. Shows a
 * user-friendly error screen with retry capability.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { remoteLog } from '@/lib/remoteLogger';
import { colors, spacing, typography } from '@/theme';

interface Props {
  children: ReactNode;
  screen?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RemoteErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Always log to native console so crashes are visible in Xcode/logcat
    console.error(
      `[RemoteErrorBoundary:${this.props.screen || '?'}] RENDER CRASH:`,
      error.message,
      error.stack,
    );

    remoteLog.error(
      `RENDER CRASH: ${error.message}`,
      {
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 10).join('\n'),
        componentStack: errorInfo.componentStack?.split('\n').slice(0, 10).join('\n'),
      },
      this.props.screen || 'ErrorBoundary',
    );

    // Flush immediately so crash info is sent before app might close
    remoteLog.flush();
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>!</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>

          {this.state.error?.stack && (
            <ScrollView style={styles.stackContainer}>
              <Text style={styles.stack} selectable>
                {this.state.error.stack.split('\n').slice(0, 8).join('\n')}
              </Text>
            </ScrollView>
          )}

          {this.state.errorInfo?.componentStack && (
            <ScrollView style={[styles.stackContainer, { maxHeight: 100 }]}>
              <Text style={styles.stack} selectable>
                {this.state.errorInfo.componentStack.split('\n').slice(0, 6).join('\n')}
              </Text>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
    backgroundColor: colors.background.default,
  },
  icon: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.error.main,
    width: 80,
    height: 80,
    lineHeight: 80,
    textAlign: 'center',
    borderRadius: 40,
    backgroundColor: colors.error.light || '#FEE2E2',
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  stackContainer: {
    maxHeight: 150,
    width: '100%',
    marginBottom: spacing.xl,
    backgroundColor: colors.gray[50],
    borderRadius: 8,
    padding: spacing.md,
  },
  stack: {
    ...typography.caption,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.text.tertiary,
  },
  retryButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  retryText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
