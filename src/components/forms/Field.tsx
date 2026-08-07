import { Show, type JSX } from "solid-js"

export interface FieldProps {
  /** Label rendered above the control */
  label?: string
  /** Helper text under the control */
  hint?: string
  /** Mark the field as required */
  required?: boolean
  children?: JSX.Element
}

/** Form field wrapper: label, any control, hint. Lives in a nested folder. */
export function Field(props: FieldProps) {
  return (
    <div class="flex w-64 flex-col gap-1.5">
      <Show when={props.label}>
        <span class="text-sm font-medium text-zinc-700">
          {props.label}
          <Show when={props.required}>
            <span class="ml-0.5 text-red-500">*</span>
          </Show>
        </span>
      </Show>
      {props.children}
      <Show when={props.hint}>
        <span class="text-xs text-zinc-400">{props.hint}</span>
      </Show>
    </div>
  )
}
