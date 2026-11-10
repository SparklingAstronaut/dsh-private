// GPU 租约：单一所有者（生产环境包住现有 ImageGpuTransaction；此处为可测语义核）。
// 任务归属 + 进程身份验证 + 恢复失败与生成结果分离（resourceRecovery 不被图片成功覆盖）。
import { err } from "./err.mjs";

export class GpuLease {
  constructor({ adapter }) {
    // adapter: {preflight, snapshot, unload, startImage, stopImage, restore, verifyOwnProcess}
    this.adapter = adapter;
    this.busy = false;
    this.current = null; // {jobId, mode, processRecord}
  }

  async run(job, signal, generate) {
    signal?.throwIfAborted?.();
    if (this.busy) throw err("gpu-busy", `GPU 正被任务 ${this.current?.jobId} 占用`);
    if (!job?.owner) throw err("no-owner", "GPU 租约需要调用 agent 身份");
    this.busy = true;
    this.current = { jobId: job.jobId, mode: job.mode, processRecord: null };
    let snapshot,
      unloadAttempted = false,
      result,
      primaryError;
    const recovery = { attempted: false, ok: true, error: null };
    try {
      await this.adapter.preflight(); // 缺模型/端口占用在卸载聊天模型前失败
      signal?.throwIfAborted?.();
      snapshot = await this.adapter.snapshot(); // 原模型/slot/mode 快照
      unloadAttempted = true;
      await this.adapter.unload();
      signal?.throwIfAborted?.();
      const proc = await this.adapter.startImage(job);
      // 进程记录：PID 单独不足以证明所有权
      if (!proc?.pid || !this.adapter.verifyOwnProcess?.(proc, job)) {
        throw err("process-identity", "图像进程身份核验失败");
      }
      this.current.processRecord = proc;
      result = await generate(proc);
      signal?.throwIfAborted?.();
    } catch (error) {
      primaryError = error;
    } finally {
      if (unloadAttempted) {
        // 清理不跟随调用方 abort；必须等自有进程确认退出
        let imageStopped = false;
        try {
          await this.adapter.stopImage(this.current.processRecord);
          imageStopped = true;
        } catch (e) {
          recovery.ok = false;
          recovery.error = e;
        }
        if (imageStopped) {
          recovery.attempted = true;
          try {
            await this.adapter.restore(snapshot, job.mode);
          } catch (e) {
            recovery.ok = false;
            recovery.error = e;
          }
        } else {
          recovery.ok = false; // 未确认退出不得重载 LLM
        }
      }
      this.busy = false;
      this.current = null;
    }
    if (primaryError) {
      const e = primaryError;
      e.resourceRecovery = recovery;
      throw e;
    }
    return { result, resourceRecovery: recovery };
  }
}
