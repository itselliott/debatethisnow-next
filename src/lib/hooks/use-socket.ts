"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/sockets-client";
import type { Socket } from "socket.io-client";

/**
 * Subscribe to one Socket.IO event for the lifetime of a component. Returns
 * the socket so callers can `emit()` from the same hook.
 *
 * Use this for one-shot listeners; the singleton handles reconnect.
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): Socket {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const socket = getSocket();
    const wrapped = (payload: T) => ref.current(payload);
    socket.on(event, wrapped);
    return () => {
      socket.off(event, wrapped);
    };
  }, [event]);
  return getSocket();
}

/** Sugar — just return the singleton, without subscribing. */
export function useSocket(): Socket {
  // useEffect ensures the singleton is only created client-side; the
  // returned reference is stable across renders.
  useEffect(() => {
    getSocket();
  }, []);
  return getSocket();
}
