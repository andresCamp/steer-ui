# CLAUDE.md injection block

Insert verbatim (fill placeholders) between the markers so install/uninstall can find it. Place after the host's own component conventions if any.

```markdown
<!-- bench:start -->
## Bench (component workshop)

This project uses bench: the component catalog at `/__bench` is DERIVED from
`<componentDir>` source on every change. Never author stories, registration
lists, or per-component bench files; add a component and the manifest picks
it up. Named states live as data in `.bench/fixtures/<slug>.json`.

- Every rendered state has a URL: `/__bench/<slug>?prop=value&...`. Composed
  children serialize as JSON `{"$component": ...}` refs in the query.
- Bench is the unit test for components: after editing a component, verify
  its states in the real browser (Playwright) via their state URLs, plus the
  `internal` usages the manifest lists for it. Real app flows are still
  verified against the app's own routes; bench never replaces that.
- Notes protocol (feedback lives in `.bench/notes/<slug>.json`, committed):
  - Before touching a component, read its open notes; reproduce each via its
    `stateUrl`.
  - Reply as `author: "agent"`: `POST /__bench/api/notes/<slug>/reply`
    `{ id, text, author: "agent" }`.
  - Resolve only what you actually fixed, in the same change:
    `POST /__bench/api/notes/<slug>/resolve` `{ id }`.
  - Flag your own findings as new notes with a precise `stateUrl`.
- Health: `GET /__bench/api/doctor` (manifest freshness, fixtures, note
  targets). Run it before component work; repair before proceeding.
<!-- bench:end -->
```
