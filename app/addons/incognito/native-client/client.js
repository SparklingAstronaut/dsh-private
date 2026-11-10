window.__ModuleLoader__.load({
  id: "dsh-incognito-client",
  factory: (require) => {
    const { createElement: h, useState, useEffect } = require("react");
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
      inject: ["uiSession", "slots"],
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
                  alt: "Qwen Image 2.1 生成的图片",
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
        ctx.slots.inject("conversation.session.header.actions", () =>
          ctx.slots.register(
            { name: "conversation.session.header.actions", id: "incognito-chat-actions", order: 100 },
            () =>
              h(
                Button,
                {
                  "aria-label": "Private chat menu / 无痕聊天菜单",
                  title: "Save or delete this chat / 保存或删除聊天",
                  onClick: () => call("chat-menu"),
                },
                "⋯",
              ),
          ),
        );
      },
    };
  },
});
