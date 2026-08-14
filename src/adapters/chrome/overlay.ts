import "./overlay.css"
import { mountOverlay } from "./mount-overlay"

// The overlay annotates the host's already-rendered DOM and never instantiates
// a host component, so it needs no Mounter and no bridge. That makes it a pure
// asset: a script tag is enough, in any stack. This is what gives a Next or
// Vue host the live app view, which the per-framework surface model could not.

mountOverlay()
