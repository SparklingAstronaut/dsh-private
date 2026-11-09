// 错误构造：带 code 的可识别错误（事件/状态只回传 code，不回传内容）
export const err = (code, msg) => Object.assign(new Error(msg ?? code), { code });
