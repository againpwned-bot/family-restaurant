import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button hover-overlay inline-flex shrink-0 items-center justify-center rounded-full border-2 border-transparent bg-clip-padding text-sm font-bold whitespace-nowrap outline-none select-none transition-[translate,scale,box-shadow] duration-150 ease-[var(--ease-bounce)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-line shadow-[3px_3px_0_var(--shadow-hard)] active:not-aria-[haspopup]:translate-x-[2px] active:not-aria-[haspopup]:translate-y-[2px] active:not-aria-[haspopup]:shadow-[1px_1px_0_var(--shadow-hard)] hover:-translate-y-px hover:shadow-[4px_4px_0_var(--shadow-hard)]",
        outline:
          "border-line bg-card text-foreground aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground aria-expanded:bg-secondary",
        ghost:
          "text-foreground aria-expanded:bg-muted",
        destructive:
          "bg-destructive text-white border-line shadow-[3px_3px_0_var(--shadow-hard)] active:not-aria-[haspopup]:translate-x-[2px] active:not-aria-[haspopup]:translate-y-[2px] active:not-aria-[haspopup]:shadow-[1px_1px_0_var(--shadow-hard)] hover:-translate-y-px hover:shadow-[4px_4px_0_var(--shadow-hard)] focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:text-primary-foreground dark:focus-visible:ring-destructive/40",
        gold: "bg-gold text-gold-foreground border-line shadow-[3px_3px_0_var(--shadow-hard)] active:not-aria-[haspopup]:translate-x-[2px] active:not-aria-[haspopup]:translate-y-[2px] active:not-aria-[haspopup]:shadow-[1px_1px_0_var(--shadow-hard)] hover:-translate-y-px hover:shadow-[4px_4px_0_var(--shadow-hard)]",
        link: "text-brand-ink underline-offset-4 hover:underline after:hidden",
      },
      size: {
        default:
          "h-10 gap-2 px-5 pointer-coarse:h-11 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs pointer-coarse:h-9 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3.5 text-[0.8rem] pointer-coarse:h-10 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10 pointer-coarse:size-11",
        "icon-xs": "size-7 pointer-coarse:size-9 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 pointer-coarse:size-10",
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
