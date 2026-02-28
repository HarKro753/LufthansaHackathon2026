"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TripState } from "@/types/trip";

const API_BASE = "";
const POLL_INTERVAL_MS = 5000;

interface UseTripReturn {
  trip: TripState | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTrip(): UseTripReturn {
  const [trip, setTrip] = useState<TripState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  const fetchTrip = useCallback(async (): Promise<void> => {
    // Prevent concurrent fetches (from poll + manual refetch overlapping)
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/trip`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch trip: ${res.status}`);
      }

      const data = await res.json();
      setTrip(data.trip ?? null);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Background poll — slower cadence, just a safety net
  useEffect(() => {
    fetchTrip();
    intervalRef.current = setInterval(fetchTrip, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchTrip]);

  return { trip, isLoading, error, refetch: fetchTrip };
}
