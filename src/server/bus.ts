import { EventEmitter } from "node:events";

// Un canal por partido: solo los suscriptores de ese partido reciben sus eventos.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export const channel = (matchId: number) => `match:${matchId}`;
export const publish = (matchId: number, payload: unknown) => emitter.emit(channel(matchId), payload);
export const subscribe = (matchId: number, fn: (p: any) => void) => {
  emitter.on(channel(matchId), fn);
  return () => emitter.off(channel(matchId), fn);
};
