import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes } from "react-router"
import { DemoPage } from "./demo/DemoPage"
import { BenchIndex } from "../../../src/adapters/react/BenchIndex"
import { BenchComponent } from "../../../src/adapters/react/BenchComponent"
import "./bench"
import "./app.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DemoPage />} />
        <Route path="/__bench" element={<BenchIndex />} />
        <Route path="/__bench/:slug" element={<BenchComponent />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
