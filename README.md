# Fútbol en tiempo real (SSE + Drizzle ORM + PostgreSQL)

Aplicación web con vista pública (marcador y línea de tiempo) y vista de administración (registro de eventos).
Las actualizaciones llegan al navegador con **Server-Sent Events** (`EventSource`), sin polling.

**Stack:** TypeScript · Express · PostgreSQL · Drizzle ORM / drizzle-kit · React + Vite

## Requisitos
- Node.js 20 o superior
- PostgreSQL 14 o superior en ejecución

## Instalación
```bash
npm install
cp .env.example .env        # ajusta DATABASE_URL con tus credenciales
createdb futbol             # o: psql -U postgres -c "CREATE DATABASE futbol;"
```

## Migraciones (Drizzle Kit)
Los archivos versionados están en `drizzle/`:
- `0000_init.sql`: tablas `matches` y `match_events`
- `0001_add_venue_and_event_team.sql`: agrega `matches.venue` y `match_events.team`

```bash
npm run db:generate   # genera una nueva migración a partir de src/server/schema.ts
npm run db:migrate    # aplica las migraciones pendientes
npm run db:seed       # (opcional) carga 3 partidos de ejemplo
```
No se modifica la base de datos manualmente: todo cambio de esquema se hace en `schema.ts` + `db:generate` + `db:migrate`.

## Ejecución
```bash
npm run dev           # API en :3001 y cliente en http://localhost:5173
```
- Vista pública: `http://localhost:5173/#/public/1`
- Administración: `http://localhost:5173/#/admin/1`

## API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/matches` | Lista de partidos |
| GET | `/api/matches/:id` | Estado actual + historial (carga inicial) |
| POST | `/api/matches/:id/events` | Registra un evento (validado con zod); se guarda y luego se transmite |
| PATCH | `/api/matches/:id` | Cambia el estado del partido |
| GET | `/api/matches/:id/events/stream` | Stream SSE (`text/event-stream`) solo de ese partido |

## Cómo funciona SSE
1. El cliente carga estado e historial con `GET /api/matches/:id`.
2. Después abre `EventSource` con `?after=<último id>`; el navegador envía `Last-Event-ID` al reconectar.
3. El servidor se suscribe a un canal por partido (`match:<id>`), reenvía los eventos perdidos desde la base de datos y descarta ids ya enviados, por lo que no hay duplicados.
4. El cliente también deduplica por `id`, muestra el estado (conectado / reconectando / desconectado) y cierra el `EventSource` al cambiar de partido o salir de la vista.

## Verificar el aislamiento entre partidos
Con la API en marcha: `npm run verify:isolation` (envía un evento al partido 1 y comprueba que el stream del partido 2 no lo recibe).
