import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Sizes are bumped on touch screens (pointer-coarse) to keep 44px targets.
// Hover/press feedback comes from the `hover-overlay` utility, which only
// animates opacity (no colour transitions; see globals.css).
const buttonVariants = cva(
  "group/button hover-overlay inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap outline-none select-none transition-transform duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
        outline:
          "border-border bg-card text-foreground aria-expanded:bg-muted dark:border-input dark:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground aria-expanded:bg-secondary",
        ghost:
          "text-foreground aria-expanded:bg-muted",
        destructive:
          "bg-destructive text-white focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:text-primary-foreground dark:focus-visible:ring-destructive/40",
        gold: "bg-gold text-gold-foreground shadow-sm shadow-gold/20",
        link: "text-brand-ink underline-offset-4 hover:underline after:hidden",
      },
      size: {
        default:
          "h-10 gap-2 px-4 pointer-coarse:h-11 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-md px-2 text-xs pointer-coarse:h-9 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8rem] pointer-coarse:h-10 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10 pointer-coarse:size-11",
        "icon-xs": "size-7 rounded-md pointer-coarse:size-9 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-md pointer-coarse:size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
