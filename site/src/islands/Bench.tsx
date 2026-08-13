import { Router, Route } from "@solidjs/router"
import { SteerIndex } from "../../../src/adapters/solid/SteerIndex"
import { SteerComponent } from "../../../src/adapters/solid/SteerComponent"
import "../steer"
import "../lib/api-shim"

/**
 * The bench is the product's own surface, mounted on the marketing site.
 * The only thing missing is the dev server: the manifest and fixtures are
 * static files built by the real extractor, and note writes go to
 * localStorage instead of .steer/notes.
 */
export default function Bench() {
  return (
    <Router>
      <Route path="/__steer" component={SteerIndex} />
      <Route path="/__steer/:slug" component={SteerComponent} />
    </Router>
  )
}
