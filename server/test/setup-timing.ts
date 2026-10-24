/** Fixed operation labels only: never log payloads, errors, URLs or identities. */
export async function setupStep<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const start = performance.now();
  console.info(`[integration setup] ${label} started`);
  try {
    const value = await operation();
    console.info(`[integration setup] ${label} completed (${Math.round(performance.now() - start)}ms)`);
    return value;
  } catch (error) {
    console.info(`[integration setup] ${label} failed (${Math.round(performance.now() - start)}ms)`);
    throw error;
  }
}
