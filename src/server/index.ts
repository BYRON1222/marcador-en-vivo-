import "dotenv/config";
import express from "express";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "./db.js";
import { publish, subscribe } from "./bus.js";

const { matches, matchEvents } = schema;
const app = express();
app.use(express.json());

const eventSchema = z.object({
  type: z.enum(["goal", "foul", "substitution", "yellow_card", "red_card"], { message: "Tipo de evento inválido" }),
  team: z.enum(["home", "away"], { message: "Selecciona el equipo" }),
  minute: z.coerce.number({ message: "Minuto inválido" }).int("Debe ser entero").min(0, "Mínimo 0").max(130, "Máximo 130"),
  player: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  description: z.string().trim().max(140, "Máximo 140 caracteres").optional(),
});
const statusSchema = z.object({ status: z.enum(["scheduled", "live", "finished"]) });

const parseId = (v: string) => (/^\d+$/.test(v) ? Number(v) : NaN);
const timeline = [asc(matchEvents.minute), asc(matchEvents.createdAt), asc(matchEvents.id)];

// 1) Listado de partidos
app.get("/api/matches", async (_req, res) => {
  res.json(await db.select().from(matches).orderBy(asc(matches.id)));
});

// 2) Estado actual + historial (carga inicial por HTTP normal)
app.get("/api/matches/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [match] = Number.isNaN(id) ? [] : await db.select().from(matches).where(eq(matches.id, id));
  if (!match) return void res.status(404).json({ error: "Partido no encontrado" });
  const events = await db.select().from(matchEvents).where(eq(matchEvents.matchId, id)).orderBy(...timeline);
  res.json({ match, events });
});

// 3) Administración: registrar evento (se guarda ANTES de transmitirse)
app.post("/api/matches/:id/events", async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    const errors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return void res.status(400).json({ errors });
  }
  const d = parsed.data;
  const result = await db.transaction(async (tx) => {
    const [m] = await tx.select().from(matches).where(eq(matches.id, id));
    if (!m) return null;
    const [event] = await tx.insert(matchEvents).values({ matchId: id, ...d, description: d.description || null }).returning();
    let match = m;
    if (d.type === "goal") {
      const col = d.team === "home" ? { homeScore: sql`${matches.homeScore} + 1` } : { awayScore: sql`${matches.awayScore} + 1` };
      [match] = await tx.update(matches).set(col).where(eq(matches.id, id)).returning();
    }
    return { event, match };
  });
  if (!result) return void res.status(404).json({ error: "Partido no encontrado" });
  publish(id, { kind: "event", ...result }); // transmisión tras el commit
  res.status(201).json(result);
});

// 4) Administración: cambiar estado del partido
app.patch("/api/matches/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ errors: { status: "Estado inválido" } });
  const [match] = await db.update(matches).set(parsed.data).where(eq(matches.id, id)).returning();
  if (!match) return void res.status(404).json({ error: "Partido no encontrado" });
  publish(id, { kind: "status", match });
  res.json({ match });
});

// 5) SSE: solo eventos del partido solicitado
app.get("/api/matches/:id/events/stream", async (req, res) => {
  const id = parseId(req.params.id);
  if (Number.isNaN(id)) return void res.status(400).end();
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 2000\n\n");

  // Last-Event-ID (reconexión automática) o ?after= (primera conexión tras la carga inicial)
  let lastSent = Number(req.header("last-event-id") ?? req.query.after ?? 0) || 0;
  const send = (p: any) => {
    if (p.kind === "event") {
      if (p.event.id <= lastSent) return; // evita duplicados
      lastSent = p.event.id;
      res.write(`id: ${p.event.id}\nevent: match-event\ndata: ${JSON.stringify(p)}\n\n`);
    } else {
      res.write(`event: match-status\ndata: ${JSON.stringify(p)}\n\n`);
    }
  };

  const unsubscribe = subscribe(id, send); // primero suscribirse, luego reenviar lo perdido
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });

  const [match] = await db.select().from(matches).where(eq(matches.id, id));
  const missed = await db.select().from(matchEvents)
    .where(and(eq(matchEvents.matchId, id), gt(matchEvents.id, lastSent))).orderBy(asc(matchEvents.id));
  for (const event of missed) send({ kind: "event", event, match });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`API lista en http://localhost:${port}`));
