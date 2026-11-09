// promptId 归属的结果收集：只接受 /history/{promptId}；超时明确失败；
// 永不"取最新 mtime 图片"（上游缺陷#6/#7）；取消=停自有进程，不用全局 /interrupt。
import { err } from './err.mjs';
import { setTimeout as delay } from 'node:timers/promises';

async function bounded(operation, signal, timeoutMs, timeoutCode) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw err('invalid-timeout', 'Timeout must be positive');
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let listener;
  const abortError = () => err(signal?.aborted ? 'cancelled' : timeoutCode, signal?.aborted ? 'job cancelled' : 'Image service timed out');
  try {
    if (combined.aborted) throw abortError();
    const stopped = new Promise((_, reject) => {
      listener = () => reject(abortError());
      combined.addEventListener('abort', listener, { once: true });
    });
    return await Promise.race([Promise.resolve().then(() => operation(combined)), stopped]);
  } catch (e) {
    if (combined.aborted) throw abortError();
    throw e;
  } finally {
    clearTimeout(timer);
    if (listener) combined.removeEventListener('abort', listener);
  }
}

export class ComfyAdapter {
  constructor({ fetchImpl = fetch, baseURL = 'http://127.0.0.1:8191', sessionToken = null, outputCollector = null }) {
    this.fetch = fetchImpl;
    this.baseURL = baseURL;
    this.sessionToken = sessionToken; // loopback 之外还需会话令牌（localhost 不是身份认证）
    this.outputCollector = outputCollector; // 注入式输出收集（生产：受控目录按 promptId 归属）
  }

  async submit(graph, { signal = null, timeoutMs = 30000 } = {}) {
    return bounded(signal => this._submit(graph, signal), signal, timeoutMs, 'submit-timeout');
  }

  async _submit(graph, signal) {
    const res = await this.fetch(`${this.baseURL}/prompt`, {
      signal,
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(this.sessionToken ? { 'x-dsh-session': this.sessionToken } : {}) },
      body: JSON.stringify({ prompt: graph }),
    });
    if (!res.ok) throw err('submit-failed', `ComfyUI /prompt ${res.status}`);
    const body = await res.json();
    if (!body.prompt_id) throw err('submit-failed', 'no prompt_id');
    return { promptId: body.prompt_id };
  }

  // 只按 promptId 收集；超时/未命中即失败
  async wait(promptId, { timeoutMs = 240000, signal = null, pollMs = 500, now = Date.now } = {}) {
    return bounded(signal => this._wait(promptId, { timeoutMs, signal, pollMs, now }), signal, timeoutMs, 'collect-timeout');
  }

  async _wait(promptId, { timeoutMs, signal, pollMs, now }) {
    const deadline = now() + timeoutMs;
    for (;;) {
      if (signal?.aborted) throw err('cancelled', 'job cancelled');
      const res = await this.fetch(`${this.baseURL}/history/${encodeURIComponent(promptId)}`, {
        signal,
        headers: this.sessionToken ? { 'x-dsh-session': this.sessionToken } : {},
      });
      if (!res.ok) throw err('collect-failed', `history ${res.status}`);
      const hist = await res.json();
      const entry = hist?.[promptId];
      if (entry) {
        if (entry.status?.status_str === 'error' || entry.status?.completed === false && entry.status?.status_str === 'error') {
          throw err('run-failed', 'ComfyUI execution error');
        }
        const outputs = Object.values(entry.outputs ?? {});
        if (outputs.length && (entry.status?.completed ?? true)) {
          return this.outputCollector ? this.outputCollector(promptId, outputs, { signal }) : outputs;
        }
      }
      if (now() >= deadline) throw err('collect-timeout', `promptId ${promptId} 超时无归属输出；不回退到最新图片`);
      await delay(pollMs, undefined, { signal });
    }
  }

  // 取消只影响自有任务：自有 Comfy 进程由租约停止（不使用全局 /interrupt、不按名 kill）
  async cancelOwn() { return { stoppedOwnProcessOnly: true }; }
}
