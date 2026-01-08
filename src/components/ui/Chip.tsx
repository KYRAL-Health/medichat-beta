import * as React from "react"

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 dark:border-zinc-800 dark:focus:ring-zinc-300 ${
          active
            ? "border-transparent bg-zinc-900 text-zinc-50 hover:bg-zinc-900/80 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/80"
            : "border-zinc-200 text-zinc-950 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-700"
        } ${className || ""}`}
        {...props}
      />
    )
  }
)
Chip.displayName = "Chip"

