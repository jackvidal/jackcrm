import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { upload, download, preflight } from "./audio";
const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/call-audio", method: "POST", handler: upload });
http.route({ path: "/call-audio", method: "GET", handler: download });
http.route({ path: "/call-audio", method: "OPTIONS", handler: preflight });
export default http;
