// Barrel for node-side consumers (tests, CLIs, bundler plugins). Browser
// surfaces import pure modules directly (core/, adapters/solid/) so node
// and bundler code never enters an app bundle.

export * from "./core/model"
export * from "./core/extract"
export * from "./core/manifest"
export * from "./core/state-url"
export * from "./core/notes"
export * from "./core/doctor"
export * from "./core/engine"
export * from "./ports"
export * from "./adapters/memory"
export * from "./adapters/node-fs"
export { handleSteerRequest, type SteerRequestOptions } from "./adapters/http"
export { createSteerServer, type SteerServer, type SteerServerOptions } from "./adapters/node-server"
export { steer, type SteerPluginOptions } from "./adapters/vite"
