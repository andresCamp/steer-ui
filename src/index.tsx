/* @refresh reload */
import { render } from "solid-js/web"
import { Router, Route } from "@solidjs/router"
import { DemoPage } from "./demo/DemoPage"
import { BenchIndex } from "./bench/BenchIndex"
import { BenchComponent } from "./bench/BenchComponent"
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
