(() => {
  const existing = document.getElementById("dsh-private-images");
  if (existing) {
    if (window.__dshPrivateImagesTab === "gallery") existing.__showGallery?.();
    delete window.__dshPrivateImagesTab;
    return;
  }
  const startTab = window.__dshPrivateImagesTab === "gallery" ? "gallery" : "work";
  delete window.__dshPrivateImagesTab;
  const element = (tag, text) => {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    return e;
  };
  const dialog = element("dialog");
  dialog.id = "dsh-private-images";
  const style = element("style");
  style.textContent = `#dsh-private-images{font:14px/1.5 system-ui;color:#eee;background:#222226;border:1px solid #555;border-radius:18px;padding:24px;width:850px;max-width:calc(100vw - 64px);max-height:88vh;overflow:auto}#dsh-private-images::backdrop{background:#0009}#dsh-private-images h2{margin:0}#dsh-private-images p{color:#bbb}#dsh-private-images button,#dsh-private-images select,#dsh-private-images input,#dsh-private-images textarea{font:inherit;color:inherit;background:#303036;border:1px solid #606069;border-radius:8px;padding:8px}#dsh-private-images button{cursor:pointer}#dsh-private-images button:disabled{opacity:.5;cursor:default}#dsh-private-images textarea{box-sizing:border-box;width:100%;min-height:100px;resize:vertical}#dsh-private-images .row{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0;align-items:center}#dsh-private-images label{display:flex;gap:6px;align-items:center}#dsh-private-images input[type=number]{width:82px}#dsh-private-images .gallery{display:grid;gap:8px;max-height:220px;overflow:auto}#dsh-private-images .item{display:flex;gap:10px;align-items:center;padding:8px;background:#29292e;border-radius:8px}#dsh-private-images .item span{flex:1}#dsh-private-images img{display:block;max-width:100%;max-height:420px;margin:16px auto;border-radius:10px}#dsh-private-images img[hidden]{display:none}#dsh-private-images .status{min-height:24px;overflow-wrap:anywhere}#dsh-private-images .tabs{display:flex;gap:8px;margin:12px 0 4px}#dsh-private-images .tabs button[aria-selected=true]{background:#4a4f6a;border-color:#8a90b8}#dsh-private-images .pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:8px 0 18px}#dsh-private-images .ptile{padding:0;overflow:hidden;background:#29292e;border-radius:10px;text-align:left}#dsh-private-images .ptile img{width:100%;aspect-ratio:1/1;object-fit:cover;max-height:none;margin:0;border-radius:0;background:#1b1b1f}#dsh-private-images .ptile span{display:block;padding:6px 8px;font-size:12px;color:#bbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#dsh-private-images h3{margin:14px 0 4px;font-size:14px;color:#ddd}#dsh-private-images .viewer img{max-height:60vh;cursor:zoom-in}#dsh-private-images .lightbox{position:fixed;inset:0;z-index:10;background:#000e;display:flex;flex-direction:column}#dsh-private-images .lightbox[hidden]{display:none}#dsh-private-images .lightbox .bar{display:flex;gap:8px;align-items:center;padding:10px 14px;background:#111}#dsh-private-images .lightbox .bar span{flex:1;color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#dsh-private-images .lightbox .stage{flex:1;overflow:auto;display:flex}#dsh-private-images .lightbox .stage img{margin:auto;max-width:100%;max-height:100%;border-radius:0;cursor:zoom-in;object-fit:contain}#dsh-private-images .lightbox .stage.actual img{max-width:none;max-height:none;cursor:zoom-out}#dsh-private-images .lora-off{opacity:.55}#dsh-private-images .lora-off span::after{content:attr(data-note);margin-left:6px;font-size:12px;color:#c9a96b}#dsh-private-images button.danger{border-color:#a55}`;
  const title = element("h2", "无痕图片工作台"),
    hint = element("p", "导入和生成的图片先临时加密保存。点击“保存聊天”后才会保留；原始导入文件不会被修改。");
  const controls = element("div");
  controls.className = "row";
  const workflow = element("select");
  workflow.setAttribute("aria-label", "图片工作流");
  const fidelity = element("select");
  fidelity.setAttribute("aria-label", "模型版本");
  fidelity.hidden = true;
  const mask = element("select");
  mask.setAttribute("aria-label", "蒙版图片");
  mask.disabled = true;
  mask.append(element("option", "不使用蒙版"));
  mask.options[0].value = "";
  controls.append(workflow, fidelity, mask);
  const prompt = element("textarea");
  prompt.placeholder = "描述你想生成或修改的图片…";
  prompt.maxLength = 8000;
  prompt.setAttribute("aria-label", "图片描述");
  const advanced = element("details"),
    summary = element("summary", "尺寸与采样设置");
  advanced.append(summary);
  const fields = element("div");
  fields.className = "row";
  advanced.append(fields);
  const numbers = {};
  for (const [key, label, value] of [
    ["width", "宽", 1024],
    ["height", "高", 1024],
    ["seed", "种子", -1],
    ["steps", "步数", 25],
    ["cfg", "引导强度", 4],
    ["denoise", "修改幅度", 0.7],
  ]) {
    const wrap = element("label", label),
      input = element("input");
    input.type = "number";
    input.value = value;
    input.step = ["cfg", "denoise"].includes(key) ? "0.1" : "1";
    numbers[key] = input;
    wrap.append(input);
    fields.append(wrap);
  }
  // Workflow-specific options are declared by the image plugin (catalog row.parameters).
  const optionRow = element("div");
  optionRow.className = "row";
  optionRow.hidden = true;
  let optionInputs = {};
  function renderOptions(row) {
    optionRow.replaceChildren();
    optionInputs = {};
    for (const spec of Array.isArray(row?.parameters) ? row.parameters : []) {
      if (typeof spec?.key !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(spec.key)) continue;
      const label = String(spec.label ?? spec.key);
      let input;
      if (spec.type === "select") {
        input = element("select");
        for (const choice of Array.isArray(spec.options) ? spec.options : []) {
          const option = element("option", String(choice?.label ?? choice?.value ?? ""));
          option.value = String(choice?.value ?? "");
          input.append(option);
        }
        input.value = String(spec.default ?? input.options[0]?.value ?? "");
      } else {
        input = element("input");
        input.type = spec.type === "checkbox" ? "checkbox" : spec.type === "number" ? "number" : "text";
        if (input.type === "checkbox") input.checked = spec.default === true;
        else input.value = spec.default ?? "";
        for (const key of ["step", "min", "max"]) if (spec[key] !== undefined) input[key] = String(spec[key]);
        if (input.type === "text") {
          input.maxLength = Math.min(Number(spec.maxLength) || 1000, 2000);
          input.placeholder = String(spec.placeholder ?? "");
        }
      }
      input.setAttribute("aria-label", label);
      const wrap = element("label", label);
      if (input.type === "checkbox") wrap.prepend(input);
      else wrap.append(input);
      if (input.type === "text") wrap.style.flex = "1 1 100%";
      optionInputs[spec.key] = input;
      optionRow.append(wrap);
    }
    optionRow.hidden = !Object.keys(optionInputs).length;
  }
  const actionRow = element("div");
  actionRow.className = "row";
  const importButton = element("button", "导入图片"),
    generate = element("button", "生成"),
    stop = element("button", "停止"),
    save = element("button", "保存聊天"),
    refreshButton = element("button", "刷新"),
    close = element("button", "关闭");
  actionRow.append(importButton, generate, stop, save, refreshButton, close);
  const loraPanel = element("details"),
    loraTitle = element("summary", "LoRA 模型与权重"),
    loraRows = element("div");
  loraRows.className = "gallery";
  loraPanel.append(loraTitle, loraRows);
  const status = element("p");
  status.className = "status";
  status.setAttribute("role", "status");
  const gallery = element("div");
  gallery.className = "gallery";
  const preview = element("img");
  preview.hidden = true;
  preview.alt = "当前图片预览";
  let sessionId,
    url,
    disposed = false,
    working = false,
    loading = false,
    catalog;
  const references = new Map(),
    loraChoices = new Map();
  const call = async (method, args = {}) => {
    const response = await window.incognito.call(method, {
      ...args,
      ...(sessionId ? { expectedSessionId: sessionId } : {}),
    });
    if (!response.ok) throw Error(response.error);
    return response.value;
  };
  const message = (error) => {
    if (!disposed) status.textContent = error.message || String(error);
  };
  const rowsFor = (id) => (catalog?.workflows ?? []).filter((row) => row?.id === id);
  const rowFor = (id) => {
    const rows = rowsFor(id);
    return rows.find((row) => row.fidelity === fidelity.value) ?? rows[0];
  };
  const currentRow = () => rowFor(workflow.value);
  const blocked = () => {
    const row = currentRow();
    return !row || row.selectable === false;
  };
  const buttons = (busy) => {
    working = busy;
    generate.disabled = busy || blocked();
    importButton.disabled = busy;
    save.disabled = busy;
    stop.disabled = !busy;
  };
  function availability() {
    buttons(working);
    for (const option of workflow.options) option.disabled = rowFor(option.value)?.selectable === false;
    for (const [key, item] of loraChoices) {
      // Checkboxes and weights stay editable; LoRAs that don't serve the current workflow are
      // only greyed and labelled, and are skipped (with a notice) when generating.
      const serves = loraServes(item.asset);
      item.box.disabled = item.asset.selectable === false;
      item.weight.disabled = item.box.disabled;
      item.row.classList.toggle("lora-off", !serves);
      item.label.dataset.note = serves ? "" : "（" + loraWhere(item.asset) + "）";
    }
    if (!catalog?.workflows?.length)
      status.textContent = "没有可用的无痕生图工作流。请先安装支持无痕模式的生图插件。";
    else if (blocked()) status.textContent = "此工作流缺少精确模型或编译条件，暂时不能生成。";
  }
  const workflowLabel = (id) => rowsFor(id).find((row) => typeof row.label === "string")?.label || id;
  function loraWorkflows(asset) {
    return asset.workflows ?? (asset.workflow ? [asset.workflow] : []);
  }
  function loraServes(asset) {
    return loraWorkflows(asset).includes(workflow.value);
  }
  function loraWhere(asset) {
    const names = loraWorkflows(asset).map(workflowLabel);
    return names.length ? "仅适用于 " + names.join(" / ") : "当前不可用";
  }
  let renderedWorkflow = null;
  function workflowChanged() {
    const row = currentRow();
    if (workflow.value !== renderedWorkflow) {
      renderedWorkflow = workflow.value;
      renderOptions(row);
      for (const [key, value] of Object.entries(row?.defaults ?? {}))
        if (numbers[key] && Number.isFinite(Number(value))) numbers[key].value = value;
    }
    mask.disabled = row?.mask !== true;
    if (mask.disabled) mask.value = "";
  }
  function renderWorkflowChoices() {
    const previous = workflow.value,
      previousProfile = fidelity.value;
    const ids = [
      ...new Set((catalog?.workflows ?? []).map((row) => row?.id).filter((id) => typeof id === "string")),
    ];
    workflow.replaceChildren(
      ...ids.map((id) => {
        const option = element("option", workflowLabel(id));
        option.value = id;
        return option;
      }),
    );
    if (ids.includes(previous)) workflow.value = previous;
    const profiles = new Map();
    for (const row of catalog?.workflows ?? [])
      if (typeof row?.fidelity === "string" && !profiles.has(row.fidelity))
        profiles.set(row.fidelity, typeof row.fidelityLabel === "string" ? row.fidelityLabel : row.fidelity);
    fidelity.replaceChildren(
      ...[...profiles].map(([id, label]) => {
        const option = element("option", label);
        option.value = id;
        return option;
      }),
    );
    if (profiles.has(previousProfile)) fidelity.value = previousProfile;
    fidelity.hidden = profiles.size < 2;
    workflowChanged();
  }
  workflow.onchange = () => {
    workflowChanged();
    availability();
  };
  fidelity.onchange = () => {
    workflowChanged();
    availability();
  };
  async function show(resultId, index) {
    if (loading) return;
    loading = true;
    try {
      const image = await call("studio-preview", { resultId, index });
      if (disposed) return;
      const bytes = Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0));
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob([bytes], { type: image.mime }));
      preview.src = url;
      preview.hidden = false;
      openViewer(url, "当前聊天 · 图片预览");
    } catch (error) {
      message(error);
    } finally {
      loading = false;
    }
  }
  // Full-window viewer inside the modal dialog (the dialog is in the top layer, so it must
  // live inside it). Click the image to toggle fit / actual size; Esc or 关闭 closes only it.
  const lightbox = element("div");
  lightbox.className = "lightbox";
  lightbox.hidden = true;
  const lbBar = element("div");
  lbBar.className = "bar";
  const lbTitle = element("span"),
    lbFit = element("button", "原始大小"),
    lbClose = element("button", "关闭预览");
  lbBar.append(lbTitle, lbFit, lbClose);
  const lbStage = element("div");
  lbStage.className = "stage";
  const lbImg = element("img");
  lbImg.alt = "大图预览";
  lbStage.append(lbImg);
  lightbox.append(lbBar, lbStage);
  const toggleActual = () => {
    const actual = lbStage.classList.toggle("actual");
    lbFit.textContent = actual ? "适应窗口" : "原始大小";
  };
  lbImg.onclick = toggleActual;
  lbFit.onclick = toggleActual;
  lbStage.onclick = (event) => {
    if (event.target === lbStage) closeViewer();
  };
  function openViewer(src, label) {
    lbImg.src = src;
    lbTitle.textContent = label || "";
    lbStage.classList.remove("actual");
    lbFit.textContent = "原始大小";
    lightbox.hidden = false;
    lbClose.focus();
  }
  function closeViewer() {
    lightbox.hidden = true;
    lbImg.removeAttribute("src");
  }
  lbClose.onclick = closeViewer;
  // Two-step confirm without native dialogs (they block the private window's renderer).
  function confirmButton(button, text, action) {
    let armed = null;
    const original = button.textContent;
    button.onclick = async () => {
      if (!armed) {
        button.textContent = text;
        armed = setTimeout(() => {
          armed = null;
          button.textContent = original;
        }, 4000);
        return;
      }
      clearTimeout(armed);
      armed = null;
      button.textContent = original;
      await action();
    };
  }
  async function removeImage(args, label) {
    buttons(true);
    try {
      const result = await call("studio-delete", args);
      if (disposed) return;
      closeViewer();
      status.textContent =
        result.deleted === "saved"
          ? `已从加密存储中永久删除${label}。`
          : `已丢弃${label}（未保存的临时图片）。`;
      for (const key of [...references.keys()])
        if (args.resultId && key.startsWith(args.resultId + ":")) references.delete(key);
      await refresh();
      return result;
    } catch (error) {
      message(error);
      throw error;
    } finally {
      if (!disposed) buttons(false);
    }
  }
  async function refresh() {
    const state = await call("studio-state");
    if (disposed) return;
    sessionId = state.sessionId;
    catalog = state.catalog;
    renderWorkflowChoices();
    buttons(state.busy);
    loraRows.replaceChildren();
    const previousLoras = new Map(
      [...loraChoices].map(([key, item]) => [key, { checked: item.box.checked, value: item.weight.value }]),
    );
    loraChoices.clear();
    for (const asset of catalog?.loras || []) {
      const choiceKey = asset.assetId + ":" + asset.name;
      const row = element("div");
      row.className = "item";
      const box = element("input");
      box.type = "checkbox";
      box.checked = previousLoras.has(choiceKey) ? previousLoras.get(choiceKey).checked : !!asset.recommended;
      box.setAttribute("aria-label", asset.name);
      const label = element("span", asset.name),
        weight = element("input");
      weight.type = "number";
      weight.step = "0.1";
      weight.min = asset.strengthRange[0];
      weight.max = asset.strengthRange[1];
      weight.value = previousLoras.get(choiceKey)?.value || String(asset.defaultStrength ?? 1);
      weight.setAttribute("aria-label", asset.name + " 权重");
      loraChoices.set(choiceKey, { asset, box, weight, row, label });
      box.onchange = () => {
        if (box.checked && !loraServes(asset))
          status.textContent = `“${asset.name}” ${loraWhere(asset)}；当前工作流生成时会跳过它。`;
        availability();
      };
      row.append(box, label, weight);
      loraRows.append(row);
    }
    if (!catalog?.loras?.length) loraRows.append(element("p", "没有可选择的 LoRA 登记。"));
    availability();
    gallery.replaceChildren();
    const previousMask = mask.value;
    mask.replaceChildren(element("option", "不使用蒙版"));
    mask.options[0].value = "";
    const present = new Set();
    for (const [position, image] of state.images.entries())
      for (let index = 0; index < image.count; index++) {
        const key = image.resultId + ":" + index;
        present.add(key);
        const maskOption = element("option", `蒙版：图片 ${position + 1}-${index + 1}`);
        maskOption.value = key;
        mask.append(maskOption);
        const row = element("div");
        row.className = "item";
        const box = element("input");
        box.type = "checkbox";
        box.checked = references.has(key);
        box.setAttribute("aria-label", `图片 ${position + 1}-${index + 1} 用作参考`);
        box.onchange = () => {
          if (box.checked) references.set(key, { resultId: image.resultId, index });
          else references.delete(key);
        };
        const text = element(
            "span",
            `图片 ${position + 1}${image.count > 1 ? "-" + (index + 1) : ""} · ${image.saved ? "已保存" : "未保存"}`,
          ),
          view = element("button", "预览");
        view.onclick = () => show(image.resultId, index);
        const drop = element("button", "删除");
        drop.className = "danger";
        drop.title = image.count > 1 ? "同一次生成的 " + image.count + " 张会一起删除" : "删除这张图片";
        confirmButton(drop, image.saved ? "确认永久删除？" : "确认丢弃？", () =>
          removeImage({ resultId: image.resultId }, `图片 ${position + 1}`).catch(() => {}),
        );
        row.append(box, text, view, drop);
        gallery.append(row);
      }
    if (present.has(previousMask)) mask.value = previousMask;
    for (const key of references.keys()) if (!present.has(key)) references.delete(key);
    if (!state.images.length) gallery.append(element("p", "还没有图片。可先导入，或输入描述生成。"));
  }
  importButton.onclick = async () => {
    buttons(true);
    try {
      await call("studio-import");
      if (!disposed) {
        status.textContent = "导入完成；勾选图片可用作参考。";
        await refresh();
      }
    } catch (error) {
      message(error);
    } finally {
      if (!disposed) buttons(false);
    }
  };
  generate.onclick = async () => {
    if (!prompt.value.trim()) {
      status.textContent = "请填写图片描述。";
      return;
    }
    const row = currentRow(),
      keepsInputSize = row?.keepsInputSize === true;
    const request = {
      prompt: prompt.value,
      studio_workflow: workflow.value,
      references: [...references.values()],
    };
    if (typeof row?.fidelity === "string") request.fidelity_profile = row.fidelity;
    const checkedLoras = [...loraChoices.values()].filter((item) => item.box.checked && !item.box.disabled),
      skippedLoras = checkedLoras.filter((item) => !loraServes(item.asset));
    request.loras = checkedLoras
      .filter((item) => loraServes(item.asset))
      .map((item) => ({ assetId: item.asset.assetId, strengthModel: Number(item.weight.value) }));
    const badWeight = request.loras.find((item) => !Number.isFinite(item.strengthModel));
    if (badWeight) {
      status.textContent = "LoRA 权重必须是数字。";
      return;
    }
    if (mask.value && row?.mask === true) {
      const [resultId, index] = mask.value.split(":");
      request.maskReference = { resultId, index: Number(index) };
    }
    for (const [key, input] of Object.entries(numbers))
      if (!keepsInputSize || key === "seed") request[key] = Number(input.value);
    const parameters = {};
    for (const [key, input] of Object.entries(optionInputs)) {
      if (input.type === "checkbox") parameters[key] = input.checked;
      else if (input.type === "number") parameters[key] = Number(input.value);
      else if (input.value.trim()) parameters[key] = input.value.trim();
    }
    if (Object.keys(parameters).length) request.parameters = parameters;
    buttons(true);
    status.textContent = "正在生成；模型加载可能需要几分钟。";
    try {
      const result = await call("studio-generate", { request });
      if (disposed) return;
      await refresh();
      await show(result.resultId, 0);
      status.textContent =
        result.resourceRecovery?.ok === false
          ? "图片已生成，但模型恢复失败，请先处理恢复问题。"
          : "已生成。点击“保存聊天”后会保留。" +
            (skippedLoras.length
              ? `（已跳过不适用于当前工作流的 LoRA：${skippedLoras.map((item) => item.asset.name).join("、")}）`
              : "");
    } catch (error) {
      message(error);
    } finally {
      if (!disposed) buttons(false);
    }
  };
  stop.onclick = async () => {
    try {
      await call("studio-cancel");
      status.textContent = "已请求停止，正在清理…";
    } catch (error) {
      message(error);
    }
  };
  save.onclick = async () => {
    buttons(true);
    try {
      await call("studio-save");
      await refresh();
      status.textContent = "当前聊天及图片已加密保存。";
    } catch (error) {
      message(error);
    } finally {
      if (!disposed) buttons(false);
    }
  };
  refreshButton.onclick = () => refresh().catch(message);
  const dispose = () => {
    disposed = true;
    if (url) URL.revokeObjectURL(url);
    observer.disconnect();
    for (const u of thumbs.values()) URL.revokeObjectURL(u);
    thumbs.clear();
    gImg.removeAttribute("src");
    prompt.value = "";
    preview.removeAttribute("src");
    references.clear();
    closeViewer();
    dialog.remove();
  };
  close.onclick = dispose;
  // Esc closes the big preview first; only a second Esc closes the workbench.
  dialog.addEventListener("cancel", (event) => {
    if (!lightbox.hidden) {
      event.preventDefault();
      closeViewer();
      return;
    }
    dispose();
  });
  // Keep typing inside the workbench from reaching the chat page's shortcuts.
  for (const type of ["keydown", "keyup", "keypress"])
    dialog.addEventListener(type, (event) => {
      if (event.key !== "Escape") event.stopPropagation();
    });
  preview.style.cursor = "zoom-in";
  preview.onclick = () => {
    if (preview.src) openViewer(preview.src, "当前聊天 · 图片预览");
  };
  // Encrypted private gallery: saved images from every saved private chat plus this chat's
  // own (saved and unsaved) images. Bytes are decrypted on demand and only held as blob URLs.
  const tabs = element("div");
  tabs.className = "tabs";
  tabs.setAttribute("role", "tablist");
  const tabWork = element("button", "工作台"),
    tabGallery = element("button", "无痕画廊");
  for (const b of [tabWork, tabGallery]) b.setAttribute("role", "tab");
  tabs.append(tabWork, tabGallery);
  const workPane = element("div"),
    galleryPane = element("div");
  galleryPane.hidden = true;
  const gHint = element(
    "p",
    "这里只显示已加密保存的无痕图片，以及当前聊天里的图片（含未保存）。图片仅在本窗口内临时解密显示，不会写到普通画廊或磁盘。",
  );
  const gStatus = element("p");
  gStatus.className = "status";
  gStatus.setAttribute("role", "status");
  const gList = element("div");
  const gView = element("div");
  gView.className = "viewer";
  gView.hidden = true;
  const gImg = element("img");
  gImg.alt = "无痕画廊图片";
  const gInfo = element("p");
  const gRow = element("div");
  gRow.className = "row";
  const gUse = element("button", "用作参考图（回到工作台）"),
    gBack = element("button", "返回画廊"),
    gBig = element("button", "查看大图"),
    gDelete = element("button", "删除");
  gDelete.className = "danger";
  gRow.append(gUse, gBig, gDelete, gBack);
  gView.append(gRow, gInfo, gImg);
  gImg.onclick = () => {
    if (gImg.src) openViewer(gImg.src, gInfo.textContent);
  };
  gBig.onclick = gImg.onclick;
  galleryPane.append(gHint, gStatus, gView, gList);
  const thumbs = new Map();
  let galleryToken = 0,
    selected = null;
  const observer = new IntersectionObserver(
    (items) => {
      for (const item of items)
        if (item.isIntersecting) {
          observer.unobserve(item.target);
          item.target.__load?.();
        }
    },
    { root: dialog, rootMargin: "300px" },
  );
  const toUrl = (image) => {
    const bytes = Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: image.mime }));
  };
  async function imageUrl(item) {
    let value = thumbs.get(item.key);
    if (!value) {
      const image = await item.fetch();
      if (disposed) throw Error("closed");
      value = thumbs.get(item.key) || toUrl(image);
      thumbs.set(item.key, value);
    }
    return value;
  }
  function tile(item) {
    const button = element("button");
    button.className = "ptile";
    button.title = item.label;
    const img = element("img");
    img.alt = item.label;
    const caption = element("span", item.label);
    button.append(img, caption);
    button.__load = () =>
      imageUrl(item).then(
        (u) => {
          img.src = u;
        },
        (e) => {
          if (!disposed) caption.textContent = "无法读取：" + (e.message || e);
        },
      );
    observer.observe(button);
    button.onclick = () => openItem(item);
    return button;
  }
  async function openItem(item) {
    selected = item;
    gView.hidden = false;
    gInfo.textContent = item.label;
    gImg.removeAttribute("src");
    gView.scrollIntoView?.({ block: "start" });
    try {
      gImg.src = await imageUrl(item);
    } catch (e) {
      message2(e);
    }
  }
  const message2 = (e) => {
    if (!disposed) gStatus.textContent = e.message || String(e);
  };
  async function loadGallery() {
    const token = ++galleryToken;
    gStatus.textContent = "正在读取加密画廊…";
    gList.replaceChildren();
    gView.hidden = true;
    selected = null;
    try {
      const [state, data] = await Promise.all([call("studio-state"), call("studio-gallery")]);
      if (disposed || token !== galleryToken) return;
      sessionId = state.sessionId;
      const groups = [];
      const current = [];
      for (const [position, image] of state.images.entries())
        for (let index = 0; index < image.count; index++)
          current.push({
            key: "cur:" + image.resultId + ":" + index,
            label: `当前聊天 · 图片 ${position + 1}${image.count > 1 ? "-" + (index + 1) : ""} · ${image.saved ? "已保存" : "未保存"}`,
            local: { resultId: image.resultId, index },
            fetch: () => call("studio-preview", { resultId: image.resultId, index }),
          });
      if (current.length) groups.push({ title: "当前聊天", items: current });
      for (const chat of data.chats) {
        if (chat.sessionId === state.sessionId) continue;
        const title = chat.title || "未命名的无痕聊天";
        groups.push({
          title,
          items: chat.items.map((it, i) => ({
            key: "saved:" + it.revision + ":" + it.assetId,
            label: `${title} · 图片 ${i + 1}`,
            saved: { revision: it.revision, assetId: it.assetId },
            fetch: () => call("studio-gallery-preview", { revision: it.revision, assetId: it.assetId }),
          })),
        });
      }
      let total = 0;
      for (const group of groups) {
        total += group.items.length;
        const grid = element("div");
        grid.className = "pgrid";
        for (const item of group.items) grid.append(tile(item));
        gList.append(element("h3", `${group.title}（${group.items.length}）`), grid);
      }
      gStatus.textContent = total
        ? `共 ${total} 张图片。点击查看大图，可用作当前聊天的参考图。`
        : "还没有已保存的无痕图片。在工作台生成后点击“保存聊天”即可加密保存到这里。";
    } catch (e) {
      message2(e);
    }
  }
  gBack.onclick = () => {
    gView.hidden = true;
    selected = null;
  };
  confirmButton(gDelete, "确认永久删除？", async () => {
    const item = selected;
    if (!item) return;
    gDelete.disabled = true;
    try {
      const args = item.local ? { resultId: item.local.resultId } : item.saved;
      const result = await call("studio-delete", args);
      if (disposed) return;
      const u = thumbs.get(item.key);
      if (u) {
        URL.revokeObjectURL(u);
        thumbs.delete(item.key);
      }
      closeViewer();
      await loadGallery();
      gStatus.textContent =
        result.deleted === "saved" ? "已从加密存储中永久删除这张图片。" : "已丢弃这张未保存的图片。";
      refresh().catch(message);
    } catch (e) {
      message2(e);
    } finally {
      gDelete.disabled = false;
    }
  });
  gUse.onclick = async () => {
    const item = selected;
    if (!item) return;
    gUse.disabled = true;
    try {
      let ref = item.local;
      if (!ref) {
        gStatus.textContent = "正在把图片复制到当前聊天（加密临时保存）…";
        const result = await call("studio-gallery-use", item.saved);
        ref = { resultId: result.resultId, index: 0 };
      }
      references.set(ref.resultId + ":" + ref.index, ref);
      showTab("work");
      await refresh();
      status.textContent =
        "已勾选为参考图。可选择参考图编辑、放大等工作流后生成；需保存聊天才会保留这张副本。";
    } catch (e) {
      message2(e);
    } finally {
      gUse.disabled = false;
    }
  };
  function showTab(name) {
    const gallery = name === "gallery";
    workPane.hidden = gallery;
    galleryPane.hidden = !gallery;
    tabWork.setAttribute("aria-selected", String(!gallery));
    tabGallery.setAttribute("aria-selected", String(gallery));
    if (gallery) loadGallery();
  }
  tabWork.onclick = () => showTab("work");
  tabGallery.onclick = () => showTab("gallery");
  dialog.__showGallery = () => showTab("gallery");
  const note = element(
    "p",
    "勾选图片作为参考。需要蒙版的工作流请使用带透明通道的 PNG，透明区域为修改区域。缺少模型的工作流会显示为不可用；关闭面板不会停止正在运行的任务。",
  );
  workPane.append(
    hint,
    controls,
    prompt,
    optionRow,
    advanced,
    loraPanel,
    actionRow,
    status,
    note,
    gallery,
    preview,
  );
  dialog.append(style, title, tabs, workPane, galleryPane, lightbox);
  document.body.append(dialog);
  dialog.showModal();
  buttons(true);
  showTab(startTab);
  refresh().catch(message);
})();
