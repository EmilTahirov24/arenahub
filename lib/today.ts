import { cacheLife } from "next/cache";

/**
 * Today's date, for `<input type="date">`.
 *
 * The "today" default in the forms was computed with `new Date()`. Cache
 * Components catches that as a prerender blocker: a value that changes from
 * render to render cannot go into a static shell, because the shell would
 * depend on when it was built.
 *
 * The date changes once a day, so it is cached for a day - which is both
 * stable and, in practice, always right.
 */
export async function todayInputValue(): Promise<string> {
  "use cache";
  cacheLife("days");
  return new Date().toISOString().slice(0, 10);
}
