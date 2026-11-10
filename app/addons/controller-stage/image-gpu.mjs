// Provided through Cordis, so all plugin loader contexts share the same owner.
export class ImageGpuTransaction {
  busy = false;
  streams = 0;
  #recovery;
  #recovering = false;
  constructor(adapter) {
    this.adapter = adapter;
  }
  get recoveryPending() {
    return Boolean(this.#recovery);
  }
  async *stream(signal, next) {
    while (this.busy) {
      if (this.#recovery) {
        signal?.throwIfAborted();
        await this.retryRecovery();
        continue;
      }
      signal?.throwIfAborted();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    signal?.throwIfAborted();
    this.streams++;
    let active = true;
    try {
      for await (const chunk of next()) {
        // Tools may start while the consumer is processing the final chunk.
        if (chunk?.type === "finish" && active) {
          this.streams--;
          active = false;
        }
        yield chunk;
      }
    } finally {
      if (active) this.streams--;
    }
  }
  async run(owner, signal, generate, prepare) {
    if (!owner) throw new Error("Image GPU handoff requires the calling DSH agent");
    signal.throwIfAborted();
    if (this.#recovery) await this.retryRecovery();
    return this.#runTransaction(owner, signal, generate, prepare);
  }
  // Trusted host only: same ownership/stream/recovery lock, private runtime supplied
  // by the encrypted-workspace service rather than by browser request data.
  async runPrivate(owner, signal, runtime, generate) {
    if (!owner) throw new Error("Private image handoff requires the calling DSH agent");
    if (["preflight", "startImage", "stopImage"].some((key) => typeof runtime?.[key] !== "function"))
      throw new Error("Verified private runtime required");
    signal.throwIfAborted();
    if (this.#recovery) await this.retryRecovery();
    return this.#runTransaction(owner, signal, generate, undefined, runtime);
  }
  // Called only by the trusted workbench backend, never with a browser-supplied owner.
  async runWorkbench(signal, generate, prepare) {
    if (globalThis[Symbol.for("dsh.incognito.active")]) {
      throw new Error("Private workbench storage is not ready");
    }
    signal.throwIfAborted();
    if (this.#recovery) await this.retryRecovery();
    return this.#runTransaction(undefined, signal, generate, prepare);
  }
  async #runTransaction(owner, signal, generate, prepare, imageRuntime = this.adapter) {
    signal.throwIfAborted();
    if (this.busy) throw new Error("Another image generation is using the GPU");
    const others = this.adapter.agents().filter((a) => a.status === "running" && a !== owner);
    if (others.length) throw new Error("Finish other DSH tasks before sharing the GPU with image generation");
    this.busy = true;
    let snapshot,
      unloadAttempted = false,
      result,
      primaryError;
    const cleanupErrors = [];
    try {
      // The calling agent's tool can race its stream finalizer. Reserve the lease
      // first so no new stream starts, then give that finalizer a bounded wait.
      const drainDeadline = Date.now() + (this.adapter.streamDrainMs ?? 5000);
      while (this.streams) {
        signal.throwIfAborted();
        if (Date.now() >= drainDeadline)
          throw new Error("A model response is still streaming; retry after it finishes");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      // Missing models or runtime must not unload a working chat model.
      await imageRuntime.preflight();
      signal.throwIfAborted();
      snapshot = await this.adapter.snapshot();
      signal.throwIfAborted();
      if (this.adapter.agents().some((a) => a.status === "running" && a !== owner))
        throw new Error("Another DSH task started before image generation; retry when it finishes");
      unloadAttempted = true;
      if (prepare) await prepare(snapshot);
      signal.throwIfAborted();
      // Preflight, snapshot and prompt preparation may await slow I/O. An
      // unrelated agent can start during that interval; do not unload its model.
      if (this.adapter.agents().some((a) => a.status === "running" && a !== owner))
        throw new Error("Another DSH task started before image generation; retry when it finishes");
      await this.adapter.unload();
      signal.throwIfAborted();
      await imageRuntime.startImage(signal);
      result = await generate();
      signal.throwIfAborted();
    } catch (error) {
      primaryError = error;
    } finally {
      if (unloadAttempted) {
        // Cleanup deliberately ignores the caller's abort signal.
        let imageStopped = false;
        try {
          await imageRuntime.stopImage();
          imageStopped = true;
        } catch (error) {
          cleanupErrors.push(error);
        }
        // Never reload the LLM while an owned image process may still hold VRAM.
        if (imageStopped) {
          try {
            await this.adapter.restore(snapshot);
          } catch (error) {
            cleanupErrors.push(error);
          }
        }
      }
      if (cleanupErrors.length) this.#recovery = { snapshot, imageRuntime };
      this.busy = cleanupErrors.length > 0;
    }
    // The image itself succeeded: hand it back. The lease stays held with a pending
    // recovery, which the next local chat request retries (ensureLocalModel).
    if (cleanupErrors.length && !primaryError && result !== undefined) {
      this.lastCleanupError = cleanupErrors.map((e) => e.message).join("; ");
      return result;
    }
    if (cleanupErrors.length)
      throw new AggregateError(
        [primaryError, ...cleanupErrors].filter(Boolean),
        "Image GPU recovery failed: " + cleanupErrors.map((e) => e.message).join("; "),
      );
    if (primaryError) throw primaryError;
    return result;
  }
  // Trusted host operation: retry cleanup using the original snapshot only.
  async retryRecovery() {
    if (!this.#recovery) return;
    if (this.#recovering) throw new Error("Image GPU recovery is already running");
    this.#recovering = true;
    try {
      await this.#recovery.imageRuntime.stopImage();
      await this.adapter.restore(this.#recovery.snapshot);
      this.#recovery = undefined;
      this.busy = false;
    } finally {
      this.#recovering = false;
    }
  }
}
