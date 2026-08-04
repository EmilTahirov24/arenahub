<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Every form must show that it did something

`<form action={serverAction}>` is easy to write and, on success, demands
nothing: the action saves, `revalidatePath` runs, and the page re-renders with
the same values in the same boxes. Nothing on screen changes, so the button
reads as broken. This has been reported as a bug three times — the profile
form, the team settings form, and a game deletion that left the browser on a
page that no longer existed.

A form is finished only when one of these is true:

- it **redirects** (the new page is the answer), or
- it **changes something visible** — a row disappears, a tick appears, or
- it **returns state** and the form renders a message from it

If none holds, the button is dead as far as the person pressing it is
concerned. Use `useActionState` with a small client wrapper and pass the fields
through as `children` so they stay server-rendered — see
[components/players/ProfileForm.tsx](components/players/ProfileForm.tsx) and
[components/team/TeamSettingsForm.tsx](components/team/TeamSettingsForm.tsx).

Related: an expired session is an ordinary thing that happens to real people,
not a programmer error. Return `{ error: "Sessiyanız bitib..." }` rather than
`throw new Error("Unauthorized")`, which sends them to the framework's error
page.
