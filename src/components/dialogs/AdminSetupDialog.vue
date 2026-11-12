<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PasswordInput from '@/components/fields/PasswordInput.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ApiError, MIN_ADMIN_PASSWORD_LENGTH, setupAdmin } from '@/lib/planningApi'
import { refreshServerStatus, usePlanning } from '@/stores/planning'

const emit = defineEmits<{ done: [password: string] }>()
const { server } = usePlanning()

const needsSetup = computed(() => server.status?.available === true && !server.status.adminConfigured)
const form = reactive({ password: '', repeat: '' })
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  error.value = null
  if (form.password.length < MIN_ADMIN_PASSWORD_LENGTH) error.value = `Mindestens ${MIN_ADMIN_PASSWORD_LENGTH} Zeichen.`
  else if (form.password !== form.repeat) error.value = 'Die Passwörter stimmen nicht überein.'
  if (error.value) return
  busy.value = true
  try {
    await setupAdmin(form.password)
    emit('done', form.password)
  } catch (e) {
    error.value =
      e instanceof ApiError && e.message === 'admin-exists'
        ? 'Inzwischen wurde schon ein Admin-Passwort festgelegt.'
        : 'Das hat nicht geklappt. Ist der Server erreichbar?'
  } finally {
    busy.value = false
    await refreshServerStatus()
  }
}
</script>

<template>
  <Dialog :open="needsSetup">
    <DialogContent :show-close-button="false" @interact-outside.prevent @escape-key-down.prevent>
      <form class="grid gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Admin-Passwort festlegen</DialogTitle>
          <DialogDescription>
            Der Server wird zum ersten Mal genutzt. Mit dem Admin-Passwort kannst du unter /admin alle Planungen sehen und
            löschen. Gut aufbewahren, es lässt sich in der App nicht ändern.
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="admin-password">Admin-Passwort</Label>
          <PasswordInput id="admin-password" v-model="form.password" autocomplete="new-password" />
        </div>
        <div class="grid gap-2">
          <Label for="admin-repeat">Wiederholen</Label>
          <PasswordInput id="admin-repeat" v-model="form.repeat" autocomplete="new-password" />
        </div>
        <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
        <DialogFooter>
          <Button type="submit" :disabled="busy">Festlegen</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
