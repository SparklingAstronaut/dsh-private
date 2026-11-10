import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { privateImageExtension } from "./private-image-format.mjs";

// Inputs are read capabilities resolved by Studio ownership checks, never paths.
export async function materializePrivateInputs({
  workspace,
  graph,
  inputs = [],
  inputKinds = inputs.map(() => "image"),
  signal,
  maxBytes = 256 * 1024 * 1024,
  validateImages,
}) {
  if (!workspace?.root || typeof workspace.assertActive !== "function")
    throw Error("Verified private workspace required");
  if (!Array.isArray(inputs) || inputs.length > 16 || !inputs.every((input) => typeof input === "function"))
    throw Error("Invalid private inputs");
  if (
    inputKinds.length !== inputs.length ||
    inputKinds.some((kind) => !["image", "alpha-mask"].includes(kind))
  )
    throw Error("Invalid private input kinds");
  signal.throwIfAborted();
  workspace.assertActive();
  const copy = structuredClone(graph),
    bindings = [],
    used = new Set();
  for (const node of Object.values(copy))
    if (node.class_type === "LoadImage") {
      const match = /^asset:input-([1-9][0-9]*)$/.exec(node.inputs.image);
      const index = match ? Number(match[1]) - 1 : -1;
      if (index < 0 || index >= inputs.length) throw Error("Unbound private reference");
      bindings.push({ node, index });
      used.add(index);
    }
  if (used.size !== inputs.length) throw Error("Unused private reference");
  if (!inputs.length) return copy;
  const root = path.join(workspace.root, "input");
  await fs.mkdir(root, { recursive: true });
  if ((await fs.lstat(root)).isSymbolicLink()) throw Error("Private input links forbidden");
  const names = [],
    created = [];
  let total = 0;
  try {
    for (const input of inputs) {
      signal.throwIfAborted();
      workspace.assertActive();
      const stem = `private-${randomUUID()}`,
        temporary = path.join(root, stem + ".bin");
      const handle = await fs.open(temporary, "wx");
      created.push(temporary);
      let header = Buffer.alloc(0),
        size = 0;
      try {
        for await (const chunk of input()) {
          signal.throwIfAborted();
          workspace.assertActive();
          if (!(chunk instanceof Uint8Array)) throw Error("Invalid private input chunk");
          total += chunk.length;
          size += chunk.length;
          if (total > maxBytes) throw Error("Private inputs exceed limit");
          if (header.length < 32)
            header = Buffer.concat([header, Buffer.from(chunk.subarray(0, 32 - header.length))]);
          let offset = 0;
          while (offset < chunk.length) {
            signal.throwIfAborted();
            workspace.assertActive();
            const { bytesWritten } = await handle.write(
              chunk,
              offset,
              Math.min(chunk.length - offset, 1024 * 1024),
            );
            if (!bytesWritten) throw Error("Private input write failed");
            offset += bytesWritten;
          }
        }
        await handle.sync();
      } finally {
        await handle.close();
      }
      const ext = privateImageExtension(header);
      if (
        inputKinds[names.length] === "alpha-mask" &&
        (ext !== "png" || header.length < 26 || ![4, 6].includes(header[25]))
      )
        throw Error("Mask requires a PNG alpha channel");
      if (!size || !ext) throw Error("Unsupported private input image");
      signal.throwIfAborted();
      workspace.assertActive();
      const name = stem + "." + ext,
        target = path.join(root, name);
      await fs.rename(temporary, target);
      created[created.length - 1] = target;
      names.push(name);
    }
    if (inputKinds.includes("alpha-mask") && typeof validateImages !== "function")
      throw Error("Full alpha mask validation unavailable");
    if (validateImages)
      await validateImages(
        names.map((name, index) => ({ path: path.join(root, name), kind: inputKinds[index] })),
        signal,
      );
    signal.throwIfAborted();
    workspace.assertActive();
    for (const { node, index } of bindings) node.inputs.image = names[index];
    return copy;
  } catch (error) {
    const errors = [error];
    for (const target of created)
      try {
        await fs.unlink(target);
      } catch (cleanup) {
        if (cleanup.code !== "ENOENT") errors.push(cleanup);
      }
    if (errors.length > 1) throw new AggregateError(errors, "Private input cleanup failed");
    throw error;
  }
}
