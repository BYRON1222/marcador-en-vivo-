import { db, pool, schema } from "./db.js";

const { matches, matchEvents } = schema;
type Ev = [string, number, "home" | "away", string, string?];

const data: { m: typeof matches.$inferInsert; ev: Ev[] }[] = [
  { m: { homeTeam: "Comunicaciones", awayTeam: "Municipal", status: "live", venue: "Estadio Doroteo Guamuch" },
    ev: [["goal", 12, "home", "J. Morales", "Remate de cabeza"], ["foul", 25, "away", "L. Ramírez", "Falta en el medio campo"],
         ["yellow_card", 26, "away", "L. Ramírez"], ["goal", 38, "away", "D. Castillo", "Disparo de media distancia"],
         ["substitution", 46, "home", "A. Pineda", "Entra A. Pineda por R. Solís"]] },
  { m: { homeTeam: "Xelajú MC", awayTeam: "Antigua GFC", status: "live", venue: "Estadio Mario Camposeco" },
    ev: [["foul", 8, "home", "C. Herrera"], ["goal", 31, "home", "E. López", "Tiro libre directo"], ["red_card", 44, "away", "M. Sandoval", "Entrada peligrosa"]] },
  { m: { homeTeam: "Cobán Imperial", awayTeam: "Malacateco", status: "scheduled", venue: "Estadio Verapaz" }, ev: [] },
];

await db.delete(matches); // cascada a match_events
await pool.query("ALTER SEQUENCE matches_id_seq RESTART WITH 1; ALTER SEQUENCE match_events_id_seq RESTART WITH 1");
for (const { m, ev } of data) {
  const [row] = await db.insert(matches).values({
    ...m,
    homeScore: ev.filter((e) => e[0] === "goal" && e[2] === "home").length,
    awayScore: ev.filter((e) => e[0] === "goal" && e[2] === "away").length,
  }).returning();
  for (const [type, minute, team, player, description] of ev)
    await db.insert(matchEvents).values({ matchId: row.id, type, minute, team, player, description });
}
console.log("Datos de ejemplo cargados: 3 partidos");
await pool.end();
