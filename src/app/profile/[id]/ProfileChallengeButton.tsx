"use client";

/**
 * Client island that wraps the profile-header Challenge button so the
 * profile page itself can stay a server component. Owns the
 * open/close state for the ChallengeDialog popover.
 */
import { useState } from "react";
import { ChallengeDialog } from "@/components/ChallengeDialog";

export function ProfileChallengeButton({
  targetUsername,
}: {
  targetUsername: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
      >
        Challenge to Debate ▸
      </button>
      {open ? (
        <ChallengeDialog
          targetUsername={targetUsername}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
