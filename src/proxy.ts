import { auth } from "@/lib/neon-auth";

// Neon Auth route protection: refreshes the session cookie and redirects signed-out
// visitors to /login. Pages still check the session themselves via requireUser().
// Public: auth pages, invite links, the widget API/script and the demo page.
export default auth.middleware({
  loginUrl: "/login",
  publicRoutes: ["/login", "/signup", "/invite", "/api/widget", "/widget.js", "/demo.html"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
