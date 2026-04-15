import { cn } from "@/lib/utils"

export function Card({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl p-5 shadow-card border border-black/[.06]",
        hover &&
          "transition-[border-color,box-shadow,transform] duration-200 hover:border-black/[.10] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:-translate-y-px",
        className
      )}
    >
      {children}
    </div>
  )
}
