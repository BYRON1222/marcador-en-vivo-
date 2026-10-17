import { useCallback, useEffect, useState } from "react";
import { Conn, Match, MatchEvent, useMatch } from "./useMatch";
import { EVENT_META, EventIcon } from "./EventIcon";

const STATUS: Record<string, string> = { scheduled: "Programado", live: "En vivo", finished: "Finalizado" };
const CONN: Record<Conn, string> = { connecting: "Conectando…", connected: "Conectado", reconnecting: "Reconectando", disconnected: "Desconectado" };

const parseHash = () => {
  const [, view, id] = location.hash.match(/^#\/(public|admin)\/?(\d+)?/) ?? [];
  return { view: (view as "public" | "admin") ?? "public", id: id ? Number(id) : null };
};

export default function App() {
  const [route, setRoute] = useState(parseHash());
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { fetch("/api/matches").then((r) => r.json()).then(setMatches); }, []);

  const go = (view: string, id: number | null) => { location.hash = `#/${view}${id ? "/" + id : ""}`; };
  const selected = route.id ?? matches[0]?.id ?? null;
  const onMatch = useCallback((m: Match) => setMatches((l) => l.map((x) => (x.id === m.id ? m : x))), []);
  const { match, events, conn } = useMatch(selected, onMatch);

  return (
    <div className="app">
      <header>
        <h1>Fútbol en tiempo real</h1>
        <nav>
          <button className={route.view === "public" ? "on" : ""} onClick={() => go("public", selected)}>Vista pública</button>
          <button className={route.view === "admin" ? "on" : ""} onClick={() => go("admin", selected)}>Administración</button>
        </nav>
      </header>

      <section className="picker">
        {matches.map((m) => (
          <button key={m.id} className={"card" + (m.id === selected ? " selected" : "")} onClick={() => go(route.view, m.id)}>
            <span className="pill">{STATUS[m.status]}</span>
            <strong>{m.homeTeam} {m.homeScore} - {m.awayScore} {m.awayTeam}</strong>
          </button>
        ))}
      </section>

      {match && (
        <>
          <section className="scoreboard">
            <div className="team">{match.homeTeam}</div>
            <div className="score">{match.homeScore} - {match.awayScore}</div>
            <div className="team">{match.awayTeam}</div>
            <div className="meta">
              <span className="pill">{STATUS[match.status]}</span>
              {match.venue && <span>{match.venue}</span>}
              <span className={`conn ${conn}`}><i />{CONN[conn]}</span>
            </div>
          </section>
          {route.view === "admin" && <AdminForm match={match} />}
          <Timeline match={match} events={events} />
        </>
      )}
    </div>
  );
}

function Timeline({ match, events }: { match: Match; events: MatchEvent[] }) {
  return (
    <section>
      <h2>Línea de tiempo</h2>
      {events.length === 0 && <p className="empty">Aún no hay eventos para este partido.</p>}
      <ol className="timeline">
        {events.map((e) => {
          const meta = EVENT_META[e.type];
          return (
            <li key={e.id} style={{ borderLeftColor: meta.color }}>
              <span className="icon" style={{ background: meta.color }}><EventIcon type={e.type} /></span>
              <span className="min">{e.minute}'</span>
              <div>
                <strong style={{ color: meta.color }}>{meta.label}</strong> · {e.player}
                {e.team && <em> ({e.team === "home" ? match.homeTeam : match.awayTeam})</em>}
                {e.description && <div className="desc">{e.description}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function AdminForm({ match }: { match: Match }) {
  const empty = { type: "goal", team: "home", minute: "", player: "", description: "" };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });

  const validate = () => {
    const er: Record<string, string> = {};
    const min = Number(f.minute);
    if (f.minute === "" || !Number.isInteger(min) || min < 0 || min > 130) er.minute = "Ingresa un minuto entero entre 0 y 130";
    if (f.player.trim().length < 2) er.player = "Ingresa el nombre del jugador (mínimo 2 caracteres)";
    return er;
  };

  const submit = async () => {
    const er = validate(); setErrors(er); setMsg("");
    if (Object.keys(er).length) return;
    const res = await fetch(`/api/matches/${match.id}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    if (res.ok) { setMsg(`Evento registrado: ${EVENT_META[f.type].label} al minuto ${f.minute}`); setF({ ...empty, type: f.type, team: f.team }); }
    else setErrors((await res.json()).errors ?? { player: "Error al guardar" });
  };
  const setStatus = (status: string) =>
    fetch(`/api/matches/${match.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });

  return (
    <section className="admin">
      <h2>Registrar evento — {match.homeTeam} vs {match.awayTeam}</h2>
      <div className="grid">
        <label>Tipo
          <select value={f.type} onChange={set("type")}>
            {Object.entries(EVENT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label>Equipo
          <select value={f.team} onChange={set("team")}>
            <option value="home">{match.homeTeam} (local)</option>
            <option value="away">{match.awayTeam} (visitante)</option>
          </select>
        </label>
        <label>Minuto
          <input type="number" value={f.minute} onChange={set("minute")} placeholder="0 - 130" />
          {errors.minute && <small>{errors.minute}</small>}
        </label>
        <label>Jugador
          <input value={f.player} onChange={set("player")} placeholder="Nombre del jugador" />
          {errors.player && <small>{errors.player}</small>}
        </label>
        <label className="wide">Descripción (opcional)
          <input value={f.description} onChange={set("description")} />
          {errors.description && <small>{errors.description}</small>}
        </label>
      </div>
      <div className="actions">
        <button className="primary" onClick={submit}>Registrar evento</button>
        <span className="sep" />
        <button onClick={() => setStatus("live")}>Iniciar</button>
        <button onClick={() => setStatus("finished")}>Finalizar</button>
        {msg && <span className="ok">{msg}</span>}
      </div>
    </section>
  );
}
