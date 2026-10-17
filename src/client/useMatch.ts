import { useEffect, useState } from "react";

export type Match = { id: number; homeTeam: string; awayTeam: string; status: string; homeScore: number; awayScore: number; venue: string | null };
export type MatchEvent = { id: number; matchId: number; type: string; minute: number; team: "home" | "away" | null; player: string; description: string | null; createdAt: string };
export type Conn = "connecting" | "connected" | "reconnecting" | "disconnected";

export const sortTimeline = (list: MatchEvent[]) =>
  [...list].sort((a, b) => a.minute - b.minute || a.createdAt.localeCompare(b.createdAt) || a.id - b.id);

// Carga HTTP inicial -> abre SSE -> mezcla eventos sin duplicados -> limpia al cambiar de partido/desmontar.
export function useMatch(matchId: number | null, onMatch?: (m: Match) => void) {
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [conn, setConn] = useState<Conn>("disconnected");

  useEffect(() => {
    if (matchId == null) return;
    let es: EventSource | null = null;
    let cancelled = false;
    setMatch(null); setEvents([]); setConn("connecting");

    const addEvent = (e: MatchEvent) =>
      setEvents((prev) => (prev.some((x) => x.id === e.id) ? prev : sortTimeline([...prev, e])));
    const updateMatch = (m: Match) => { setMatch(m); onMatch?.(m); };

    (async () => {
      const res = await fetch(`/api/matches/${matchId}`);
      if (!res.ok || cancelled) return;
      const data: { match: Match; events: MatchEvent[] } = await res.json();
      if (cancelled) return;
      updateMatch(data.match); setEvents(data.events);

      const lastId = data.events.reduce((mx, e) => Math.max(mx, e.id), 0);
      es = new EventSource(`/api/matches/${matchId}/events/stream?after=${lastId}`);
      es.onopen = () => setConn("connected");
      es.onerror = () => setConn(es!.readyState === EventSource.CLOSED ? "disconnected" : "reconnecting");
      es.addEventListener("match-event", (ev) => {
        const p = JSON.parse((ev as MessageEvent).data);
        addEvent(p.event); updateMatch(p.match);
      });
      es.addEventListener("match-status", (ev) => updateMatch(JSON.parse((ev as MessageEvent).data).match));
    })();

    return () => { cancelled = true; es?.close(); setConn("disconnected"); };
  }, [matchId]);

  return { match, events, conn };
}
