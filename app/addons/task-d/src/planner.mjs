import { err } from './err.mjs';

// A planner can refine text and suggest omitted numeric controls. It cannot
// select paths, references, models, nodes, fidelity, or override explicit controls.
export function applyPlan(request, plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw err('invalid-plan', 'Plan must be an object');
  const allowed = ['instruction', 'width', 'height', 'steps', 'cfg', 'denoise'];
  for (const key of Object.keys(plan)) if (!allowed.includes(key)) throw err('invalid-plan', 'Unsupported planner field');
  const merged = structuredClone(request);
  for (const [key, value] of Object.entries(plan)) {
    if (key !== 'instruction' && request[key] !== undefined && request[key] !== value) {
      throw err('plan-conflict', 'Planner cannot override explicit controls');
    }
    merged[key] = value;
  }
  return merged;
}

export async function boundedPlan(planner, request, signal, timeoutMs) {
  signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(err('plan-timeout', 'Planning timed out')), timeoutMs);
  let onAbort;
  try {
    const stopped = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    return await Promise.race([Promise.resolve().then(() => planner(structuredClone(request), { signal: controller.signal })), stopped]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
