/* @refresh reload */
import { render } from "solid-js/web"
import { Router, Route } from "@solidjs/router"
import { DemoPage } from "./demo/DemoPage"
import { BenchIndex } from "../../../src/adapters/solid/BenchIndex"
import { BenchComponent } from "../../../src/adapters/solid/BenchComponent"
import "./bench"
import "./app.css"

render(
  () => (
    <Router>
      <Route path="/" component={DemoPage} />
      <Route path="/__bench" component={BenchIndex} />
      <Route path="/__bench/:slug" component={BenchComponent} />
    </Router>
  ),
  document.getElementById("root")!
)
