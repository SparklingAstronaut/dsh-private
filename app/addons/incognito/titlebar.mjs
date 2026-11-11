// Runs only inside the native titlebar, and holds no chat or password data.
// productName is "DSH Private", or with the strict-mode label when the app runs in strict mode.
export function installTitlebar(active = true, productName = "DSH Private") {
  const render = () => {
    active = true;
    const product = document.querySelector(".dshDesktopFrameProduct");
    if (product && product.textContent !== productName) product.textContent = productName;
    document
      .querySelectorAll(
        ".dshDesktopFrameVersion,.dshDesktopVersionCheckButton,.dshDesktopRemoteControl,.dshDesktopSettingsHeaderButton,.dshDesktopNativeActionMenuAnchor,.dshDesktopActionMenu,.dshDesktopTitlebarIconButton",
      )
      .forEach((e) => {
        e.style.display = "none";
      });
    const anchor = document.querySelector(
      ".dshDesktopFrameIdentity .dshDesktopFrameMode:not(#dsh-incognito-entry)",
    );
    if (!anchor) return;
    let button = document.getElementById("dsh-incognito-entry");
    if (!button) {
      button = document.createElement("button");
      button.id = "dsh-incognito-entry";
      button.type = "button";
      button.className = anchor.className;
      button.onclick = () => console.debug("DSH_OPEN_INCOGNITO_LOCAL");
      anchor.insertAdjacentElement("afterend", button);
    }
    const label = "退出 DSH Private";
    if (button.textContent !== label) button.textContent = label;
    button.title = "退出 DSH Private (Ctrl+Shift+N)";
    button.setAttribute("aria-pressed", String(active));
    // Native presentation switching restarts DSH; it cannot preserve this private view.
    anchor.style.display = active ? "none" : "";
    document.querySelectorAll(".dshDesktopModePopover").forEach((p) => {
      p.style.display = active ? "none" : "";
    });
  };
  window.dshSetPrivateTitlebar = (value) => {
    active = !!value;
    render();
  };
  window.dshPrivateTitlebarObserver?.disconnect();
  window.dshPrivateTitlebarObserver = new MutationObserver(render);
  render();
  window.dshPrivateTitlebarObserver.observe(document.body, { childList: true, subtree: true });
}
