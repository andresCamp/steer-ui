import { For, mergeProps } from "solid-js"

export interface AntStepsProps {
  /** Step labels, in order. */
  steps?: string[]
  /** Index of the step in progress. */
  current?: number
  /** The pre-review draft: finished and pending steps share one colour. */
  draft?: boolean
}

/** Ant Design steps, vertical: numbered dots joined by a rail. */
export function AntSteps(props: AntStepsProps) {
  const p = mergeProps({ steps: ["Pin the note", "Agent reads", "Reply lands"], current: 1, draft: false }, props)

  return (
    <div class="flex flex-col">
      <For each={p.steps}>
        {(step, i) => {
          const done = () => i() < p.current
          const active = () => i() === p.current
          return (
            <div class="flex gap-3">
              <div class="flex flex-col items-center">
                <span
                  class={`refines flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] ${
                    done()
                      ? p.draft
                        ? "bg-[rgba(0,0,0,0.06)] text-[rgba(0,0,0,0.45)]"
                        : "bg-[#1677ff] text-white"
                      : active()
                        ? "border border-[#1677ff] text-[#1677ff]"
                        : "bg-[rgba(0,0,0,0.06)] text-[rgba(0,0,0,0.45)]"
                  }`}
                >
                  {done() && !p.draft ? "✓" : i() + 1}
                </span>
                {i() < p.steps.length - 1 && <span class="my-1 w-px flex-1 bg-[rgba(0,0,0,0.1)]" />}
              </div>
              <span
                class={`pb-4 text-[14px] ${
                  active() ? "text-[rgba(0,0,0,0.88)]" : "text-[rgba(0,0,0,0.45)]"
                }`}
              >
                {step}
              </span>
            </div>
          )
        }}
      </For>
    </div>
  )
}
