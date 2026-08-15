# Install steer-ui

You are an agent installing steer-ui into the project you are working in. Follow
this exactly. It takes about a minute.

steer-ui gives the project a component bench at `/__steer`: every component
derived from source, every rendered state addressable as a URL, and notes the
human pins on the canvas that come back to you as JSON.

**The bar: the person who pasted this should not have to decide anything, wait
for anything, or debug anything.** They hear one of two things from you when you
are done, and nothing in between. Do not ask them questions. Do not report
progress. Do not stop halfway.

---

## 1. Read the project

Work these out yourself. You are here because a fixed heuristic gets them wrong.

- **Which package?** In a monorepo, the app with the components, not the git root.
- **Framework?** solid, react, vue or svelte, from that package's dependencies.
- **Where do components actually live?** Look. It is often not `src/components`.
- **Is there a stylesheet** the app loads globally? The bench loads it so your
  components look the way they do in the app.
- **Are prop types imported from other modules, or built from intersections?**
  If so you want `--typecheck`, otherwise those props come back as knobless.
- **Bundler.** Vite is the supported path today. Anything else, see step 6.

## 2. Install and run init

```bash
npm install --save-dev steer-ui        # or pnpm add -D / yarn add -D
npx steer-ui init
```

With no flags it detects. Pass only what you determined that detection would get
wrong:

```bash
npx steer-ui init \
  --root apps/web \
  --framework vue \
  --components app/ui \
  --styles src/styles/globals.css \
  --typecheck \
  --author "<the human's name, from git config user.name>"
```

`init` writes the register file, scaffolds `.steer/`, adds one `.gitignore` line
and writes a receipt at `.steer/install.json`. It is idempotent: run it again
freely, it keeps what is already there.

If it refuses, it names the flag that fixes it. Correct the flag and run it
again. Do not involve the human.

## 3. Place the one line it prints

`init` will not edit the bundler config, because that file is yours and its
shape is unpredictable. It prints a snippet with the paths already filled in.
Add it to the plugins array, **after** the framework plugin:

```ts
import { steer } from "steer-ui/vite"

export default defineConfig({
  plugins: [
    vue(),                     // whatever the framework plugin is
    steer({ componentDir: "src/components", register: "src/steer.ts", styles: "src/app.css" }),
  ],
})
```

Nothing else in the app should import the register file. If it does, the bench
ships to production, which is a bug.

## 4. Tell the next agent

Add this to `AGENTS.md` (create it if absent; also mirror into `CLAUDE.md` if
that file already exists):

```md
## steer-ui

Components have a bench at `/__steer`. Every state is a URL.

- Before changing a component, read its open notes: `.steer/notes/<slug>.json`.
- Reproduce each note by opening its `stateUrl`.
- After changing a component, re-check its states and its `internal` usages;
  the manifest's usage scan says what composes it.
- Reply as `author: "agent"`, and resolve only what you actually fixed, in the
  same change as the fix.
- Health check: `GET /__steer/api/doctor`.
- steer-ui is the unit test for components. Real app flows stay with your normal
  end to end tests.
```

## 5. Check your own work, then repair

Start the dev server and confirm all four. Do not skip this: a bench that loads
empty looks identical to one that is broken, and the person will not tell you,
they will just leave.

```bash
curl -s localhost:<port>/__steer/api/doctor     # must be "pass"
curl -s localhost:<port>/__steer/api/manifest   # must list their components with props
```

Then open `/__steer` in a browser and confirm components actually render. If
anything is empty:

- **No components in the manifest** means `--components` points at the wrong
  directory. Re-run init with the right one.
- **Components listed but the bench renders "not registered here"** means the
  register glob missed them. Check the extension and the path in the register
  file.
- **Blank page** usually means the plugin line is not in the config, or it is
  before the framework plugin.

Fix it yourself and check again.

## 6. When to stop instead

Stop, change nothing, and say so in one sentence:

- **Not a Vite project.** Next, webpack and others need the standalone server
  and a proxy. That path exists (`steer-ui/server`) but has not been exercised
  against a real host, so do not improvise it.
- **The framework has no mounter.** solid, react, vue and svelte are supported.
  Anything else needs work in the steer-ui repository first.

Leaving nothing behind is a fine outcome. A half install is not.

## When you are done

Say exactly one thing, and nothing else:

> steer-ui is installed. Run your dev server and open /__steer

## Uninstall

`.steer/install.json` records everything that was written. Remove those files,
the plugin line, and the AGENTS.md block. Fixtures are cheap to delete, but
**open notes are the human's feedback**: list them and offer to archive rather
than deleting them.
