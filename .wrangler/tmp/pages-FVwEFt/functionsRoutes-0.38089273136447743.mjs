import { onRequestOptions as __api_nvidia___path___ts_onRequestOptions } from "/home/huypn3/PersonalProjects/antigravity/tnmn/functions/api/nvidia/[[path]].ts"
import { onRequest as __api_nvidia___path___ts_onRequest } from "/home/huypn3/PersonalProjects/antigravity/tnmn/functions/api/nvidia/[[path]].ts"

export const routes = [
    {
      routePath: "/api/nvidia/:path*",
      mountPath: "/api/nvidia",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_nvidia___path___ts_onRequestOptions],
    },
  {
      routePath: "/api/nvidia/:path*",
      mountPath: "/api/nvidia",
      method: "",
      middlewares: [],
      modules: [__api_nvidia___path___ts_onRequest],
    },
  ]