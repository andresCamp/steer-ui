# Install playbook

The install procedure lives at `https://steerui.com/install.md`, and also ships
in the package at `node_modules/steer-ui/install.md`. It is the same document
the pasted-prompt door uses. Follow that, not a copy of it: two install
procedures means one of them is quietly wrong.

This file holds only what that document deliberately leaves out.

## Why init does not touch the bundler config

It is arbitrary: `defineConfig(() => ...)`, conditionals, spread plugin arrays,
generated configs. AST-editing it is where a tool starts damaging real projects,
which is the one outcome a person cannot recover from. The CLI prints the
snippet with resolved paths and you place it. This is the split the whole
install rests on: the CLI does what is deterministic, you do what needs reading
an unfamiliar file.

## Named gaps, and why improvising through them is worse than stopping

- **Non-Vite hosts.** `steer-ui/server` runs the same API standalone and the
  host proxies `/__steer/api/*` to it, then serves `dist/chrome/*` statically
  and the bench document itself. This has NOT been exercised against a real
  Next or webpack host. Propose it, do not improvise it mid-install.
- **A framework with no Mounter.** Solid, React, Vue and Svelte ship one. A
  fifth needs ~40 lines against `adapters/mount/contract.test.ts` in the lab,
  and an Extractor for its source. That is lab work.
- **Overlay only.** The overlay reads the host's rendered DOM and needs no
  Mounter at all, so a stack with no bench support can still get page notes.

## Upgrading

`.steer/install.json` is the receipt: version, framework, resolved paths, and
what was written. Compare its `version` against the installed package, bump the
dependency, re-run `init` (idempotent), and rebuild nothing else. The chrome
ships prebuilt inside the package, so there is no drift to reconcile by hand and
no commit-hash comments to chase.

## Uninstall

Read the receipt, remove what it lists, remove the plugin line and the
AGENTS.md block. `.steer/fixtures` is cheap to delete with a nod. **Open notes
are human feedback**: enumerate them with text and author, offer archiving to
`docs/steer-ui-notes-archive/`, and default to archive. Never delete them
silently.
