import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes } from "react-router"
import { SteerIndex } from "./SteerIndex"
import { SteerComponent } from "./SteerComponent"

/** Own document for /__steer. The host app never imports this. */
export function mountBench(): void {
  const el = document.getElementById("steer-root")
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/__steer" element={<SteerIndex />} />
          <Route path="/__steer/:slug" element={<SteerComponent />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  )
}
