export const inject=['web'];
export function apply(ctx){ctx.web.registerSearchProvider({id:'deepseek-official',available:()=>true,search:(request,signal)=>globalThis.privateSearch(request,signal)});}
