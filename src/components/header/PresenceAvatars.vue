<script setup lang="ts">
import { watch } from 'vue'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { notify } from '@/lib/toasts'
import { usePresence } from '@/stores/presence'

const { others, reportedFor } = usePresence()

const COLORS = ['bg-sky-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-violet-600', 'bg-teal-600', 'bg-orange-600', 'bg-fuchsia-600']

/** The same browser keeps its colour. */
function color(client: string): string {
  let hash = 0
  for (const char of client) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

const displayName = (name: string) => name || 'Jemand'
const label = (name: string) => `${displayName(name)} hat die Planung auch offen`

// Someone opening the planning stays as a toast until closed; leaving replaces it and closes after 5 seconds.
watch([others, reportedFor], ([now, planning], [before, previousPlanning]) => {
  if (!planning || planning !== previousPlanning) return
  for (const other of now) {
    if (!before.some((b) => b.client === other.client)) notify(`${displayName(other.name)} hat die Planung geöffnet`, { id: `presence-${other.client}`, persistent: true })
  }
  for (const other of before) {
    if (!now.some((n) => n.client === other.client)) notify(`${displayName(other.name)} hat die Planung geschlossen`, { id: `presence-${other.client}` })
  }
})
</script>

<template>
  <div v-if="others.length" class="flex -space-x-2">
    <Tooltip v-for="other in others" :key="other.client">
      <TooltipTrigger as-child>
        <Avatar class="ring-background ring-2" :aria-label="label(other.name)">
          <AvatarFallback :class="[color(other.client), 'text-xs font-medium text-white']">{{ initials(other.name) }}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{{ label(other.name) }}</TooltipContent>
    </Tooltip>
  </div>
</template>
