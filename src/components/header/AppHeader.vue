<script setup lang="ts">
import { MoonIcon, SunIcon } from '@lucide/vue'
import { useColorMode } from '@vueuse/core'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import EditActions from './EditActions.vue'
import PlanningMenu from './PlanningMenu.vue'
import PresenceAvatars from './PresenceAvatars.vue'
import VariantMenu from './VariantMenu.vue'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.state.value === 'dark')
</script>

<template>
  <header class="bg-card sticky top-0 z-40 border-b">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
      <h1 class="text-base leading-tight font-semibold">Elternzeit-Planer</h1>
      <div class="flex flex-wrap items-center gap-2">
        <PlanningMenu />
        <VariantMenu />
        <Separator orientation="vertical" class="mx-1 my-1" />
        <EditActions />
      </div>
      <div class="ml-auto flex items-center gap-3">
        <PresenceAvatars />
        <Button
          variant="ghost"
          size="icon"
          :aria-label="isDark ? 'Helles Design' : 'Dunkles Design'"
          :title="isDark ? 'Helles Design' : 'Dunkles Design'"
          @click="colorMode = isDark ? 'light' : 'dark'"
        >
          <SunIcon v-if="isDark" />
          <MoonIcon v-else />
        </Button>
      </div>
    </div>
  </header>
</template>
