/**
 * PUT /api/users/me/avatar — update the current user's avatar emoji.
 *
 * Body: { avatar: string } — must be one of the catalog glyphs in
 * `src/lib/avatars.ts` (or empty string to clear).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  checkCsrfOrReject,
  readJsonOr400,
  requireUserOr401,
} from "@/lib/api/guard";
import { isValidAvatar } from "@/lib/avatars";

const Body = z.object({ avatar: z.string().max(8) });

export async function PUT(req: NextRequest) {
  const csrf = await checkCsrfOrReject(req);
  if (csrf) return csrf;
  const resolved = await requireUserOr401(req);
  if (resolved instanceof NextResponse) return resolved;
  const raw = await readJsonOr400(req);
  if (raw instanceof NextResponse) return raw;
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!isValidAvatar(parsed.data.avatar)) {
    return NextResponse.json(
      { error: "invalid_avatar", message: "Pick an avatar from the catalog." },
      { status: 400 },
    );
  }
  await prisma.user.update({
    where: { id: resolved.user.id },
    data: { avatar: parsed.data.avatar },
  });
  return NextResponse.json({ ok: true, avatar: parsed.data.avatar });
}
