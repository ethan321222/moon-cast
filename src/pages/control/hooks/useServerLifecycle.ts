import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ServerConfig, ServerStatus, AddressEntry } from "@/types";
import {
  startServer,
  stopServer,
  getServerStatus,
  readLogs,
} from "@/api/client";
import { translateError } from "@/utils/i18n-error";
import i18n from "@/locales";

interface UseServerLifecycleOptions {
  config: ServerConfig | null;
}

export function useServerLifecycle({ config }: UseServerLifecycleOptions) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [addresses, setAddresses] = useState<AddressEntry[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch initial server status
  useEffect(() => {
    getServerStatus().then((running) => {
      setStatus(running ? { running: true, local_addr: null, root: "", port: 0 } : null);
    }).catch(() => {});
  }, []);

  // Listen for address-ready events from backend
  useEffect(() => {
    const unlisten = listen<AddressEntry>("address-ready", (event) => {
      setAddresses((prev) => {
        const idx = prev.findIndex((a) => a.id === event.payload.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = event.payload;
          return next;
        }
        return [...prev, event.payload];
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Poll logs while server is running
  useEffect(() => {
    if (!status?.running) return;
    const poll = async () => {
      try {
        const newLogs = await readLogs();
        if (newLogs.length > 0) {
          setLogs((prev) => [...prev, ...newLogs].slice(-200));
        }
      } catch { /* ignore */ }
    };
    const timer = setInterval(poll, 1000);
    return () => clearInterval(timer);
  }, [status?.running]);

  const start = useCallback(async () => {
    if (!config) return;
    setStarting(true);
    setError(null);
    setAddresses([]);
    setLogs([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const st = await startServer(config);
      if (controller.signal.aborted) return;
      setStatus(st);
    } catch (e) {
      if (!controller.signal.aborted) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(translateError(msg) || i18n.t("common:startFailed"));
      }
    } finally {
      setStarting(false);
      abortRef.current = null;
    }
  }, [config]);

  const stop = useCallback(async () => {
    // Abort any in-flight start operation
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    setStarting(false);
    setError(null);

    try {
      await stopServer();
      setStatus(null);
      setAddresses([]);
      setLogs([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(translateError(msg) || i18n.t("common:stopFailed"));
    }
  }, []);

  return { status, addresses, starting, error, logs, start, stop };
}
