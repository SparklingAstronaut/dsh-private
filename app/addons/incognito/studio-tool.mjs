import { createHash } from "node:crypto";
import { advancedImageKeys } from "./studio-tool-parameters.mjs";

export async function inspectPrivateStudio(runtime, sessionId, signal) {
  signal?.throwIfAborted();
  if (runtime.stopping || runtime.deleting) throw Error("Private Studio unavailable");
  const studio = runtime.studio;
  if (!studio) return { enabled: false, busy: false, images: [], catalog: { workflows: [], loras: [] } };
  const images = await studio.list(sessionId);
  const catalog = await studio.describe(sessionId);
  signal?.throwIfAborted();
  if (runtime.studio !== studio || runtime.stopping || runtime.deleting)
    throw Error("Private Studio changed");
  return { enabled: true, busy: studio.busy, images, catalog: catalog ?? { workflows: [], loras: [] } };
}

export function dispatchPrivateImage(runtime, legacy, args) {
  if (runtime.studio) return generateStudioImage(runtime, args);
  if (advancedImageKeys.some((key) => args[key] !== undefined))
    throw Error("Private Studio is not enabled; advanced image requests cannot use the legacy generator");
  return legacy({ ...args, fromTool: true });
}

export async function readStudioAttachment(runtime, sessionId, studio, attachment, signal) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of runtime.studio.read(sessionId, studio.resultId, studio.index)) {
    signal?.throwIfAborted();
    bytes += chunk.length;
    if (bytes > 32 * 1024 * 1024) throw Error("Private attachment exceeds model image limit");
    chunks.push(chunk);
  }
  signal?.throwIfAborted();
  const data = Buffer.concat(chunks);
  if (
    data.length < 24 ||
    data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    attachment.attachmentId !== "sha256:" + createHash("sha256").update(data).digest("hex") ||
    attachment.bytes !== bytes ||
    attachment.width !== data.readUInt32BE(16) ||
    attachment.height !== data.readUInt32BE(20)
  )
    throw Error("Private attachment mismatch");
  return data;
}

// Chat tool returns a small attachment reference. Image bytes stay in the
// encrypted Studio store and are fetched only when displayed or read.
export async function generateStudioImage(runtime, args) {
  if (!runtime.studio || runtime.stopping || runtime.deleting) throw Error("Private Studio unavailable");
  if (runtime.studioToolSession) throw Error("Private image tool already running");
  const { sessionId, prompt, resolution = 1024 } = args;
  const request = {
    prompt,
    studio_workflow: args.studio_workflow || "qwen-t2i",
    fidelity_profile: args.fidelity_profile || "local-16gb",
  };
  for (const key of [
    "width",
    "height",
    "seed",
    "steps",
    "cfg",
    "denoise",
    "loras",
    "references",
    "maskReference",
  ])
    if (args[key] !== undefined) request[key] = args[key];
  if (!request.studio_workflow.includes("upscale")) {
    request.width ??= resolution;
    request.height ??= resolution;
  }
  runtime.studioToolSession = sessionId;
  try {
    const output = await runtime.studio.generate(sessionId, request),
      hash = createHash("sha256");
    let header = Buffer.alloc(0),
      bytes = 0;
    for await (const chunk of runtime.studio.read(sessionId, output.resultId, 0)) {
      bytes += chunk.length;
      hash.update(chunk);
      if (header.length < 24) header = Buffer.concat([header, chunk.subarray(0, 24 - header.length)]);
    }
    if (header.length < 24 || header.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
      throw Error("Generated image is not PNG");
    const width = header.readUInt32BE(16),
      height = header.readUInt32BE(20);
    if (!width || !height) throw Error("Invalid generated image dimensions");
    return {
      attachment: {
        attachmentId: "sha256:" + hash.digest("hex"),
        mediaType: "image/png",
        bytes,
        width,
        height,
      },
      studio: { resultId: output.resultId, index: 0 },
      resourceRecovery: output.resourceRecovery,
    };
  } finally {
    runtime.studioToolSession = null;
  }
}
