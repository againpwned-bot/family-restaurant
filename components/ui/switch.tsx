"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

// Bigger than the shadcn default and with a 44px hit area (the ::after layer).
// Only the thumb moves (transform); the track colour changes instantly.
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default" | "lg"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent p-0.5 outline-none after:absolute after:-inset-x-2 after:-inset-y-3 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-5 data-[size=sm]:w-9 data-[size=default]:h-6 data-[size=default]:w-11 data-[size=lg]:h-8 data-[size=lg]:w-14 data-checked:bg-success data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform duration-150 ease-out group-data-[size=sm]/switch:size-4 group-data-[size=default]/switch:size-5 group-data-[size=lg]/switch:size-7 data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-checked:translate-x-4 group-data-[size=default]/switch:data-checked:translate-x-5 group-data-[size=lg]/switch:data-checked:translate-x-6"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
