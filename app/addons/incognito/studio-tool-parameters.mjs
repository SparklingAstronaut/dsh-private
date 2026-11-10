const reference = {
  type: "object",
  additionalProperties: false,
  properties: {
    resultId: {
      type: "string",
      required: true,
      description: "An existing image result ID from this private chat.",
    },
    index: { type: "integer", required: true, description: "Zero-based image index in that result." },
  },
};
export const privateImageParameters = {
  prompt: { type: "string", required: true, description: "Complete visual instruction." },
  resolution: {
    type: "integer",
    enum: [512, 768, 1024],
    description: "Default square size when width or height is omitted; default 1024.",
  },
  studio_workflow: {
    type: "string",
    description:
      "Workflow ID from inspect_image_studio. Defaults to the first available workflow. Missing models are rejected, never substituted.",
  },
  fidelity_profile: {
    type: "string",
    description: "Optional model profile ID listed for the workflow by inspect_image_studio.",
  },
  width: { type: "integer", description: "Output width; ignored by workflows that keep the input size." },
  height: { type: "integer", description: "Output height; ignored by workflows that keep the input size." },
  seed: { type: "integer", description: "Reproducible seed, or -1 for random." },
  steps: { type: "integer", description: "Sampling steps." },
  cfg: { type: "number", description: "Guidance strength." },
  denoise: { type: "number", description: "Image-to-image denoise strength." },
  loras: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        assetId: { type: "string", required: true },
        strengthModel: { type: "number", required: true },
        strengthClip: { type: "number" },
      },
    },
    description: "Registered LoRA IDs and weights. Do not invent IDs or use file paths.",
  },
  references: {
    type: "array",
    items: reference,
    description:
      "Ordered existing images owned by this chat. Required for editing/upscaling; no filesystem paths.",
  },
  maskReference: {
    ...reference,
    description: "Existing alpha PNG mask from this chat, only for workflows that accept a mask.",
  },
  parameters: {
    type: "object",
    description: "Workflow-specific options listed by inspect_image_studio, as {option key: value}.",
  },
};
