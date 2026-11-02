/** Discard an older read after navigation, refresh, filtering, or unmount. */
export function createLatestRequestScope() {
  let generation = 0;
  return {
    begin() { const current = ++generation; return () => current === generation; },
    cancel() { generation++; },
  };
}
