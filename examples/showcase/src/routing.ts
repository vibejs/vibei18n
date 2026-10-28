import { createRouter, createWebHistory } from "@usevibejs/ui/router";
import { connectI18nRouter } from "../../../src/router/index.ts";
import { i18n } from "./i18n.ts";
export const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/:locale/dashboard", name: "dashboard" }],
});
export const routing = connectI18nRouter(router, i18n);
