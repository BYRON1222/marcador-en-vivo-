// Verifica que un evento enviado al partido A NO llega al stream del partido B.
const BASE = process.env.API ?? "http://localhost:3001";
const [A, B] = [1, 2];

async function listen(id: number) {
  const ctl = new AbortController();
  const frames: string[] = [];
  const res = await fetch(`${BASE}/api/matches/${id}/events/stream`, { signal: ctl.signal });
  console.log(`GET stream partido ${id} -> ${res.status} ${res.headers.get("content-type")}`);
  (async () => {
    const dec = new TextDecoder();
    try { for await (const chunk of res.body as any) frames.push(dec.decode(chunk)); } catch {}
  })();
  return { frames, close: () => ctl.abort() };
}

const a = await listen(A), b = await listen(B);
await new Promise((r) => setTimeout(r, 500));
const res = await fetch(`${BASE}/api/matches/${A}/events`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type: "foul", team: "home", minute: 60, player: "Prueba Aislamiento" }),
});
console.log(`POST evento al partido ${A} -> ${res.status}`);
await new Promise((r) => setTimeout(r, 1000));
const gotA = a.frames.join("").includes("Prueba Aislamiento");
const gotB = b.frames.join("").includes("Prueba Aislamiento");
console.log(`Stream partido ${A} recibió el evento: ${gotA}`);
console.log(`Stream partido ${B} recibió el evento: ${gotB}`);
a.close(); b.close();
console.log(gotA && !gotB ? "RESULTADO: OK (aislamiento correcto)" : "RESULTADO: FALLO");
process.exit(gotA && !gotB ? 0 : 1);
export {};
