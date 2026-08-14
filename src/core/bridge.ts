import type { PublishResult, SteerRegistration } from "../ports"

// Pure. No DOM, no framework: the target is any object, which is what makes
// this testable in node and usable from both artifacts.
//
// The chrome is prebuilt and the host's register entry is compiled by the host,
// so neither can import the other. They rendezvous on a slot placed on a shared
// global. Whoever arrives first creates the slot; registrations that land before
// the chrome boots are queued and drained on boot.
//
// PROTOCOL is versioned because the two artifacts can drift: a host upgrading
// steer-ui without rebuilding, or the reverse. Left unchecked that reads as an
// empty bench with no error, so a mismatch is reported rather than swallowed
// (invariant 4: degrade visibly, never crash).

export const PROTOCOL = 1
export const SLOT = "__steer_bridge__"

interface Slot {
  protocol: number
  queue: SteerRegistration[]
  deliver?: (registration: SteerRegistration) => void
  mismatch?: { expected: number; found: number }
}

type Target = Record<string, unknown>

function slotOf(target: Target, protocol: number): Slot {
  const existing = target[SLOT] as Slot | undefined
  if (existing) return existing
  const created: Slot = { protocol, queue: [] }
  target[SLOT] = created
  return created
}

/** Called by the host's register entry. Safe before or after the chrome boots,
 *  and safe repeatedly: HMR re-runs the entry on every component edit. */
export function publishRegistration(
  target: Target,
  registration: SteerRegistration,
  protocol: number = PROTOCOL
): PublishResult {
  const slot = slotOf(target, protocol)
  if (slot.protocol !== protocol) {
    const mismatch = { expected: slot.protocol, found: protocol }
    slot.mismatch = mismatch
    return { ok: false, reason: "protocol-mismatch", ...mismatch }
  }
  if (slot.deliver) {
    slot.deliver(registration)
    return { ok: true, queued: false }
  }
  slot.queue.push(registration)
  return { ok: true, queued: true }
}

/** Called by the chrome on boot. Drains anything the host published first,
 *  then receives live. Returns a teardown for HMR of the chrome itself. */
export function receiveRegistrations(
  target: Target,
  onRegister: (registration: SteerRegistration) => void,
  protocol: number = PROTOCOL
): { ok: boolean; mismatch?: { expected: number; found: number }; stop(): void } {
  const slot = slotOf(target, protocol)
  if (slot.protocol !== protocol) {
    const mismatch = { expected: slot.protocol, found: protocol }
    slot.mismatch = mismatch
    return { ok: false, mismatch, stop() {} }
  }
  slot.deliver = onRegister
  const pending = slot.queue.splice(0, slot.queue.length)
  for (const registration of pending) onRegister(registration)
  return {
    ok: true,
    stop() {
      if (slot.deliver === onRegister) slot.deliver = undefined
    },
  }
}

/** What doctor reads to report a chrome/host version split. */
export function bridgeMismatch(target: Target): { expected: number; found: number } | undefined {
  return (target[SLOT] as Slot | undefined)?.mismatch
}
