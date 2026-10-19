"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
function Toggle({ className, pressed, defaultPressed=false, onPressedChange, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean; defaultPressed?: boolean; onPressedChange?: (v:boolean)=>void; variant?: string; size?: string }) { const [inner,setInner]=React.useState(defaultPressed); const active=pressed??inner; return <button aria-pressed={active} className={cn("inline-flex items-center justify-center rounded-lg", active&&"bg-muted", className)} onClick={(e)=>{props.onClick?.(e); if(!e.defaultPrevented){setInner(!active);onPressedChange?.(!active)}}} {...props}>{children}</button> }
export { Toggle }
export const toggleVariants = ({className}:{className?:string}={}) => cn("inline-flex items-center justify-center",className)
