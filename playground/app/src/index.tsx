/* @refresh reload */
import { render } from "solid-js/web"
import { Router, Route } from "@solidjs/router"
import { DemoPage } from "./demo/DemoPage"
import "./app.css"

render(
  () => (
    <Router>
      <Route path="/" component={DemoPage} />
    </Router>
  ),
  document.getElementById("root")!,
)
