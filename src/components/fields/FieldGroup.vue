<script setup lang="ts">
import { Separator } from '@/components/ui/separator'

defineProps<{ title: string }>()
</script>

<template>
  <section class="grid gap-4">
    <div class="flex items-center gap-3">
      <span class="text-muted-foreground text-[0.7rem] font-semibold tracking-wider whitespace-nowrap uppercase">{{ title }}</span>
      <Separator class="flex-1" />
    </div>
    <slot />
  </section>
</template>
