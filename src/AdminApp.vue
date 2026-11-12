<script setup lang="ts">
import { ArrowLeftIcon, Trash2Icon } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import AdminSetupDialog from '@/components/dialogs/AdminSetupDialog.vue'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue'
import PasswordInput from '@/components/fields/PasswordInput.vue'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'
import { formatTimestamp } from '@/engine/format'
import { confirmDialog, messageDialog } from '@/lib/dialogs'
import { ApiError, deletePlannings, listPlannings, type AdminPlanning } from '@/lib/planningApi'
import { refreshServerStatus } from '@/stores/planning'

const PASSWORD_KEY = 'elternzeit-planer:admin'

const password = ref(sessionStorage.getItem(PASSWORD_KEY) ?? '')
const signedIn = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)
const plannings = ref<AdminPlanning[]>([])
const limit = ref(0)
const selected = ref<number[]>([])

const allSelected = computed(() => plannings.value.length > 0 && selected.value.length === plannings.value.length)

function formatTime(iso: string | null): string {
  return iso ? formatTimestamp(iso) : '–'
}

async function load() {
  busy.value = true
  error.value = null
  try {
    const result = await listPlannings(password.value)
    plannings.value = result.plannings
    limit.value = result.limit
    selected.value = selected.value.filter((id) => result.plannings.some((p) => p.id === id))
    signedIn.value = true
    sessionStorage.setItem(PASSWORD_KEY, password.value)
  } catch (e) {
    signedIn.value = false
    sessionStorage.removeItem(PASSWORD_KEY)
    error.value = e instanceof ApiError && e.status === 401 ? 'Das Passwort stimmt nicht.' : 'Der Server ist nicht erreichbar.'
  } finally {
    busy.value = false
  }
}

function toggle(id: number, checked: boolean) {
  selected.value = checked ? [...selected.value, id] : selected.value.filter((s) => s !== id)
}

async function removeSelected() {
  const count = selected.value.length
  const confirmed = await confirmDialog({
    title: count === 1 ? 'Planung löschen?' : `${count} Planungen löschen?`,
    description: 'Das lässt sich nicht rückgängig machen.',
    confirmLabel: 'Löschen',
    destructive: true,
  })
  if (!confirmed) return
  try {
    await deletePlannings(password.value, selected.value)
    selected.value = []
  } catch {
    await messageDialog('Löschen fehlgeschlagen', 'Der Server ist nicht erreichbar.')
  }
  await load()
}

async function afterSetup(adminPassword: string) {
  password.value = adminPassword
  await load()
}

onMounted(() => {
  void refreshServerStatus()
  if (password.value) void load()
})
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <div class="bg-muted/30 min-h-screen">
      <header class="bg-card border-b">
        <div class="flex items-center gap-3 px-4 py-2.5">
          <h1 class="text-base leading-tight font-semibold">Elternzeit-Planer · Admin</h1>
          <Button as="a" href="/" variant="ghost" class="ml-auto"><ArrowLeftIcon /> Zum Planer</Button>
        </div>
      </header>
      <main class="mx-auto grid max-w-4xl gap-5 p-5">
        <Card v-if="!signedIn" class="mx-auto w-full max-w-sm">
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>Mit dem Admin-Passwort, das beim ersten Aufruf festgelegt wurde.</CardDescription>
          </CardHeader>
          <CardContent>
            <form class="grid gap-4" @submit.prevent="load">
              <div class="grid gap-2">
                <Label for="admin-login">Admin-Passwort</Label>
                <PasswordInput id="admin-login" v-model="password" autocomplete="current-password" />
              </div>
              <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
              <Button type="submit" :disabled="busy || !password">Anmelden</Button>
            </form>
          </CardContent>
        </Card>
        <Card v-else>
          <CardHeader>
            <CardTitle>Planungen</CardTitle>
            <CardDescription>{{ plannings.length }} von höchstens {{ limit }} auf diesem Server.</CardDescription>
            <CardAction>
              <Button variant="destructive" :disabled="!selected.length" @click="removeSelected">
                <Trash2Icon />
                {{ !selected.length ? 'Auswahl löschen …' : selected.length === 1 ? '1 Planung löschen …' : `${selected.length} Planungen löschen …` }}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-8">
                    <Checkbox
                      :model-value="allSelected"
                      aria-label="Alle auswählen"
                      @update:model-value="(checked) => (selected = checked ? plannings.map((p) => p.id) : [])"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead>Zuletzt geöffnet</TableHead>
                  <TableHead>Zuletzt gespeichert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="planning in plannings" :key="planning.id" :data-state="selected.includes(planning.id) ? 'selected' : undefined">
                  <TableCell>
                    <Checkbox
                      :model-value="selected.includes(planning.id)"
                      :aria-label="`${planning.name} auswählen`"
                      @update:model-value="(checked) => toggle(planning.id, checked === true)"
                    />
                  </TableCell>
                  <TableCell class="font-medium">{{ planning.name }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ formatTime(planning.createdAt) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ formatTime(planning.openedAt) }}</TableCell>
                  <TableCell class="text-muted-foreground">
                    {{ formatTime(planning.savedAt) }}<template v-if="planning.savedBy"> von {{ planning.savedBy }}</template>
                  </TableCell>
                </TableRow>
                <TableRow v-if="!plannings.length">
                  <TableCell colspan="5" class="text-muted-foreground py-6 text-center">Noch keine Planungen gespeichert.</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
    <ConfirmDialog />
    <AdminSetupDialog @done="afterSetup" />
  </TooltipProvider>
</template>
