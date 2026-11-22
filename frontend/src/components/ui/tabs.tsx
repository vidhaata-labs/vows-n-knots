"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({ ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />
}

// A row of tabs. It wraps onto a second line on narrow screens rather than scrolling sideways.
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex flex-wrap gap-x-5 gap-y-1 border-b border-muted/60", className)}
      {...props}
    />
  )
}

// A tab is text with a coral underline when it is the one showing.
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px inline-flex items-center gap-2 border-b-2 border-transparent px-1 pt-2 pb-2.5 font-body text-[length:var(--text-label)] text-muted outline-none transition-colors hover:text-ink focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-accent/40 data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-ink",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
