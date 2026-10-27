// Retained route state must refresh too; newly mounted task pages already GET.
let version = 0;
const listeners = new Set<() => void>();
export const taskListVersion = () => version;
export const taskListServerVersion = () => 0;
export function subscribeTaskListInvalidation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function invalidateTaskList() {
  version++;
  listeners.forEach((listener) => listener());
}
