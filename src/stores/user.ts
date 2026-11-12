import { useLocalStorage } from '@vueuse/core'

/** Own name, shown to others who have the same planning open and stored with every save. */
export const userName = useLocalStorage('elternzeit-planer:user-name', '')
