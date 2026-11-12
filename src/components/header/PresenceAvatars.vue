<script setup lang="ts">
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePresence } from '@/stores/presence'

const { others } = usePresence()

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

const label = (name: string) => `${name || 'Ohne Namen'} hat die Planung auch offen`
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
