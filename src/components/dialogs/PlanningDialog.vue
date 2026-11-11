<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MIN_PASSWORD_LENGTH } from '@/lib/planningApi'
import type { PlanningDialogMode } from '@/stores/planning'

const props = defineProps<{
  mode: PlanningDialogMode
  /** Name of the open planning (preset for opening, fixed when asking for the password). */
  name: string | null
  busy: boolean
  error: string | null
  warning: string | null
  /** What the password is needed for (password mode). */
  purpose: 'save' | 'delete'
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [value: { name: string; password: string; remember: boolean }] }>()

const form = reactive({ name: '', password: '', repeat: '', remember: true })
const inputError = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, { name: props.mode === 'create' ? '' : (props.name ?? ''), password: '', repeat: '', remember: true })
  inputError.value = null
})

const text = computed(() => {
  switch (props.mode) {
    case 'open':
      return {
        title: 'Planung öffnen',
        description: 'Lädt eine Planung vom Server. Die Varianten in diesem Browser werden dabei ersetzt.',
        action: 'Öffnen',
      }
    case 'create':
      return {
        title: 'Als neue Planung speichern',
        description: 'Speichert alle Varianten auf dem Server. Wer Name und Passwort kennt, kann die Planung öffnen und ändern.',
        action: 'Speichern',
      }
    default:
      return {
        title: 'Passwort eingeben',
        description: `Zum ${props.purpose === 'delete' ? 'Löschen' : 'Speichern'} von „${props.name}“ wird das Passwort gebraucht.`,
        action: props.purpose === 'delete' ? 'Löschen' : 'Speichern',
      }
  }
})

function submit() {
  inputError.value = null
  if (props.mode !== 'password' && !form.name.trim()) inputError.value = 'Bitte einen Namen eingeben.'
  else if (!form.password) inputError.value = 'Bitte das Passwort eingeben.'
  else if (props.mode === 'create' && form.password.length < MIN_PASSWORD_LENGTH)
    inputError.value = `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`
  else if (props.mode === 'create' && form.password !== form.repeat) inputError.value = 'Die Passwörter stimmen nicht überein.'
  else emit('submit', { name: form.name.trim(), password: form.password, remember: form.remember })
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <form class="grid gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ text.title }}</DialogTitle>
          <DialogDescription>{{ text.description }}</DialogDescription>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="planning-name">Name der Planung</Label>
          <Input id="planning-name" v-model="form.name" :disabled="mode === 'password'" autocomplete="username" />
        </div>
        <div class="grid gap-2">
          <Label for="planning-password">Passwort</Label>
          <Input
            id="planning-password"
            v-model="form.password"
            type="password"
            :autocomplete="mode === 'create' ? 'new-password' : 'current-password'"
          />
        </div>
        <div v-if="mode === 'create'" class="grid gap-2">
          <Label for="planning-repeat">Passwort wiederholen</Label>
          <Input id="planning-repeat" v-model="form.repeat" type="password" autocomplete="new-password" />
        </div>
        <Label class="font-normal"><Checkbox v-model="form.remember" /> Passwort auf diesem Gerät merken</Label>
        <p v-if="warning" class="text-sm text-amber-700 dark:text-amber-400">{{ warning }}</p>
        <p v-if="inputError ?? error" class="text-destructive text-sm">{{ inputError ?? error }}</p>
        <DialogFooter>
          <DialogClose as-child><Button type="button" variant="outline">Abbrechen</Button></DialogClose>
          <Button type="submit" :disabled="busy">{{ text.action }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
