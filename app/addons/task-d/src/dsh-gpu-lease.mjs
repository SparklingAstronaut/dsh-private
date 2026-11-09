// Bridge to the existing Cordis ImageGpuTransaction singleton. Never create an
// independent GPU owner for Studio jobs. This module does not enable a plugin.
import { err } from './err.mjs';

export class DshGpuLease {
  constructor({ transaction }) {
    if (typeof transaction?.run !== 'function') throw err('no-gpu-service', 'DSH GPU service required');
    this.transaction = transaction;
  }

  async run(job, signal, generate) {
    if (!job?.owner) throw err('no-owner', 'DSH agent identity required');
    // Production private staging has not passed its lifecycle gate.
    if (job.mode !== 'normal') throw err('private-not-ready', 'Studio private staging has not been verified');
    let result, generated = false, generationError;
    try {
      await this.transaction.run(job.owner, signal, async () => {
        try {
          result = await generate();
          generated = true;
          return result;
        } catch (e) { generationError = e; throw e; }
      });
      return { result, resourceRecovery: { ok: true, errorCode: null } };
    } catch (e) {
      signal?.throwIfAborted();
      // The existing transaction reports cleanup errors as AggregateError.
      // Preserve a completed image while explicitly reporting recovery failure.
      if (e instanceof AggregateError) {
        const recovery = { ok: false, errorCode: 'gpu-recovery-failed' };
        if (generated && !generationError) return { result, resourceRecovery: recovery };
        const failure = generationError ?? err('gpu-handoff-failed', 'DSH GPU handoff failed');
        failure.resourceRecovery = recovery;
        throw failure;
      }
      throw e;
    }
  }
}
