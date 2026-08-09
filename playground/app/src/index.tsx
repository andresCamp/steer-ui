/* @refresh reload */
import { render } from "solid-js/web"
import { Router, Route } from "@solidjs/router"
import { DemoPage } from "./demo/DemoPage"
import { SteerIndex } from "../../../src/adapters/solid/SteerIndex"
import { SteerComponent } from "../../../src/adapters/solid/SteerComponent"
import "./steer"
import "./app.css"

render(
  () => (
    <Router>
      <Route path="/" component={DemoPage} />
      <Route path="/__steer" component={SteerIndex} />
      <Route path="/__steer/:slug" component={SteerComponent} />
    </Router>
  ),
  document.getElementById("root")!
)
