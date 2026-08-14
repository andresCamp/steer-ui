import { render } from "solid-js/web"
import { Router, Route } from "@solidjs/router"
import { SteerIndex } from "./SteerIndex"
import { SteerComponent } from "./SteerComponent"
import { connectHost } from "./host"

/** Own document for /__steer. The host app never imports this. */
export function mountBench(): void {
  const el = document.getElementById("steer-root")
  if (!el) return
  connectHost()
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
