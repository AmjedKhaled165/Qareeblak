import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md btn-3d",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md btn-3d",
    outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground pop-hover",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 btn-3d",
    ghost: "hover:bg-accent hover:text-accent-foreground pop-hover",
    link: "text-primary underline-offset-4 hover:underline link-hover",
}

const buttonSizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-12 rounded-lg px-8",
    icon: "h-10 w-10",
}

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: keyof typeof buttonVariants
    size?: keyof typeof buttonSizes
    className?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        return (
            <button
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    buttonVariants[variant],
                    buttonSizes[size],
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
