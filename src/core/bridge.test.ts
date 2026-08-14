import { describe, expect, it, vi } from "vitest"
import type { Mounter, SteerRegistration } from "../ports"
import { bridgeMismatch, publishRegistration, receiveRegistrations, PROTOCOL } from "./bridge"

// The bridge is the seam between two artifacts that ship separately: the
// prebuilt chrome and the host-compiled register entry. Load order is not
// guaranteed by anything, so both orders are pinned here.

const stubMounter: Mounter = {
  id: "stub",
  mount: () => ({ update() {}, destroy() {} }),
  element: () => undefined,
}

function registration(tag: string): SteerRegistration {
  return { modules: { [`./${tag}.tsx`]: {} }, mounter: stubMounter, author: tag }
}

describe("bridge", () => {
  it("delivers immediately when the chrome booted first", () => {
    const target = {}
    const seen: SteerRegistration[] = []
    receiveRegistrations(target, (r) => seen.push(r))

    const result = publishRegistration(target, registration("a"))

    expect(result).toEqual({ ok: true, queued: false })
    expect(seen.map((r) => r.author)).toEqual(["a"])
  })

  it("queues and drains in order when the host registered first", () => {
    const target = {}
    expect(publishRegistration(target, registration("a"))).toEqual({ ok: true, queued: true })
    expect(publishRegistration(target, registration("b"))).toEqual({ ok: true, queued: true })

    const seen: SteerRegistration[] = []
    receiveRegistrations(target, (r) => seen.push(r))

    expect(seen.map((r) => r.author)).toEqual(["a", "b"])
  })

  it("drains the queue exactly once", () => {
    const target = {}
    publishRegistration(target, registration("a"))

    const first: SteerRegistration[] = []
    receiveRegistrations(target, (r) => first.push(r))
    const second: SteerRegistration[] = []
    receiveRegistrations(target, (r) => second.push(r))

    expect(first).toHaveLength(1)
    expect(second).toHaveLength(0)
  })

  // Vite re-runs the register entry on every component edit, so re-registration
  // is the normal case, not an error.
  it("accepts repeated registrations after boot (HMR)", () => {
    const target = {}
    const onRegister = vi.fn()
    receiveRegistrations(target, onRegister)

    publishRegistration(target, registration("a"))
    publishRegistration(target, registration("b"))
    publishRegistration(target, registration("c"))

    expect(onRegister).toHaveBeenCalledTimes(3)
  })

  it("stop() halts delivery and later registrations queue again", () => {
    const target = {}
    const seen: SteerRegistration[] = []
    const handle = receiveRegistrations(target, (r) => seen.push(r))

    publishRegistration(target, registration("live"))
    handle.stop()
    expect(publishRegistration(target, registration("after"))).toEqual({ ok: true, queued: true })
    expect(seen.map((r) => r.author)).toEqual(["live"])

    const resumed: SteerRegistration[] = []
    receiveRegistrations(target, (r) => resumed.push(r))
    expect(resumed.map((r) => r.author)).toEqual(["after"])
  })

  // A host upgrading steer-ui without rebuilding the chrome (or the reverse)
  // would otherwise render an empty bench with no explanation.
  it("reports a protocol mismatch instead of silently dropping the registration", () => {
    const target = {}
    const onRegister = vi.fn()
    receiveRegistrations(target, onRegister, PROTOCOL)

    const result = publishRegistration(target, registration("a"), PROTOCOL + 1)

    expect(result).toEqual({ ok: false, reason: "protocol-mismatch", expected: PROTOCOL, found: PROTOCOL + 1 })
    expect(onRegister).not.toHaveBeenCalled()
    expect(bridgeMismatch(target)).toEqual({ expected: PROTOCOL, found: PROTOCOL + 1 })
  })

  it("reports a mismatch when the chrome is the stale side", () => {
    const target = {}
    publishRegistration(target, registration("a"), PROTOCOL + 1)

    const received = receiveRegistrations(target, vi.fn(), PROTOCOL)

    expect(received.ok).toBe(false)
    expect(received.mismatch).toEqual({ expected: PROTOCOL + 1, found: PROTOCOL })
  })

  it("does not throw on mismatch", () => {
    const target = {}
    receiveRegistrations(target, vi.fn(), PROTOCOL)
    expect(() => publishRegistration(target, registration("a"), 99)).not.toThrow()
  })

  it("keeps separate targets isolated", () => {
    const a = {}
    const b = {}
    const seenA: SteerRegistration[] = []
    receiveRegistrations(a, (r) => seenA.push(r))
    publishRegistration(b, registration("b-only"))

    expect(seenA).toHaveLength(0)
  })
})
