<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { confirmation, confirmationOptions as options } from '@/lib/dialogs'

</script>

<template>
  <!-- Controlled by the reveal state only: the buttons and Escape resolve the dialog explicitly. -->
  <AlertDialog :open="confirmation.isRevealed.value">
    <AlertDialogContent @escape-key-down="confirmation.cancel()">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ options?.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="options?.description">{{ options.description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel v-if="options?.cancelLabel !== null" @click="confirmation.cancel()">
          {{ options?.cancelLabel ?? 'Abbrechen' }}
        </AlertDialogCancel>
        <AlertDialogAction :variant="options?.destructive ? 'destructive' : 'default'" @click="confirmation.confirm()">
          {{ options?.confirmLabel ?? 'OK' }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
