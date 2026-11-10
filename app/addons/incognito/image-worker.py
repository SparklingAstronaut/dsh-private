from portable_paths import private_path

"""Private Qwen workflow: prompt via stdin, PNG via stdout; no image files."""
import sys, os, io, json, base64, importlib.util
from pathlib import Path

root = Path(private_path("image"))
sys.dont_write_bytecode = True
os.environ.update(
    CUDA_CACHE_DISABLE="1",
    HF_HUB_OFFLINE="1",
    TRANSFORMERS_OFFLINE="1",
    HF_HUB_DISABLE_TELEMETRY="1",
    TORCH_COMPILE_DISABLE="1",
)
out = sys.stdout.buffer
sys.stdout = sys.stderr
sys.path[:] = [p for p in sys.path if not (Path(p) / "comfy" / "model_management.py").is_file()]
sys.path[:0] = [str(root / "deps"), str(root / "ComfyUI")]
import comfy.options

comfy.options.enable_args_parsing()
sys.argv = [
    sys.argv[0],
    "--disable-comfy-compiler",
    "--disable-fast-disk",
    "--disable-dynamic-vram",
    "--disable-api-nodes",
    "--preview-method",
    "none",
]
import torch, nodes, folder_paths
from comfy_extras.nodes_qwen import TextEncodeQwenImage21
from PIL import Image
import numpy as np

for name, directory in [
    ("diffusion_models", "diffusion_models"),
    ("text_encoders", "text_encoders"),
    ("vae", "vae"),
]:
    folder_paths.add_model_folder_path(name, str(root / "models" / directory))
spec = importlib.util.spec_from_file_location(
    "private_gguf",
    root / "ComfyUI/custom_nodes/ComfyUI-GGUF/__init__.py",
    submodule_search_locations=[str(root / "ComfyUI/custom_nodes/ComfyUI-GGUF")],
)
gguf = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = gguf
spec.loader.exec_module(gguf)


# Prompt is not read until imports finish and write/network guards are installed.
def guard(event, args):
    if event == "open":
        mode = args[1]
        flags = args[2] or 0
        if (isinstance(mode, str) and any(c in mode for c in "wax+")) or flags & (
            os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND
        ):
            raise PermissionError("Private image engine blocks file writes")
    if event in (
        "os.remove",
        "os.rename",
        "os.mkdir",
        "os.rmdir",
        "os.system",
        "subprocess.Popen",
        "socket.connect",
        "socket.bind",
    ):
        raise PermissionError("Private image engine blocks mutation and network")


sys.addaudithook(guard)
request = json.loads(sys.stdin.buffer.readline())
if request.get("probe"):
    blocked = False
    try:
        open(root / "output/private-guard-test.txt", "w")
    except PermissionError:
        blocked = True
    out.write(json.dumps({"ready": True, "writeBlocked": blocked}).encode())
    out.flush()
    sys.exit(0)
prompt = request["prompt"]
resolution = int(request.get("resolution", 1024))
steps = int(request.get("steps", 25))
seed = int(request["seed"])
if (
    not isinstance(prompt, str)
    or not 0 < len(prompt) <= 8000
    or resolution not in (512, 768, 1024)
    or not 1 <= steps <= 40
):
    raise ValueError("Invalid input")
with torch.inference_mode():
    model = gguf.NODE_CLASS_MAPPINGS["UnetLoaderGGUF"]().load_unet("qwen-image-2.1-Q4_K_M.gguf")[0]
    clip = nodes.CLIPLoader().load_clip("qwen3vl_8b_int8_convrot.safetensors", "qwen_image", "cpu")[0]
    vae = nodes.VAELoader().load_vae("qwen_image_2.1_vae_bf16.safetensors")[0]
    encoded = TextEncodeQwenImage21.execute(clip, prompt, "", vae=vae, resolution=resolution)
    positive, negative, latent = encoded.result
    samples = nodes.KSampler().sample(
        model, seed, steps, 1, "euler", "simple", positive, negative, latent, 1
    )[0]
    pixels = nodes.VAEDecode().decode(vae, samples)[0][0]
    image = Image.fromarray(np.clip(pixels.cpu().numpy() * 255, 0, 255).astype(np.uint8))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    out.write(
        json.dumps(
            {
                "png": base64.b64encode(buffer.getvalue()).decode(),
                "width": image.width,
                "height": image.height,
            }
        ).encode()
    )
    out.flush()
