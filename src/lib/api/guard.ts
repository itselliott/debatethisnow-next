/**
 * Route-handler guard helpers. Every state-changing /api/* route should:
 *   1. await checkCsrfOrReject(req) — returns NextResponse(403) or null
 *   2. await requireUserOr401(req)  — returns NextResponse(401) or ResolvedUser
 *   3. (optional) requireAdminOr403(user) — returns NextResponse(403) or null
 *
 * Mirrors the Python pattern of stacking `@jwt_user_required` +
 * `@limiter.limit(...)` decorators on top of a route function.
 */
import { NextResponse } from "next/server";
import {
  resolveUserFromRequest,
  type ResolvedUser,
} from "@/lib/auth/require-user";
import { checkCsrf } from "@/lib/auth/csrf";

export async function checkCsrfOrReject(req: Request): Promise<NextResponse | null> {
  const result = await checkCsrf(req);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "csrf_failed", message: result.reason },
    { status: 403 },
  );
}

export async function requireUserOr401(
  req: Request,
): Promise<ResolvedUser | NextResponse> {
  const resolved = await resolveUserFromRequest(req);
  if (!resolved) {
    return NextResponse.json(
      { error: "unauthorized", message: "Missing or invalid token" },
      { status: 401 },
    );
  }
  return resolved;
}

export function requireAdminOr403(
  resolved: ResolvedUser,
): NextResponse | null {
  if (!resolved.user.is_admin) {
    return NextResponse.json(
      { error: "admin_required" },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Generic 500 response — never leaks stack traces in prod (matches Python's
 * `server_error` handler). Caller passes the original error for log-side
 * forensics.
 */
export function serverErrorResponse(
  err: unknown,
  fallbackMessage = "Internal server error",
): NextResponse {
  console.error("[api]", err);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error — the incident has been logged."
      : err instanceof Error
        ? err.message
        : fallbackMessage;
  return NextResponse.json(
    { error: "server_error", message },
    { status: 500 },
  );
}

/**
 * Helper to read + JSON-parse a request body, returning either the parsed
 * value or a 400 response. Saves the try/catch boilerplate in every route.
 */
export async function readJsonOr400(
  req: Request,
): Promise<unknown | NextResponse> {
  try {
    const body = await req.json();
    return body;
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "invalid JSON" },
      { status: 400 },
    );
  }
}
