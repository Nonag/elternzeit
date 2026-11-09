<script setup lang="ts">
import { NumberFieldInput, NumberFieldRoot } from 'reka-ui'
import { computed } from 'vue'
import { InputGroup, InputGroupAddon, InputGroupText } from '@/components/ui/input-group'

const model = defineModel<number | null>({ required: true })
const props = withDefaults(
  defineProps<{
    step?: number
    min?: number
    max?: number
    /** Maximum number of decimals that can be entered. */
    decimals?: number
    /** Short unit shown as a separate addon (€, %, h, Monate …). */
    unit?: string
    /** Allows an empty field (model becomes null). */
    nullable?: boolean
    placeholder?: string
    invalid?: boolean
    ariaLabel?: string
  }>(),
  {
    step: 1,
    min: 0,
    max: undefined,
    decimals: 0,
    unit: undefined,
    nullable: false,
    placeholder: undefined,
    invalid: false,
    ariaLabel: undefined,
  },
)

const formatOptions = computed<Intl.NumberFormatOptions>(() => ({
  minimumFractionDigits: 0,
  maximumFractionDigits: props.decimals,
  useGrouping: true,
}))

function update(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    model.value = props.nullable ? null : (props.min ?? 0)
    return
  }
  model.value = value
}
</script>

<template>
  <NumberFieldRoot
    :model-value="model"
    :min="min"
    :max="max"
    :step="step"
    :step-snapping="false"
    disable-wheel-change
    locale="de-DE"
    :format-options="formatOptions"
    @update:model-value="update"
  >
    <InputGroup class="h-9">
      <NumberFieldInput
        data-slot="input-group-control"
        :aria-invalid="invalid || undefined"
        :aria-label="ariaLabel"
        :placeholder="placeholder"
        class="placeholder:text-muted-foreground h-full w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-right text-sm tabular-nums shadow-none outline-none"
      />
      <InputGroupAddon v-if="unit" align="inline-end" class="self-stretch py-0 pr-3">
        <InputGroupText class="text-sm">{{ unit }}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  </NumberFieldRoot>
</template>
