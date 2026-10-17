import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled | live | finished
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  venue: text("venue"),
});

export const matchEvents = pgTable(
  "match_events",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // goal | foul | substitution | yellow_card | red_card
    minute: integer("minute").notNull(),
    team: text("team"), // home | away
    player: text("player").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("match_events_timeline_idx").on(t.matchId, t.minute, t.createdAt)],
);
