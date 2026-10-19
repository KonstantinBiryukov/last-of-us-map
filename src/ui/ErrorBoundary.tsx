/**
 * ErrorBoundary.tsx — stops one broken part from taking down the whole page.
 *
 * React error boundaries must be class components. If anything inside throws
 * while rendering (e.g. the map fails on an unusual GPU), we show `fallback`
 * instead, and the rest of the app (slideshow, music, controls) keeps working.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Part of the interface failed and was replaced by a fallback:', error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
