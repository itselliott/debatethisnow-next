"use client";

/**
 * Tiny FM/AM-style radio player. Lives in the top-right of authed
 * pages so you can dial up some background music or talk while
 * debating without leaving the tab.
 *
 * Stations are public internet streams from SomaFM / Radio Garden /
 * Radio Paradise — long-running, free, CORS-friendly. We don't host
 * any audio ourselves.
 *
 * State:
 *   - station index → which preset is dialed in
 *   - playing       → audio is actually streaming (true) or muted
 *   - volume        → 0..1, persisted to localStorage
 *   - expanded      → tuner panel open (true) or just a small chip
 *
 * The audio element is created lazily on first Play press so we don't
 * preload a stream the user might never start. Volume + station
 * preferences persist across reloads.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Station {
  band: "FM" | "AM";
  freq: string;
  name: string;
  url: string;
}

// Curated set — all stable URL streams, no auth required, CORS-OK.
// Frequencies are aesthetic — the band/freq pairs invent an FM/AM
// dial look but actual playback is internet streaming.
const STATIONS: Station[] = [
  {
    band: "FM",
    freq: "88.5",
    name: "Groove Salad · downtempo",
    url: "https://ice1.somafm.com/groovesalad-128-mp3",
  },
  {
    band: "FM",
    freq: "92.7",
    name: "Drone Zone · ambient",
    url: "https://ice1.somafm.com/dronezone-128-mp3",
  },
  {
    band: "FM",
    freq: "98.3",
    name: "Indie Pop Rocks",
    url: "https://ice1.somafm.com/indiepop-128-mp3",
  },
  {
    band: "FM",
    freq: "104.1",
    name: "Lush · vocals",
    url: "https://ice1.somafm.com/lush-128-mp3",
  },
  {
    band: "AM",
    freq: "740",
    name: "Mission Control · NASA",
    url: "https://ice1.somafm.com/missioncontrol-128-mp3",
  },
  {
    band: "AM",
    freq: "1090",
    name: "Deep Space One",
    url: "https://ice1.somafm.com/deepspaceone-128-mp3",
  },
];

const KEY_STATION = "debatethis.radio.station";
const KEY_VOLUME = "debatethis.radio.volume";

export function RadioWidget() {
  const [stationIdx, setStationIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Hydrate prefs from localStorage.
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(KEY_STATION);
      const v = window.localStorage.getItem(KEY_VOLUME);
      if (s) {
        const n = Number.parseInt(s, 10);
        if (
          Number.isInteger(n) &&
          n >= 0 &&
          n < STATIONS.length
        ) {
          setStationIdx(n);
        }
      }
      if (v) {
        const f = Number.parseFloat(v);
        if (Number.isFinite(f) && f >= 0 && f <= 1) {
          setVolume(f);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY_STATION, String(stationIdx));
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
      audioRef.current = new Audio(station.url);
      audioRef.current.volume = volume;
      audioRef.current.crossOrigin = "anonymous";
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
          setError(
            err.name === "NotAllowedError"
              ? "Click the play button again — browser blocked autoplay."
              : `Couldn't tune in: ${err.message}`,
          );
          setPlaying(false);
        });
    }
  }, [station, playing, volume]);

  // Re-tune when station changes mid-play.
  useEffect(() => {
    if (!playing || !audioRef.current) return;
    audioRef.current.src = station.url;
    audioRef.current.play().catch((err: Error) => {
      setError(`Couldn't tune in: ${err.message}`);
      setPlaying(false);
    });
  }, [stationIdx, station.url, playing]);

  // Pause + clean up on unmount.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

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
        <div className="w-72 rounded border-2 border-ink bg-paper-2 p-3 shadow-press">
          <div className="flex items-center justify-between">
            <span className="font-condensed text-[10px] uppercase tracking-[0.28em] text-red">
              Radio
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

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={playPause}
              aria-label={playing ? "Stop" : "Play"}
              className={`flex-1 rounded border-2 px-3 py-1.5 font-condensed text-xs uppercase tracking-widest shadow-press-sm ${
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
            <div className="mt-1 grid grid-cols-2 gap-1">
              {STATIONS.map((s, i) => (
                <button
                  key={s.url}
                  type="button"
                  onClick={() => setStationIdx(i)}
                  aria-pressed={i === stationIdx}
                  className={`rounded border px-2 py-1 text-left font-condensed text-[11px] uppercase tracking-wider transition-colors ${
                    i === stationIdx
                      ? "border-red bg-red text-paper"
                      : "border-ink bg-paper text-ink hover:bg-ink hover:text-paper"
                  }`}
                  title={s.name}
                >
                  <span className="block truncate">
                    {s.band} {s.freq}
                  </span>
                </button>
              ))}
            </div>
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
