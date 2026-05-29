"use client";

/**
 * Tiny FM/AM-style radio player. Lives in the top-right of authed
 * pages so you can dial up some background music or talk while
 * debating without leaving the tab.
 *
 * Two station sources:
 *   1. PRESETS — hand-curated Chicago-area stations with stable
 *      public HTTPS streams (WBEZ, WFMT, Vocalo). NPR / public radio
 *      affiliates tend to be reliable; commercial stations rotate
 *      stream URLs frequently so we keep that list short.
 *   2. CUSTOM — user-added stations. Paste any direct stream URL
 *      (MP3 / AAC / OGG) and a name; persists to localStorage.
 *      Delete-able. This is the escape hatch when the user wants a
 *      station that isn't in the presets.
 *
 * State:
 *   - station index (within combined list) → which is dialed in
 *   - playing → audio actually streaming
 *   - volume → 0..1, persisted to localStorage
 *   - expanded → tuner panel open vs. small chip
 *
 * The audio element is created lazily on first Play press so we don't
 * preload a stream the user might never start. No `crossOrigin`
 * attribute — that would force CORS preflight which most public radio
 * stream servers don't support, breaking playback entirely.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Station {
  band: "FM" | "AM" | "WEB";
  freq: string;
  name: string;
  url: string;
  // Marker so we know which list to write to on delete. Presets are
  // immutable, customs live in localStorage.
  source: "preset" | "custom";
}

// Chicago-area presets. NPR / public radio stations (WBEZ, WFMT) run
// their own ICEcast servers and are rock-solid. Commercial stations
// (Power 92, WXRT, WGCI, The Score) route through StreamTheWorld /
// iHeart / Audacy with rotating URLs — these may occasionally 404 if
// the broadcaster rotates a CDN. When that happens use "+ Add custom
// station" below with a fresh URL from the broadcaster's listen-live
// page.
const PRESETS: Station[] = [
  {
    band: "FM",
    freq: "91.5",
    name: "WBEZ · NPR Chicago",
    url: "https://stream.wbez.org/wbez128.mp3",
    source: "preset",
  },
  {
    band: "FM",
    freq: "92.3",
    name: "WPWX · Power 92 · Hip-Hop",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WPWXFM.mp3",
    source: "preset",
  },
  {
    band: "FM",
    freq: "93.1",
    name: "WXRT · Alternative Rock",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WXRTFM.mp3",
    source: "preset",
  },
  {
    band: "FM",
    freq: "98.7",
    name: "WFMT · Classical",
    url: "https://wfmt-ice.streamguys1.com/wfmt-aac",
    source: "preset",
  },
  {
    band: "FM",
    freq: "107.5",
    name: "WGCI · Hip-Hop / R&B",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WGCIFM.mp3",
    source: "preset",
  },
  {
    band: "AM",
    freq: "670",
    name: "WSCR · The Score · Sports",
    url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WSCRAM.mp3",
    source: "preset",
  },
];

const KEY_STATION_URL = "debatethis.radio.stationUrl";
const KEY_VOLUME = "debatethis.radio.volume";
const KEY_CUSTOM = "debatethis.radio.customStations";

interface CustomStation {
  freq: string;
  name: string;
  url: string;
}

function readCustomStations(): CustomStation[] {
  try {
    const raw = window.localStorage.getItem(KEY_CUSTOM);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) =>
        s &&
        typeof s === "object" &&
        typeof s.url === "string" &&
        typeof s.name === "string" &&
        typeof s.freq === "string",
    ) as CustomStation[];
  } catch {
    return [];
  }
}

function writeCustomStations(list: CustomStation[]) {
  try {
    window.localStorage.setItem(KEY_CUSTOM, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function RadioWidget() {
  const [currentUrl, setCurrentUrl] = useState<string>(PRESETS[0]!.url);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customStations, setCustomStations] = useState<CustomStation[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Hydrate prefs from localStorage.
  useEffect(() => {
    try {
      const u = window.localStorage.getItem(KEY_STATION_URL);
      const v = window.localStorage.getItem(KEY_VOLUME);
      if (u) setCurrentUrl(u);
      if (v) {
        const f = Number.parseFloat(v);
        if (Number.isFinite(f) && f >= 0 && f <= 1) setVolume(f);
      }
    } catch {
      /* ignore */
    }
    setCustomStations(readCustomStations());
  }, []);

  // Combined station list — presets first, then customs.
  const stations: Station[] = useMemo(
    () => [
      ...PRESETS,
      ...customStations.map<Station>((c) => ({
        band: "WEB",
        freq: c.freq,
        name: c.name,
        url: c.url,
        source: "custom",
      })),
    ],
    [customStations],
  );

  // Resolve `currentUrl` → Station object, falling back to first preset
  // if the persisted URL is no longer in the list (custom was deleted).
  const station = useMemo(
    () => stations.find((s) => s.url === currentUrl) ?? stations[0]!,
    [stations, currentUrl],
  );

  // Persist station + volume on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY_STATION_URL, station.url);
    } catch {
      /* ignore */
    }
  }, [station.url]);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY_VOLUME, String(volume));
    } catch {
      /* ignore */
    }
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const playPause = useCallback(() => {
    setError(null);
    if (!audioRef.current) {
      // DELIBERATELY not setting `crossOrigin = "anonymous"` here.
      // That would require the stream server to send
      // Access-Control-Allow-Origin headers, which most ICEcast /
      // Wowza public-radio streams don't — resulting in "no
      // supported source was found" failures. We're only playing the
      // audio (not feeding it to AudioContext for analysis), so
      // opaque cross-origin responses work fine.
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
      audioRef.current.preload = "none";
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.src = station.url;
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch((err: Error) => {
          setError(humanizeAudioError(err, station.name));
          setPlaying(false);
        });
    }
  }, [station, playing, volume]);

  // Re-tune when station changes mid-play.
  useEffect(() => {
    if (!playing || !audioRef.current) return;
    audioRef.current.src = station.url;
    audioRef.current.play().catch((err: Error) => {
      setError(humanizeAudioError(err, station.name));
      setPlaying(false);
    });
  }, [station.url, station.name, playing]);

  // Pause + clean up on unmount.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const addCustom = () => {
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name || !url) {
      setError("Name and stream URL are both required.");
      return;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        setError("Stream URL must start with http:// or https://");
        return;
      }
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    const freq = (name.match(/\d+\.?\d*/) ?? [""])[0] || "WEB";
    const next: CustomStation = { freq, name, url };
    const updated = [...customStations, next];
    setCustomStations(updated);
    writeCustomStations(updated);
    setNewName("");
    setNewUrl("");
    setAddingCustom(false);
    setError(null);
    // Auto-tune to the newly added station.
    setCurrentUrl(url);
  };

  const removeCustom = (url: string) => {
    const updated = customStations.filter((c) => c.url !== url);
    setCustomStations(updated);
    writeCustomStations(updated);
    // If the user deleted the current station, fall back to the first
    // preset so the widget doesn't get stuck.
    if (station.url === url) {
      setCurrentUrl(PRESETS[0]!.url);
      audioRef.current?.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="fixed right-3 top-3 z-40 hidden md:block">
      {!expanded ? (
        // Collapsed: small chip with band/freq + play state.
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 rounded border-2 border-ink bg-paper-2 px-3 py-1.5 font-condensed text-xs uppercase tracking-wider shadow-press-sm hover:bg-ink hover:text-paper"
          title="Radio"
        >
          <span aria-hidden className={playing ? "text-red" : "text-sepia"}>
            {playing ? "●" : "○"}
          </span>
          <span>
            {station.band} {station.freq}
          </span>
        </button>
      ) : (
        // Expanded panel: tuner.
        <div className="max-h-[80vh] w-80 overflow-y-auto rounded border-2 border-ink bg-paper-2 p-3 shadow-press">
          <div className="flex items-center justify-between">
            <span className="font-condensed text-[10px] uppercase tracking-[0.28em] text-red">
              Radio · Chicago
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
              {station.band}
            </span>
          </div>
          <div className="mt-0.5 truncate font-condensed text-[11px] uppercase tracking-wider text-sepia">
            {station.name}
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={playPause}
              aria-label={playing ? "Stop" : "Play"}
              className={`w-full rounded border-2 px-3 py-1.5 font-condensed text-xs uppercase tracking-widest shadow-press-sm ${
                playing
                  ? "border-red bg-red text-paper"
                  : "border-ink bg-paper text-ink hover:bg-ink hover:text-paper"
              }`}
            >
              {playing ? "■ Stop" : "▶ Play"}
            </button>
          </div>

          <div className="mt-3">
            <div className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
              Tuner
            </div>
            <ul className="mt-1 space-y-1">
              {stations.map((s) => {
                const active = s.url === station.url;
                return (
                  <li key={s.url} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentUrl(s.url)}
                      aria-pressed={active}
                      className={`min-w-0 flex-1 rounded border px-2 py-1 text-left font-condensed text-[11px] uppercase tracking-wider transition-colors ${
                        active
                          ? "border-red bg-red text-paper"
                          : "border-ink bg-paper text-ink hover:bg-ink hover:text-paper"
                      }`}
                      title={s.name}
                    >
                      <span className="flex items-baseline gap-1">
                        <span className="shrink-0 text-[10px] opacity-70">
                          {s.band}
                        </span>
                        <span className="shrink-0 font-display text-sm">
                          {s.freq}
                        </span>
                      </span>
                      <span className="block truncate text-[10px] normal-case opacity-80">
                        {s.name}
                      </span>
                    </button>
                    {s.source === "custom" ? (
                      <button
                        type="button"
                        onClick={() => removeCustom(s.url)}
                        aria-label={`Remove ${s.name}`}
                        className="shrink-0 rounded border border-ink/40 px-2 py-1 font-condensed text-[10px] uppercase text-sepia hover:bg-red hover:text-paper"
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Add a custom stream URL — escape hatch for any Chicago
              station (or anywhere else) not in the preset list. */}
          <div className="mt-3 border-t border-ink/20 pt-3">
            {addingCustom ? (
              <div className="space-y-2">
                <label className="block">
                  <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
                    Station name
                  </span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="WXRT 93.1 · Alternative"
                    className="mt-1 w-full rounded border border-ink bg-paper px-2 py-1 text-xs"
                  />
                </label>
                <label className="block">
                  <span className="font-condensed text-[10px] uppercase tracking-wider text-sepia">
                    Stream URL (MP3 / AAC)
                  </span>
                  <input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://stream.example.com/wxrt.mp3"
                    className="mt-1 w-full rounded border border-ink bg-paper px-2 py-1 font-mono text-[11px]"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCustom(false);
                      setNewName("");
                      setNewUrl("");
                      setError(null);
                    }}
                    className="rounded border border-ink px-2 py-1 font-condensed text-[10px] uppercase tracking-wider hover:bg-ink hover:text-paper"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addCustom}
                    className="flex-1 rounded bg-red px-2 py-1 font-condensed text-[10px] uppercase tracking-wider text-paper hover:opacity-90"
                  >
                    Add station
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCustom(true)}
                className="w-full rounded border border-ink px-2 py-1 font-condensed text-[10px] uppercase tracking-wider text-ink hover:bg-ink hover:text-paper"
              >
                + Add custom station
              </button>
            )}
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
}

/**
 * Map raw <audio> playback errors to short user-readable strings.
 * The browser's default messages ("Failed to load because no supported
 * source was found") are useless to the listener — they need to know
 * whether the station is dead, their connection is dead, or they need
 * to click again. Common cases mapped explicitly; everything else
 * falls back to "Couldn't tune in".
 */
function humanizeAudioError(err: Error, stationName: string): string {
  if (err.name === "NotAllowedError") {
    return "Click play again — your browser blocked autoplay.";
  }
  if (err.name === "NotSupportedError") {
    return `${stationName} isn't streaming right now. Try another station.`;
  }
  if (err.name === "AbortError") {
    return "Playback aborted.";
  }
  return `Couldn't tune in: ${err.message || err.name}`;
}
