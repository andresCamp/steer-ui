import "./chrome.css"
import { render } from "solid-js/web"
import { Router, Route } from "@solidjs/router"
import { SteerIndex } from "../solid/SteerIndex"
import { SteerComponent } from "../solid/SteerComponent"
import { connectHost } from "../solid/host"

// The bench chrome, built once and shipped as an asset. The host never compiles
// this: it is served as a plain module and meets the host only at the bridge,
// which is why a React or Vue project never sees Solid in its build.

connectHost()

const el = document.getElementById("steer-root")
if (el) {
  render(
    () => (
      <Router>
        <Route path="/__steer" component={SteerIndex} />
        <Route path="/__steer/:slug" component={SteerComponent} />
      </Router>
    ),
    el,
  )
}
