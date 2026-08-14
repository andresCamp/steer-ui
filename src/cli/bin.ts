#!/usr/bin/env node
import { createRequire } from "node:module"
import { run } from "./main"

const require = createRequire(import.meta.url)
const { version } = require("../../package.json") as { version: string }

process.exit(run(process.argv.slice(2), version, new Date().toISOString()))
