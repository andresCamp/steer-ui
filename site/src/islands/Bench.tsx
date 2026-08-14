import { Router, Route } from "@solidjs/router"
import { SteerIndex } from "../../../src/adapters/chrome/SteerIndex"
import { SteerComponent } from "../../../src/adapters/chrome/SteerComponent"
import { connectHost } from "../../../src/adapters/chrome/host"
import "../steer"
import "../lib/api-shim"

/**
 * The bench is the product's own surface, mounted on the marketing site.
 * The only thing missing is the dev server: the manifest and fixtures are
 * static files built by the real extractor, and note writes go to
 * localStorage instead of .steer/notes.
 */
connectHost()

export default function Bench() {
  return (
    <Router>
      <Route path="/__steer" component={SteerIndex} />
      <Route path="/__steer/:slug" component={SteerComponent} />
    </Router>
  )
}
