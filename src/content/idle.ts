/** Runs the callback once the browser has nothing else to do; returns a cancel function. */
export function whenIdle(callback: () => void): () => void {
  // Safari has no requestIdleCallback.
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback, { timeout: 2000 });
    return () => cancelIdleCallback(handle);
  }
  const timer = setTimeout(callback, 200);
  return () => clearTimeout(timer);
}
