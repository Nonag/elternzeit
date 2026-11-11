<script setup lang="ts">
import { ChevronDownIcon, CopyIcon, FileIcon, FilePlusIcon, PencilIcon, Trash2Icon } from '@lucide/vue'
import { SelectTrigger as SelectTriggerPrimitive } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select'
import { useVariants } from '@/stores/variants'
import { useVariantActions } from './useVariantActions'

const { state, current } = useVariants()
const actions = useVariantActions()
</script>

<template>
  <!-- The name opens the list of variants; the arrow opens the variant menu. -->
  <ButtonGroup aria-label="Variante">
    <Select :model-value="state.currentId" @update:model-value="(id) => actions.select(String(id))">
      <SelectTriggerPrimitive as-child>
        <Button variant="outline" class="max-w-56 justify-start">
          <FileIcon class="text-muted-foreground" />
          <span class="truncate">{{ current.name }}</span>
        </Button>
      </SelectTriggerPrimitive>
      <SelectContent position="popper" align="start">
        <SelectGroup>
          <SelectLabel>Varianten</SelectLabel>
          <SelectItem v-for="variant in state.variants" :key="variant.id" :value="variant.id">{{ variant.name }}</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="icon" aria-label="Menü Variante"><ChevronDownIcon /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-60">
        <DropdownMenuItem @select="actions.create"><FilePlusIcon /> Neue Variante</DropdownMenuItem>
        <DropdownMenuItem @select="actions.copy"><CopyIcon /> Variante kopieren</DropdownMenuItem>
        <DropdownMenuItem @select="actions.rename"><PencilIcon /> Variante umbenennen …</DropdownMenuItem>
        <DropdownMenuItem :disabled="state.variants.length <= 1" variant="destructive" @select="actions.remove">
          <Trash2Icon /> Variante löschen …
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </ButtonGroup>
</template>
