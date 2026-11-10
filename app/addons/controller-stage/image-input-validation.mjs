// Reuse the host's decoder. Decode sequentially with a pixel bound; never write
// plaintext copies. Paths are trusted host capabilities (encrypted mount only).
export function createImageInputValidator(sharp) {
  return async function validateImages(images, signal) {
    if (!Array.isArray(images) || !images.length || images.length > 17) throw Error("Invalid image inputs");
    const dimensions = [];
    for (const image of images) {
      signal?.throwIfAborted();
      const input = typeof image.path === "string" ? image.path : Buffer.from(image.data);
      const decoder = sharp(input, { failOn: "warning", limitInputPixels: 64 * 1024 * 1024 });
      try {
        const meta = await decoder.metadata();
        if (
          !["png", "jpeg", "webp"].includes(meta.format) ||
          !meta.width ||
          !meta.height ||
          (meta.pages ?? 1) !== 1
        )
          throw Error("仅支持单帧 PNG、JPEG 或 WebP 图片。");
        if (image.kind === "alpha-mask" && (meta.format !== "png" || !meta.hasAlpha || meta.isPalette))
          throw Error("蒙版需要带透明通道的 PNG；不支持普通黑白图或索引色 PNG。");
        // metadata() alone accepts truncated files; stats() consumes all pixels.
        await decoder.stats();
        signal?.throwIfAborted();
        const swapped = [5, 6, 7, 8].includes(meta.orientation);
        dimensions.push({
          width: swapped ? meta.height : meta.width,
          height: swapped ? meta.width : meta.height,
        });
      } catch (error) {
        signal?.throwIfAborted();
        throw new Error("图片无法完整解码或超出限制：" + error.message, { cause: error });
      } finally {
        decoder.destroy();
      }
    }
    for (let i = 0; i < images.length; i++)
      if (images[i].kind === "alpha-mask") {
        if (
          i === 0 ||
          images[0].kind === "alpha-mask" ||
          dimensions[i].width !== dimensions[0].width ||
          dimensions[i].height !== dimensions[0].height
        )
          throw Error("蒙版尺寸必须与源图一致（按图片实际显示方向）。");
      }
    return dimensions;
  };
}
