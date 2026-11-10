// 统一任务编排：状态机 + 会话/epoch 权限 + 单一 GPU 租约 + promptId 归属收集。
// 事件只含 jobId/sessionEpoch/step/errorCode（无内容）；迟到结果丢弃；取消只影响自身。
import { err } from "./err.mjs";
import { applyPlan, boundedPlan } from "./planner.mjs";

export const TRANSITIONS = Object.freeze({
  queued: ["validating", "canceling", "failed"],
  validating: ["planning", "canceling", "failed"],
  planning: ["waiting-gpu", "canceling", "failed"],
  "waiting-gpu": ["loading", "canceling", "failed"],
  loading: ["running", "canceling", "failed"],
  running: ["collecting", "canceling", "failed"],
  collecting: ["ready", "canceling", "failed"],
  canceling: ["cancelled", "failed"],
  ready: [],
  failed: [],
  cancelled: [],
});

export class JobManager {
  constructor({
    lease,
    compile,
    adapter,
    planner,
    plannerTimeoutMs = 60000,
    now = () => Date.now(),
    rng,
    onEvent = () => {},
  }) {
    this.lease = lease;
    this.compile = compile; // (request) -> {status, job?, graph?, errors?}
    this.adapter = adapter; // {submit(graph), wait(promptId, opts), cancelOwn()}
    this.planner = planner; // (request) -> 受限 JSON（只含允许字段）
    this.plannerTimeoutMs = plannerTimeoutMs;
    this.now = now;
    this.rng = rng;
    this.onEvent = onEvent;
    this.jobs = new Map();
    this.closedEpochs = new Map();
    this._gpuChain = Promise.resolve(); // GPU 工作负载 FIFO 排队（同一时刻一个）
  }

  _enqueueGpu() {
    const prev = this._gpuChain;
    let releaseNext;
    this._gpuChain = new Promise((r) => {
      releaseNext = r;
    });
    return prev.then(() => () => releaseNext());
  }

  _transition(job, to, errorCode = null) {
    const allowed = TRANSITIONS[job.state] ?? [];
    if (!allowed.includes(to)) throw err("bad-transition", `${job.state} -> ${to}`);
    job.state = to;
    job.history.push({ state: to, at: this.now() });
    if (!job.invalidated)
      this.onEvent({ jobId: job.jobId, sessionEpoch: job.sessionEpoch, step: to, errorCode });
  }

  _assertCtx(job, ctx) {
    if (job.invalidated) throw err("epoch-expired", "会话 epoch 已关闭");
    if (ctx.sessionId !== job.sessionId) throw err("forbidden", "跨会话访问拒绝");
    if (ctx.sessionEpoch !== job.sessionEpoch) throw err("epoch-expired", "会话 epoch 已失效");
    if (ctx.authenticatedOwner !== job.owner) throw err("forbidden", "owner 不匹配");
  }

  submit(request, ctx) {
    if (
      !ctx?.sessionId ||
      !Number.isSafeInteger(ctx.sessionEpoch) ||
      ctx.sessionEpoch < 0 ||
      !ctx.authenticatedOwner
    )
      throw err("bad-context", "调用上下文必须由受信任服务签发");
    if (ctx.sessionEpoch <= (this.closedEpochs.get(ctx.sessionId) ?? -1))
      throw err("epoch-expired", "会话 epoch 已关闭");
    const jobId = `job-${this.rng(8).toString("hex")}`;
    const job = {
      jobId,
      state: "queued",
      history: [],
      sessionId: ctx.sessionId,
      sessionEpoch: ctx.sessionEpoch,
      owner: ctx.authenticatedOwner,
      mode: ctx.mode ?? "normal",
      request: structuredClone(request),
      invalidated: false,
      abort: new AbortController(),
      result: null,
      errorCode: null,
      resourceRecovery: null,
    };
    this.jobs.set(jobId, job);
    job.history.push({ state: "queued", at: this.now() });
    this.onEvent({ jobId, sessionEpoch: job.sessionEpoch, step: "queued", errorCode: null });
    this._pipeline(job).catch(() => {}); // 管道自身负责状态收口
    return jobId;
  }

