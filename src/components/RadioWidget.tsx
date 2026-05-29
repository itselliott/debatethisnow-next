"use client";

/**
 * NPR radio chip — pick an NPR affiliate from a curated list of
 * major-metro public-radio stations. All entries are confirmed direct
 * MP3/AAC streams that embed cleanly in an HTML5 `<audio>` element
 * (no HLS, no auth tokens, no CORS preflight). The audio element is
 * created lazily on first Play press so streams the user never hits
 * don't get preloaded.
 *
 * Rendered via createPortal at the document body so the chip stays
 * pinned to the viewport top-right regardless of which ancestors in
 * the tree have transforms / will-change set.
 *
 * Hidden below md (the chip would crowd the existing top nav on
 * mobile).
 *
 * State:
 *   - stationIndex → which NPR affiliate is dialed in (persisted)
 *   - playing      → audio actually streaming
 *   - volume       → 0..1, persisted to localStorage
 *   - expanded     → tuner panel open vs. small chip
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface NprStation {
  city: string;
  call: string;
  freq: string;
  url: string;
}

// Curated NPR affiliates that embed cleanly in a plain `<audio>` element
// (no HLS, no token auth, no CORS preflight). The major-metro flagships
// + the NPR News Now national feed cover most listeners.
//
//   - National  → NPR News Now hourly headlines (ICEcast direct)
//   - Chicago   → WBEZ broadcaster-owned anonymous ICEcast
//   - New York  → WNYC broadcaster-owned anonymous ICEcast
//
// Other major affiliates (KCRW, WAMU, KQED, WHYY, KUT, WFMT) route
// through third-party CDNs that have been incrementally moving behind
// token-based auth since 2024. A plain `<audio>` element can't do the
// token handshake, so those URLs return 403 to anonymous fetches even
// though the stations are clearly broadcasting on their own sites. We
// deliberately keep them OFF this list — short and reliable beats long
// and flaky.
const STATIONS: NprStation[] = [
  { city: "National", call: "NPR News Now", freq: "live", url: "https://npr-ice.streamguys1.com/live.mp3" },
  { city: "Chicago",  call: "WBEZ",         freq: "91.5", url: "https://stream.wbez.org/wbez128.mp3" },
  { city: "New York", call: "WNYC",         freq: "93.9", url: "https://fm939.wnyc.org/wnycfm" },
];

const KEY_STATION_INDEX = "debatethis.radio.stationIndex";
const KEY_VOLUME = "debatethis.radio.volume";

export function RadioWidget() {
  const [stationIdx, setStationIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Hydrate prefs.
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(KEY_STATION_INDEX);
      if (s) {
        const n = Number.parseInt(s, 10);
        if (Number.isInteger(n) && n >= 0 && n < STATIONS.length) {
          setStationIdx(n);
        }
      }
      const v = window.localStorage.getItem(KEY_VOLUME);
      if (v) {
        const f = Number.parseFloat(v);
        if (Number.isFinite(f) && f >= 0 && f <= 1) setVolume(f);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist station + volume on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY_STATION_INDEX, String(stationIdx));
    } catch {
      /* ignore */
    }
  }, [stationIdx]);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY_VOLUME, String(volume));
    } catch {
      /* ignore */
    }
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const station = STATIONS[stationIdx] ?? STATIONS[0]!;

  const playPause = useCallback(() => {
    setError(null);
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.preload = "none";
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    audioRef.current.src = station.url;
    audioRef.current
      .play()
      .then(() => setPlaying(true))
      .catch((err: Error) => {
        setError(humanizeAudioError(err, station.call));
        setPlaying(false);
      });
  }, [playing, volume, station.url, station.call]);

  // Re-tune when station changes mid-play.
  useEffect(() => {
    if (!playing || !audioRef.current) return;
    audioRef.current.src = station.url;
    audioRef.current.play().catch((err: Error) => {
      setError(humanizeAudioError(err, station.call));
      setPlaying(false);
    });
  }, [station.url, station.call, playing]);

  // Pause + clean up on unmount.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  // Render via portal at <body> so the chip stays pinned to the
  // viewport regardless of any ancestor's transform/filter context.
  const [mounted, setMounted] = useState(false);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Anchor the chip to the visual viewport (the actually-visible
  // region, including pinch-zoom offset). `position: fixed` alone
  // pins to the LAYOUT viewport, which differs from the visual
  // viewport when zoomed — making the chip appear to scroll along
  // with the page as the user pans the zoomed view. Manually
  // updating its position on every visualViewport event keeps it
  // tied to "the top-right of what you're looking at", which is
  // what the user expects.
  useEffect(() => {
    if (!mounted) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const el = nodeRef.current;
      if (!el) return;
      // offsetTop/offsetLeft are non-zero when the user has zoomed
      // and panned; on an un-zoomed page they're 0 and behaviour
      // matches the plain `position: fixed` default.
      el.style.top = `${vv.offsetTop + 12}px`;
      el.style.left = `${vv.offsetLeft + vv.width - el.offsetWidth - 12}px`;
      el.style.right = "auto";
    };
    update();
    vv.addEventListener("scroll", update);
    vv.addEventListener("resize", update);
    // Re-position whenever window dimensions or our own size change
    // (e.g. collapsed↔expanded toggles the chip width).
    const ro = new ResizeObserver(update);
    if (nodeRef.current) ro.observe(nodeRef.current);
    window.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("scroll", update);
      vv.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [mounted, expanded]);

  if (!mounted) return null;

  const node = (
    <div
      ref={nodeRef}
      style={{ position: "fixed", top: 12, right: 12, zIndex: 50 }}
      className="hidden md:block"
    >
      {!expanded ? (
        // Collapsed chip — just shows "NPR" + play indicator. Keeping
        // the label short avoids the chip dancing in width every time
        // the user picks a station with a longer callsign.
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 rounded border-2 border-ink bg-paper-2 px-3 py-1.5 font-condensed text-xs uppercase tracking-wider shadow-press-sm hover:bg-ink hover:text-paper"
          title={`${station.call} · ${station.city}`}
        >
          <span aria-hidden className={playing ? "text-red" : "text-sepia"}>
            {playing ? "●" : "○"}
          </span>
          <span>NPR</span>
        </button>
      ) : (
        // Expanded panel — city picker + play + volume.
        <div className="max-h-[80vh] w-72 overflow-y-auto rounded border-2 border-ink bg-paper-2 p-3 shadow-press">
          <div className="flex items-center justify-between">
            <span className="font-condensed text-[10px] uppercase tracking-[0.28em] text-red">
              NPR · {station.city}
            </span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Close radio"
              className="rounded p-1 text-sepia hover:bg-paper hover:text-ink"
            >
              <span aria-hidden>×</span>
            </button>
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl text-ink">
              {station.freq}
            </span>
            <span className="font-condensed text-xs uppercase tracking-wider text-sepia">
              FM
            </span>
          </div>
          <div className="mt-0.5 truncate font-condensed text-[11px] uppercase tracking-wider text-sepia">
            {station.call} · {station.city}
          </div>

          <button
            type="button"
            onClick={playPause}
            aria-label={playing ? "Stop" : "Play"}
            className={`mt-3 w-full rounded border-2 px-3 py-1.5 font-condensed text-xs uppercase tracking-widest shadow-press-sm ${
              playing
                ? "border-red bg-red text-paper"
                : "border-ink bg-paper text-ink hover:bg-ink hover:text-paper"
            }`}
          >
            {playing ? "■ Stop" : "▶ Play"}
          </button>

          <div className="mt-3">
            <div className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
              City
            </div>
            <ul className="mt-1 space-y-1">
              {STATIONS.map((s, i) => {
                const active = i === stationIdx;
                return (
                  <li key={s.url}>
                    <button
                      type="button"
                      onClick={() => setStationIdx(i)}
                      aria-pressed={active}
                      className={`flex w-full items-baseline justify-between gap-2 rounded border px-2 py-1 text-left transition-colors ${
                        active
                          ? "border-red bg-red text-paper"
                          : "border-ink bg-paper text-ink hover:bg-ink hover:text-paper"
                      }`}
                    >
                      <span className="truncate font-condensed text-[11px] uppercase tracking-wider">
                        {s.city}
                      </span>
                      <span className="shrink-0 font-display text-xs">
                        {s.call} {s.freq}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <label className="mt-3 block">
            <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
              Volume
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number.parseFloat(e.target.value))}
              className="mt-1 w-full accent-red"
              aria-label="Volume"
            />
          </label>

          {error ? (
            <div
              role="alert"
              className="mt-2 rounded border border-red bg-red/10 px-2 py-1 text-[11px] text-red-dark"
            >
              {error}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
  return createPortal(node, document.body);
}

/**
 * Map raw <audio> playback errors to short user-readable strings.
 */
function humanizeAudioError(err: Error, callsign: string): string {
  if (err.name === "NotAllowedError") {
    return "Click play again — your browser blocked autoplay.";
  }
  if (err.name === "NotSupportedError") {
    return `${callsign}'s stream is offline. Pick another city.`;
  }
  if (err.name === "AbortError") {
    return "Playback aborted.";
  }
  return `Couldn't tune in: ${err.message || err.name}`;
}
