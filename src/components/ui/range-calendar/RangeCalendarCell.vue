<script lang="ts" setup>
import type { RangeCalendarCellProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { cn } from 'cn'
import { RangeCalendarCell, useForwardProps } from 'reka-ui'

const props = defineProps<RangeCalendarCellProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <RangeCalendarCell
    data-slot="range-calendar-cell"
    :class="cn([
      'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
      // Days of other months keep their place but are not shown
      '[&:has([data-outside-view])]:invisible',
      // Selected range, and the preview while picking the end
      '[&:has([data-selected])]:bg-primary/20 [&:has([data-highlighted])]:bg-primary/15',
      'first:[&:has([data-selected])]:rounded-l-md last:[&:has([data-selected])]:rounded-r-md [&:has([data-selection-start])]:rounded-l-md [&:has([data-selection-end])]:rounded-r-md',
      'first:[&:has([data-highlighted])]:rounded-l-md last:[&:has([data-highlighted])]:rounded-r-md [&:has([data-highlighted-start])]:rounded-l-md [&:has([data-highlighted-end])]:rounded-r-md',
    ], props.class)"
    v-bind="forwardedProps"
  >
    <slot />
  </RangeCalendarCell>
</template>
