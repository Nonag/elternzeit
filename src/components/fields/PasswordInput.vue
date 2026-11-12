<script setup lang="ts">
import { EyeIcon, EyeOffIcon } from '@lucide/vue'
import { ref } from 'vue'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'

defineOptions({ inheritAttrs: false })
const model = defineModel<string>({ required: true })
const visible = ref(false)
</script>

<template>
  <InputGroup>
    <InputGroupInput v-model="model" v-bind="$attrs" :type="visible ? 'text' : 'password'" />
    <InputGroupAddon align="inline-end">
      <InputGroupButton
        size="icon-xs"
        :aria-label="visible ? 'Passwort verbergen' : 'Passwort anzeigen'"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <EyeOffIcon v-if="visible" />
        <EyeIcon v-else />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
</template>
