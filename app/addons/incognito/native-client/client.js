window.__ModuleLoader__.load({
  id: "dsh-incognito-client",
  factory: (require) => {
    const { createElement: h, Fragment, useState, useEffect, useSyncExternalStore } = require("react");
    const ui = require("@deepseek-ai/dsh-client-ui-primitives");
    // Small observable value for the toast and the delete confirmation.
    const store = (value) => {
      const listeners = new Set();
      return {
        get: () => value,
        set: (next) => {
          value = next;
          for (const listener of listeners) listener();
        },
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      };
    };
    const useStore = (s) => useSyncExternalStore(s.subscribe, s.get);
    const Button = ({ variant, style, ...props }) =>
      h("button", {
        ...props,
        style: {
          border: "1px solid var(--dsw-alias-border-l1,#555)",
          borderRadius: "8px",
          background: "var(--dsw-alias-bg-layer-3,#333)",
          color: "var(--dsw-alias-label-primary,#eee)",
          cursor: "pointer",
          padding: "6px 10px",
          ...style,
        },
      });
    return {
      inject: ["uiSession", "slots", "locale"],
      apply(ctx) {
        window.dshPrivateSelection = () => ctx.uiSession.current.getSnapshot().key;
        const imageKind = "private-generated-image";
        function ImageNode(props) {
          const [url, setUrl] = useState();
          useEffect(() => {
            let alive = true,
              objectUrl;
            window.incognito
              .call(
                props.node.data.studio ? "studio-preview" : "image-read",
                props.node.data.studio
                  ? { ...props.node.data.studio, expectedSessionId: window.dshPrivateSelection?.() }
                  : { attachment: props.node.data.attachment },
              )
              .then((r) => {
                if (!r.ok || !alive) return;
                const bytes = Uint8Array.from(atob(r.value.data || r.value.png), (c) => c.charCodeAt(0));
                objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
                setUrl(objectUrl);
              });
            return () => {
              alive = false;
              if (objectUrl) URL.revokeObjectURL(objectUrl);
            };
          }, [props.node.data.attachment.attachmentId]);
          return url
            ? h(
                "figure",
                { style: { margin: "12px 0" } },
                h("img", {
                  src: url,
                  alt: "生成的图片",
                  style: {
                    display: "block",
                    maxWidth: "100%",
                    width: "512px",
                    height: "auto",
                    borderRadius: "12px",
                  },
                }),
              )
            : h("span", null, "正在载入图片…");
        }
        ctx.inject(["uiConversation"], (owner) => {
          owner.effect(() =>
            owner.get("uiConversation").events.register({
              kind: imageKind,
              target: "chat",
              match: (event) => {
                const turn = event.data?.turn;
                if (turn === undefined) return null;
                if (event.type === "turn/start") return { id: String(turn), role: "start" };
                if (
                  event.type === "turn/end" ||
                  event.type === "assistant/message" ||
                  (event.type === "tool/result" && event.data.meta?.kind === "dsh-image-gen")
                )
                  return { id: String(turn), role: "update" };
                return null;
              },
              start: (_context, match) => ({ turn: match.event.data.turn, images: [] }),
              update: (context, match) => {
                const e = match.event,
                  s = context.state;
                if (e.type === "turn/end") return { ...s, endSeq: e.seq };
                if (e.type === "assistant/message") return { ...s, answerSeq: e.seq };
                return {
                  ...s,
                  images: [
                    ...s.images,
                    { attachment: e.data.meta.attachment, studio: e.data.meta.studio, seq: e.seq },
                  ],
                };
              },
              buildViewNode: (context) => {
                const s = context.state,
                  last = s.images.at(-1);
                if (!last) return null;
                return {
                  key: context.key,
                  kind: imageKind,
                  id: context.id,
                  target: "chat",
                  anchorSeq: s.endSeq !== undefined ? (s.answerSeq ?? s.endSeq) : last.seq,
                  location: context.matches.at(-1)?.location ??
                    context.start?.location ?? { kind: "unresolved" },
                  visibility: "visible",
                  data: s,
                };
              },
            }),
          );
          owner.slots.inject("conversation.chat.node", () =>
            owner.slots.register({ name: "conversation.chat.node", key: imageKind }, (props) =>
              h(
                "div",
                null,
                ...props.node.data.images.map((item) =>
                  h(ImageNode, { key: item.attachment.attachmentId, node: { data: item } }),
                ),
              ),
            ),
          );
        });
        const call = (method) => window.incognito.call(method, {});
        ctx.slots.inject("conversation.input.left", () =>
          ctx.slots.register(
            { name: "conversation.input.left", id: "incognito-image-studio", order: 100 },
            () =>
              h(
                Button,
                {
                  "aria-label": "图片工作台",
                  title: "打开当前无痕聊天的图片工作台",
                  onClick: () => call("studio-dialog"),
                },
                "图片工作台",
              ),
          ),
        );
        window.addEventListener("pointerdown", () => call("activity"));
        window.addEventListener("keydown", () => call("activity"));
        ctx.slots.inject("settings.section", () =>
          ctx.slots.register(
            { name: "settings.section", id: "incognito", order: 15, label: () => "无痕模式" },
            () =>
              h(
                "section",
                { style: { padding: "8px 0", color: "var(--dsw-alias-label-primary)" } },
                h("h3", null, "无痕模式"),
                h(
                  "p",
                  { style: { color: "var(--dsw-alias-label-secondary)", lineHeight: 1.7 } },
                  "聊天默认不保存；手动保存的聊天会加密存储在 本机加密目录。明确执行、安装或导出的文件和修改可以保留；已启用插件、外部程序、服务及系统产生的痕迹不能保证清除。",
                ),
                h(
                  Button,
                  {
                    variant: "outline",
                    style: {
                      minHeight: "36px",
                      padding: "8px 16px",
                      borderRadius: "10px",
                      border: "1px solid var(--dsw-alias-border-l1,#5a5a60)",
                      background: "var(--dsw-alias-bg-layer-3,#3b3b3f)",
                      color: "var(--dsw-alias-label-primary)",
                      cursor: "pointer",
                    },
                    onClick: () => call("password-dialog"),
                  },
                  "修改密码",
                ),
              ),
          ),
        );
        // Save and delete live in DSH's own chat menu (the ... on each chat in the sidebar).
        const NS = "incognito";
        ctx.effect(
          () =>
            ctx.locale.register(NS, {
              zh: {
                save: "保存聊天（加密）",
                saved: "已加密保存。之后的新内容需要再次保存。",
                delete: "永久删除",
                "delete.title": "永久删除这个聊天？",
                "delete.desc": "将删除「{title}」以及它已保存的加密存档（如有），无法恢复。",
                "delete.action": "删除",
                deleting: "正在删除…",
                untitled: "新会话",
                cancel: "取消",
                close: "关闭",
                noChat: "请先打开一个聊天。",
              },
              en: {
                save: "Save chat (encrypted)",
                saved: "Saved and encrypted. Save again after further changes.",
                delete: "Delete permanently",
                "delete.title": "Delete this chat permanently?",
                "delete.desc":
                  "“{title}” and any encrypted copy you saved will be deleted. This cannot be undone.",
                "delete.action": "Delete",
                deleting: "Deleting…",
                untitled: "New chat",
                cancel: "Cancel",
                close: "Close",
                noChat: "Open a chat first.",
              },
            }),
          "incognito: dictionaries",
        );
        const toast = store(null),
          pendingDelete = store(null);
        let toastSeq = 0;
        const showToast = (value) => toast.set({ ...value, seq: ++toastSeq });
        const saveChat = (sessionId) =>
          window.incognito
            .call("chat-save", { sessionId })
            .then((r) => showToast(r.ok ? { key: "saved", tone: "success" } : { text: r.error }));
        function SaveMenuItem({ sessionId, useMenuOpenState, t }) {
          const [, setOpen] = useMenuOpenState();
          return h(
            ui.MenuItemButton,
            {
              icon: h(ui.IconShieldOutlineRegular, {}),
              onSelect: () => {
                setOpen(false);
                saveChat(sessionId);
              },
            },
            t("save"),
          );
        }
        function DeleteMenuItem({ sessionId, displayTitle, useMenuOpenState, t }) {
          const [, setOpen] = useMenuOpenState();
          return h(
            ui.MenuItemButton,
            {
              icon: h(ui.IconTrashOutlineRegular, {}),
              danger: true,
              separatorBefore: true,
              onSelect: () => {
                setOpen(false);
                pendingDelete.set({ sessionId, title: displayTitle });
              },
            },
            t("delete"),
          );
        }
        function DeleteConfirm({ t }) {
          const request = useStore(pendingDelete);
          const [busy, setBusy] = useState(false);
          const [error, setError] = useState(null);
          if (!request) return null;
          const close = () => {
            if (busy) return;
            setError(null);
            pendingDelete.set(null);
          };
          const confirm = () => {
            setBusy(true);
            setError(null);
            // On success the private view reloads without the deleted chat.
            window.incognito.call("chat-delete", { sessionId: request.sessionId }).then((r) => {
              setBusy(false);
              if (r.ok) pendingDelete.set(null);
              else setError(r.error);
            });
          };
          return h(
            ui.Modal,
            {
              open: true,
              onClose: close,
              closeLabel: t("close"),
              title: t("delete.title"),
              description: t("delete.desc", { title: request.title || t("untitled") }),
              footer: h(
                Fragment,
                null,
                h(ui.Button, { variant: "outline", disabled: busy, onClick: close }, t("cancel")),
                h(
                  ui.Button,
                  {
                    variant: "outline",
                    disabled: busy,
                    onClick: confirm,
                    style: { color: "var(--dsw-alias-label-error,#e5484d)" },
                  },
                  busy ? t("deleting") : t("delete.action"),
                ),
              ),
            },
            error &&
              h("div", { role: "alert", style: { color: "var(--dsw-alias-label-error,#e5484d)" } }, error),
          );
        }
        function ChatToast({ t }) {
          const value = useStore(toast);
          if (!value) return null;
          return h(ui.Toast, {
            key: value.seq,
            text: value.key ? t(value.key) : value.text,
            tone: value.tone,
            onDone: () => {
              if (toast.get()?.seq === value.seq) toast.set(null);
            },
          });
        }
        ctx.slots.inject("sidebar.workspaces.session.menu.item", function* () {
          yield ctx.slots.register(
            { name: "sidebar.workspaces.session.menu.item", id: "incognito-save", order: 50, locale: NS },
            SaveMenuItem,
          );
          yield ctx.slots.register(
            { name: "sidebar.workspaces.session.menu.item", id: "incognito-delete", order: 900, locale: NS },
            DeleteMenuItem,
          );
        });
        ctx.slots.inject("shell.overlay", function* () {
          yield ctx.slots.register(
            { name: "shell.overlay", id: "incognito.delete", locale: NS },
            DeleteConfirm,
          );
          yield ctx.slots.register({ name: "shell.overlay", id: "incognito.toast", locale: NS }, ChatToast);
        });
        // Ctrl+S saves the open chat, as in other apps.
        window.addEventListener("keydown", (e) => {
          if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "s") return;
          e.preventDefault();
          if (e.repeat) return;
          const sessionId = ctx.uiSession.current.getSnapshot().key;
          if (sessionId) saveChat(sessionId);
          else showToast({ key: "noChat" });
        });
      },
    };
  },
});
