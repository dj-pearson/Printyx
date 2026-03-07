/**
 * INP (Interaction to Next Paint) Optimization Utilities
 *
 * Replaces the legacy FID (First Input Delay) optimization approach.
 * INP measures the latency of ALL interactions throughout the page lifecycle,
 * not just the first input. These utilities help ensure responsive interactions
 * by yielding to the main thread and deferring non-critical work.
 *
 * Target: INP < 200ms (good), < 500ms (needs improvement)
 */

/**
 * Yield to the main thread to allow the browser to process pending paint updates.
 * Use this to break up long tasks that block interaction responsiveness.
 *
 * Uses scheduler.yield() when available (Chrome 115+), falls back to
 * MessageChannel for priority-aware yielding, then setTimeout as last resort.
 */
export function yieldToMain(): Promise<void> {
  // scheduler.yield() - best option, preserves task priority
  if ('scheduler' in window && 'yield' in (window as any).scheduler) {
    return (window as any).scheduler.yield();
  }

  // MessageChannel - better than setTimeout(0) which gets clamped to 4ms
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(undefined);
  });
}

/**
 * Run a callback with lower priority, allowing user interactions to be processed first.
 * Wraps requestIdleCallback with a timeout fallback.
 */
export function runWhenIdle(callback: () => void, timeout: number = 2000): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 100);
  }
}

/**
 * Break up a long-running loop into chunks that yield to the main thread.
 * Prevents blocking interactions during data processing.
 *
 * @param items - Array of items to process
 * @param processFn - Function to call for each item
 * @param chunkSize - Number of items to process before yielding (default: 5)
 */
export async function processInChunks<T>(
  items: T[],
  processFn: (item: T, index: number) => void,
  chunkSize: number = 5,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    processFn(items[i], i);
    if ((i + 1) % chunkSize === 0 && i < items.length - 1) {
      await yieldToMain();
    }
  }
}

/**
 * Wraps an event handler to yield before executing heavy logic,
 * allowing the browser to paint the visual response first.
 *
 * Use for click/submit handlers that trigger expensive operations.
 */
export function withResponsiveHandler<T extends (...args: any[]) => any>(
  handler: T,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>) => {
    await yieldToMain();
    return handler(...args);
  };
}
