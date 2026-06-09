import type { Event } from "./types.js";

export type Handler<P> = (payload: P) => void | Event | Promise<void | Event>;
