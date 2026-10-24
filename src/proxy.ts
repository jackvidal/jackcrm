import { convexAuthNextjsMiddleware, createRouteMatcher, nextjsMiddlewareRedirect } from "@convex-dev/auth/nextjs/server";
const protectedRoute = createRouteMatcher(["/dashboard(.*)", "/leads(.*)", "/meetings(.*)", "/tasks(.*)", "/settings(.*)"]);
const authRoute = createRouteMatcher(["/login", "/signup"]);
export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (protectedRoute(request) && !await convexAuth.isAuthenticated()) return nextjsMiddlewareRedirect(request, "/login");
  if (authRoute(request) && await convexAuth.isAuthenticated()) return nextjsMiddlewareRedirect(request, "/dashboard");
});
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
