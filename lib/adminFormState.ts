/**
 * What the row forms in the admin panel hand back.
 *
 * Forms driven by `useActionState` return this so that the save is visible on
 * screen - the rule from AGENTS.md: a form either redirects, changes something
 * visible, or returns a message.
 */
export type AdminSaveState =
  | {
      ok?: boolean;
      error?: string;
      /**
       * A successful outcome that still needs explaining - not an error.
       *
       * Adding a prize row that replaces an existing one, for instance: the
       * operation went through, it simply did something other than what the
       * person expected. A plain "Saved" would hide that.
       */
      note?: string;
    }
  | undefined;
