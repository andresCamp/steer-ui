import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes } from "react-router"
import { DemoPage } from "./demo/DemoPage"
import { SteerIndex } from "../../../src/adapters/react/SteerIndex"
import { SteerComponent } from "../../../src/adapters/react/SteerComponent"
import "./steer"
import "./app.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DemoPage />} />
        <Route path="/__steer" element={<SteerIndex />} />
        <Route path="/__steer/:slug" element={<SteerComponent />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
