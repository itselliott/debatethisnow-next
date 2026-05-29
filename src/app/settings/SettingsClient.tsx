"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { useLang, useTone } from "@/lib/hooks/use-tone";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { useTheme, type Theme } from "@/lib/hooks/use-theme";
import { AVATAR_CATEGORIES, displayAvatar } from "@/lib/avatars";
import type { Lang } from "@/lib/tone/phrases";

const LANGUAGES: Array<{ code: Lang; label: string; flag: string }> = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export function SettingsClient({
  username,
  isAdmin,
}: {
  username: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  void isAdmin;

  const deleteAccount = async () => {
    setError(null);
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    if (
      !window.confirm(
        "This permanently scrubs your account. You will be signed out and the username freed. Continue?",
      )
    ) {
      return;
    }
    try {
      await apiClient.delete("/api/auth/me", { password });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 400
            ? "Password didn't match. Try again."
            : err.message,
        );
      } else {
        setError("Unable to delete account.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b-[3px] border-double border-ink pb-4">
        <span className="font-condensed text-xs uppercase tracking-[0.28em] text-red">
          Account
        </span>
        <h1 className="mt-1 font-display text-3xl">Settings</h1>
        <p className="text-sm text-sepia">Signed in as {username}.</p>
      </header>

      <AvatarSection username={username} />

      <ThemeSection />

      <ToneSection />

      <section className="rounded border border-ink bg-paper-2 p-4 shadow-press">
        <h2 className="font-display text-lg">Language</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              className={`rounded border-2 ${lang === l.code ? "border-red bg-red text-paper" : "border-ink bg-paper text-ink"} px-3 py-2 font-condensed text-sm uppercase tracking-wider`}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded border border-red bg-paper-2 p-4 shadow-press">
        <h2 className="font-display text-lg text-red">Danger zone</h2>
        <p className="mt-1 text-sm text-sepia">
          Deleting your account scrubs PII and frees the username, but
          preserves past debate transcripts so opponents' records stay
          coherent.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm password"
            className="flex-1 rounded border-2 border-ink bg-paper px-3 py-2 font-body shadow-press-sm focus:outline-none focus:ring-2 focus:ring-red"
          />
          <button
            type="button"
            onClick={deleteAccount}
            className="rounded bg-red px-4 py-2 font-condensed text-sm uppercase tracking-widest text-paper shadow-press-sm hover:opacity-90"
          >
            Delete Account
          </button>
        </div>
        {error ? (
          <div
            role="alert"
            className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
          >
            {error}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ToneSection() {
  const { tone, setTone } = useTone();
  return (
    <section className="rounded border-2 border-gold bg-paper-2 p-4 shadow-press">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Tone</h2>
          <p className="mt-1 text-sm text-sepia">
            How the site talks to you. <strong>Competitive</strong> uses
            debate jargon — "Opening Statement", "Rebuttal", "Elo".{" "}
            <strong>Casual</strong> drops the formalism — "Your Point",
            "Push Back", "Score".
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <ToneOption
          active={tone === "competitive"}
          label="Competitive"
          sub="Debate club energy"
          onClick={() => setTone("competitive")}
        />
        <ToneOption
          active={tone === "casual"}
          label="Casual"
          sub="Just argue with strangers"
          onClick={() => setTone("casual")}
        />
      </div>
    </section>
  );
}

function ToneOption({
  active,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded border-2 p-3 text-left transition-transform ${
        active
          ? "border-red bg-red text-paper shadow-press"
          : "border-ink bg-paper text-ink shadow-press-sm hover:translate-x-px hover:translate-y-px hover:shadow-none"
      }`}
    >
      <div className="font-display text-lg leading-none">{label}</div>
      <div
        className={`mt-1 text-xs ${active ? "text-paper-3" : "text-sepia"}`}
      >
        {sub}
      </div>
    </button>
  );
}

function ThemeSection() {
  const { theme, effective, setTheme } = useTheme();
  const options: Array<{
    value: Theme;
    label: string;
    sub: string;
    icon: string;
  }> = [
    {
      value: "light",
      label: "Light",
      sub: "Warm parchment, dark ink.",
      icon: "☀",
    },
    {
      value: "dark",
      label: "Dark",
      sub: "Warm dark mode for late nights.",
      icon: "☾",
    },
    {
      value: "auto",
      label: "Auto",
      sub: "Follow your system preference.",
      icon: "◐",
    },
  ];
  return (
    <section className="rounded border-2 border-ink bg-paper-2 p-4 shadow-press">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg">Theme</h2>
        <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
          Currently: {effective}
        </span>
      </div>
      <p className="mt-1 text-sm text-sepia">
        Switch between light and dark, or follow your OS automatically.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {options.map((o) => {
          const active = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setTheme(o.value)}
              aria-pressed={active}
              className={`rounded border-2 p-3 text-left transition-transform ${
                active
                  ? "border-red bg-red text-paper shadow-press"
                  : "border-ink bg-paper text-ink shadow-press-sm hover:translate-x-px hover:translate-y-px hover:shadow-none"
              }`}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg leading-none">
                  {o.icon}
                </span>
                <span className="font-display text-lg leading-none">
                  {o.label}
                </span>
              </div>
              <div
                className={`mt-1 text-xs ${active ? "text-paper-3" : "text-sepia"}`}
              >
                {o.sub}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Avatar picker. Renders the current avatar prominently + a grid of
 * catalog glyphs grouped by category. Click any glyph to pick it;
 * optimistically updates the cached current-user record so the
 * sidebar avatar + profile etc. refresh immediately.
 */
function AvatarSection({ username }: { username: string }) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (me.data?.avatar) setSelected(me.data.avatar);
  }, [me.data?.avatar]);

  const pick = async (glyph: string) => {
    setErr(null);
    setSaving(true);
    const previous = selected;
    setSelected(glyph);
    // Optimistic cache update so other surfaces (sidebar, profile)
    // reflect the change instantly.
    qc.setQueryData(["auth", "me"], (old: unknown) => {
      if (!old || typeof old !== "object") return old;
      return { ...(old as Record<string, unknown>), avatar: glyph };
    });
    try {
      await apiClient.put("/api/users/me/avatar", { avatar: glyph });
    } catch (e) {
      setSelected(previous);
      qc.setQueryData(["auth", "me"], (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        return { ...(old as Record<string, unknown>), avatar: previous };
      });
      setErr(
        e instanceof ApiError
          ? ((e.data as { message?: string } | null)?.message ?? e.message)
          : "Couldn't save avatar.",
      );
    } finally {
      setSaving(false);
    }
  };

  const current = selected || displayAvatar(me.data?.avatar ?? null, username);

  return (
    <section className="rounded border-2 border-ink bg-paper-2 p-4 shadow-press">
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded border-2 border-ink bg-paper text-3xl shadow-press-sm"
        >
          {current}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg">Avatar</h2>
          <p className="mt-1 text-sm text-sepia">
            Pick a glyph — it shows up wherever your name appears.
          </p>
        </div>
      </div>

      {err ? (
        <div
          role="alert"
          className="mt-2 rounded border border-red bg-red/10 px-3 py-2 text-sm text-red-dark"
        >
          {err}
        </div>
      ) : null}

      <div className="mt-3 space-y-3">
        {AVATAR_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <div className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
              {cat.label}
            </div>
            <div className="mt-1 grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {cat.emojis.map((glyph) => {
                const active = glyph === selected;
                return (
                  <button
                    key={glyph}
                    type="button"
                    onClick={() => pick(glyph)}
                    disabled={saving}
                    aria-pressed={active}
                    aria-label={`Set avatar to ${glyph}`}
                    className={`flex h-9 w-9 items-center justify-center rounded border text-xl transition-transform hover:scale-110 ${
                      active
                        ? "border-red bg-red/20 shadow-press-sm"
                        : "border-ink/30 bg-paper hover:border-ink"
                    } disabled:opacity-50`}
                  >
                    {glyph}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
