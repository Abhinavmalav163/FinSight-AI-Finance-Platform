import arcjet, { createMiddleware, detectBot, shield } from "@arcjet/next";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/main/dashboard(.*)",
  "/main/account(.*)",
  "/main/transaction(.*)",
  "/api/webhooks/clerk",
]);

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({
      mode: 'LIVE'
    }),
    detectBot({
      mode: "LIVE",
      allow:[
        "CATEGORY:SEARCH_ENGINE", "GO_HTTP_CLIENT"],
      
    })
  ]
})

// Create base Clerk middleware
const clerkMiddlewareHandler = clerkMiddleware(async (auth, req) => {
  // Add this condition to skip Inngest routes from all middleware
  if (req.nextUrl.pathname.startsWith("/api/inngest")) {
    return NextResponse.next();
  }

  const { userId } = await auth();

  if (!userId && isProtectedRoute(req)) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }

  return NextResponse.next();
});

export default createMiddleware(aj, clerkMiddlewareHandler);

// The matcher is simplified as the Inngest route is now handled inside the middleware.
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
