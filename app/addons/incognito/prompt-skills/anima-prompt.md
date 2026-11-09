---
name: anima-prompt
description: 把用户的中文或英文描述改写成适合 Anima（二次元模型）的生图提示词，并给出图片工作台里画师、LoRA、尺寸的建议。用户输入 /anima-prompt 加一段描述时使用。
whenToUse: 用户想用 Anima 工作流出图、要求写/改 Anima 提示词，或输入 /anima-prompt 时。
---

# Anima 提示词改写

把用户在 `/anima-prompt` 后面写的描述（中文或英文都可以）改写成 Anima 最容易理解的提示词。只改写，不要自己调用出图，除非用户明确说"直接画"。

## Anima 的生图逻辑（改写时遵守）

1. **以 Danbooru 标签为主**：英文小写、逗号分隔、下划线改成空格（`long_hair` → `long hair`）。可以在标签后面补一两句简短的英文自然语言，描述标签难以表达的关系或氛围。
2. **标签顺序**（从重要到次要）：
   人数（`1girl` / `2girls` / `1boy` / `solo`）→ 角色名与作品名（如有）→ 外貌（发色、发型、瞳色、体型）→ 服装与配饰 → 表情与动作 → 构图与镜头（`upper body` `cowboy shot` `full body` `from side` `from above` `close-up` `looking at viewer`）→ 场景与背景 → 光线与时间（`sunset` `backlighting` `rim light` `night`）→ 画面气氛。
3. **不要写质量词**：`masterpiece, best quality, score_9, absurdres…` 这些工作台会自动加在最前面，重复写反而会挤占权重。
4. **不要写负面提示词**：负面词由工作台模板固定提供。
5. **画师不要写进正文**：画师统一放在工作台的"画师混合"栏，格式 `@画师名, @画师名`。如果用户提到画风/画师，在建议里列出来。
6. **少用权重语法**：尽量不用 `(tag:1.3)`；需要强调就把标签放靠前或用更具体的标签。
7. **具体胜过笼统**：`red scarf, white collared shirt, dark blue necktie` 比 `nice clothes` 好；颜色、材质、数量要写清楚。
8. **长度**：一般 15–40 个标签，加不超过两句自然语言。
9. 用户没说的细节可以合理补全，但不要改变用户明确说的内容。

## 输出格式（严格按这个来）

**提示词**（直接复制到图片工作台的描述框）：

```
<改写后的英文提示词>
```

**中文对照**：一句话说明这段提示词画的是什么。

**工作台建议**：
- 工作流：Anima
- 画师混合：`@xxx, @yyy`（用户没提画风就写"留空"）
- 尺寸：竖图 832×1216 ／ 横图 1216×832 ／ 方图 1024×1024（按画面选一个）
- LoRA（只在用得上时提，默认已勾选的四个保持不动）：
  - 偏写实质感：Semi-R_style_by_Volnovik_v2 调高到 0.8–1.0、RealSkin SliderV2 0.5、@skintextureV1 0.4、real skin.baka.v1 0.4
  - 细节/清晰度：anima_context_detailer_base10 0.35、anima-highres-aesthetic-boost 0.35
  - 风景与背景：Scenery_enchancer-Anima-P3 0.6、anima-base-1-photo-background-v4 0.6
  - 光影：anima-base-1-light-concepts-v31 0.5；偏色修正：Anima_colorfix_v1_by_Volnovik 0.5
- 如果是改图：说明该用"LLLite 参考图控制"（保留构图换内容）还是"LLLite 局部重绘"（只改蒙版区域，修改幅度 1）。

如果用户的描述太短或有歧义，先按最合理的理解写出一版，再在最后用一句话问要不要调整哪一点。
