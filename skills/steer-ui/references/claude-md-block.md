# CLAUDE.md injection block

Insert verbatim (fill placeholders) between the markers so install/uninstall can find it. Place after the host's own component conventions if any.

```markdown
<!-- steer-ui:start -->
## steer-ui (component workshop)

This project uses steer-ui: the component catalog at `/__steer` is DERIVED from
`<componentDir>` source on every change. Never author stories, registration
lists, or per-component steer-ui files; add a component and the manifest picks
it up. Named states live as data in `.steer/fixtures/<slug>.json`.

- Every rendered state has a URL: `/__steer/<slug>?prop=value&...`. Composed
  children serialize as JSON `{"$component": ...}` refs in the query.
- steer-ui is the unit test for components: after editing a component, verify
  its states in the real browser (Playwright) via their state URLs, plus the
  `internal` usages the manifest lists for it. Real app flows are still
  verified against the app's own routes; steer-ui never replaces that.
- Notes protocol (feedback lives in `.steer/notes/<slug>.json`, committed):
  - Before touching a component, read its open notes; reproduce each via its
    `stateUrl`.
  - Reply as `author: "agent"`: `POST /__steer/api/notes/<slug>/reply`
    `{ id, text, author: "agent" }`.
  - Resolve only what you actually fixed, in the same change:
    `POST /__steer/api/notes/<slug>/resolve` `{ id }`.
  - Flag your own findings as new notes with a precise `stateUrl`.
- Health: `GET /__steer/api/doctor` (manifest freshness, fixtures, note
  targets). Run it before component work; repair before proceeding.
<!-- steer-ui:end -->
```