  async _pipeline(job) {
    const fail = (code, e) => {
      if (job.state === "canceling") {
        this._transition(job, "cancelled", code);
        return;
      }
      if (["ready", "failed", "cancelled"].includes(job.state)) return;
      job.errorCode = code;
      try {
        this._transition(job, "failed", code);
      } catch {}
    };
    try {
      this._transition(job, "validating");
      let compiled = this.compile(job.request, { mode: job.mode, jobId: job.jobId });
      if (compiled.status !== "ok")
        return fail(compiled.errors ? "invalid-request" : (compiled.code ?? "blocked"), compiled);
      job.abort.signal.throwIfAborted();

      this._transition(job, "planning");
      const planned = await boundedPlan(this.planner, job.request, job.abort.signal, this.plannerTimeoutMs);
      const request = applyPlan(job.request, planned);
      compiled = this.compile(request, { mode: job.mode, jobId: job.jobId });
      if (compiled.status !== "ok")
        return fail(compiled.errors ? "invalid-plan" : (compiled.code ?? "blocked"), compiled);
      job.abort.signal.throwIfAborted();

      this._transition(job, "waiting-gpu");
      const doneWithTurn = await this._enqueueGpu(); // FIFO 排队；取消中的任务拿到轮次也立即退出
      let out;
      try {
        job.abort.signal.throwIfAborted();
        out = await this.lease.run(
          { jobId: job.jobId, mode: job.mode, owner: job.owner },
          job.abort.signal,
          async () => {
            this._transition(job, "loading"); // lease 内 preflight/snapshot/unload/startImage
            const { promptId } = await this.adapter.submit(compiled.graph, { signal: job.abort.signal });
            job.backendPromptId = promptId; // 归属绑定
            this._transition(job, "running");
            const outputs = await this.adapter.wait(promptId, { signal: job.abort.signal });
            if (job.abort.signal.aborted || job.state === "canceling") return { dropped: true };
            this._transition(job, "collecting");
            return { outputs, promptId };
          },
        );
      } finally {
        doneWithTurn();
      }
      job.resourceRecovery = out.resourceRecovery;
      if (out.result?.dropped || job.state === "canceling" || job.invalidated) {
        // 迟到结果：丢弃，不污染新会话/取消的任务
        if (!job.invalidated)
          this.onEvent({
            jobId: job.jobId,
            sessionEpoch: job.sessionEpoch,
            step: "late-result-dropped",
            errorCode: null,
          });
        if (job.state === "canceling") this._transition(job, "cancelled");
        return;
      }
      job.result = out.result;
      if (job.state !== "ready") this._transition(job, "ready");
    } catch (e) {
      if (e?.name === "AbortError" || e?.code === "cancelled" || job.state === "canceling") {
        if (job.backendPromptId && !job.invalidated) {
          // 已提交任务的迟到输出不会归属回来（防污染）
          this.onEvent({
            jobId: job.jobId,
            sessionEpoch: job.sessionEpoch,
            step: "late-result-dropped",
            errorCode: null,
          });
        }
        try {
          this._transition(job, "cancelled", e?.code ?? "cancelled");
        } catch {}
        return;
      }
      // 生成失败与恢复失败分离：resourceRecovery 附加在错误上
      if (e?.resourceRecovery) job.resourceRecovery = e.resourceRecovery;
      fail(e?.code ?? "run-failed", e);
    } finally {
      if (job.invalidated) {
        job.request = null;
        job.result = null;
      }
    }
  }

  status(jobId, ctx) {
    const job = this.jobs.get(jobId);
    if (!job) throw err("no-job", "job not found");
    this._assertCtx(job, ctx);
    return {
      jobId,
      state: job.state,
      mode: job.mode,
      errorCode: job.errorCode,
      backendPromptId: job.backendPromptId ?? null,
      resourceRecovery: job.resourceRecovery, // 恢复失败单独呈现
      hasResult: !!job.result,
    };
  }

  result(jobId, ctx) {
    const job = this.jobs.get(jobId);
    if (!job) throw err("no-job", "job not found");
    this._assertCtx(job, ctx);
    if (!job.result) throw err("no-result", "结果未就绪或已丢弃");
    return job.result;
  }

  cancel(jobId, ctx) {
    const job = this.jobs.get(jobId);
    if (!job) throw err("no-job", "job not found");
    this._assertCtx(job, ctx); // 只能取消自己的任务
    if (["ready", "failed", "cancelled"].includes(job.state)) return { state: job.state, noop: true };
    if (job.state !== "canceling") this._transition(job, "canceling");
    job.abort.abort();
    // The lease stops its owned worker in finally. A queued cancellation must
    // never call a shared adapter's process-wide cancellation path.
    return { state: job.state };
  }

  events(sessionId, epoch) {
    return [...this.jobs.values()]
      .filter((j) => !j.invalidated && j.sessionId === sessionId && j.sessionEpoch === epoch)
      .flatMap((j) =>
        j.history.map((h) => ({ jobId: j.jobId, sessionEpoch: j.sessionEpoch, step: h.state, at: h.at })),
      );
  }

  // Called by the trusted DSH session lifecycle on lock/delete/close.
  closeSession(ctx) {
    if (!ctx?.sessionId || !Number.isSafeInteger(ctx.sessionEpoch) || !ctx.authenticatedOwner)
      throw err("bad-context", "Trusted session context required");
    const jobs = [...this.jobs.values()].filter(
      (j) => j.sessionId === ctx.sessionId && j.sessionEpoch === ctx.sessionEpoch,
    );
    for (const job of jobs) if (job.owner !== ctx.authenticatedOwner) throw err("forbidden", "owner 不匹配");
    this.closedEpochs.set(
      ctx.sessionId,
      Math.max(ctx.sessionEpoch, this.closedEpochs.get(ctx.sessionId) ?? -1),
    );
    for (const job of jobs) {
      job.invalidated = true;
      job.result = null;
      if (!["ready", "failed", "cancelled"].includes(job.state)) {
        if (job.state !== "canceling") this._transition(job, "canceling");
        job.abort.abort();
      } else {
        job.request = null;
      }
    }
    return { invalidatedJobs: jobs.length };
  }
}
