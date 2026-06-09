import type { Event, EventCtor } from "./types.js";

let counter = 0;

// Declare an event. Each call is a distinct event with a unique `type`; the optional name is only
// for readability. The returned constructor makes instances: `Token("hi") -> { type, payload }`.
export function event<P = void>(name?: string): EventCtor<P> {
  const type = `${name ?? "event"}#${counter++}`;
  const ctor = ((payload: P): Event<P> => ({ type, payload })) as EventCtor<P>;
  ctor.type = type;
  return ctor;
}
