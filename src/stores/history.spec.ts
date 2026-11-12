import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useVariants } from './variants'

// The store keeps its state in localStorage and the history in sessionStorage, which Node does not have.
vi.hoisted(() => {
  const storage = (): Storage => {
    const items = new Map<string, string>()
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
      clear: () => items.clear(),
      key: () => null,
      length: 0,
    }
  }
  globalThis.localStorage = storage()
  globalThis.sessionStorage = storage()
})

describe('undo and redo', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** Lets the debounced history take the changes so far as one step. */
  async function settle() {
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
  }

  it('starts over with a new planning and goes back step by step', async () => {
    const store = useVariants()
    store.newPlanning()
    await settle()
    expect(store.canUndo.value).toBe(false)
    expect(store.isBlank.value).toBe(true)
    expect(store.missing.value).toHaveLength(4)
    store.config.value.relationship = 'married'
    await settle()
    store.config.value.dueDate = '2027-01-15'
    await settle()
    expect(store.isBlank.value).toBe(false)
    expect(store.undo().switched).toBeNull()
    expect(store.config.value).toMatchObject({ relationship: 'married', dueDate: '' })
    expect(store.redo().switched).toBeNull()
    expect(store.config.value.dueDate).toBe('2027-01-15')
  })

  it('counts changing something back by hand as undo, and changing it again as redo', async () => {
    const store = useVariants()
    store.newPlanning()
    await settle()
    store.config.value.siblingBonus = true
    await settle()
    store.config.value.siblingBonus = false
    await settle()
    expect(store.canUndo.value).toBe(false)
    expect(store.canRedo.value).toBe(true)
    store.config.value.siblingBonus = true
    await settle()
    expect(store.canUndo.value).toBe(true)
    expect(store.canRedo.value).toBe(false)
  })

  it('switches to the variant that an undo or redo changes', async () => {
    const store = useVariants()
    store.newPlanning()
    await settle()
    const first = store.current.value.id
    store.create()
    await settle()
    const second = store.current.value.id
    store.config.value.dueDate = '2027-03-01'
    await settle()
    store.select(first)
    expect(store.undo().switched?.id).toBe(second)
    expect(store.config.value.dueDate).toBe('')
    store.select(first)
    expect(store.redo().switched?.id).toBe(second)
    expect(store.config.value.dueDate).toBe('2027-03-01')
  })

  it('goes back to the saved planning when there is nothing to undo, and redo brings the changes back', async () => {
    const store = useVariants()
    store.newPlanning()
    await settle()
    store.markSaved('Test', 1, '2026-11-12T10:00:00Z')
    // A fresh tab: changes since the save, but no history.
    const changed = JSON.parse(JSON.stringify(store.state.variants))
    changed[0].config.siblingBonus = true
    store.replaceVariants(changed)
    await settle()
    expect(store.undoRestoresSaved.value).toBe(true)
    expect(store.undo()).toEqual({ switched: null, saved: true })
    expect(store.config.value.siblingBonus).toBe(false)
    expect(store.unsaved.value).toBe(false)
    store.redo()
    expect(store.config.value.siblingBonus).toBe(true)
    expect(store.undoRestoresSaved.value).toBe(false)
  })

  it('keeps the history over a reload of the page', async () => {
    const store = useVariants()
    store.newPlanning()
    await settle()
    store.config.value.siblingBonus = true
    await settle()
    vi.resetModules()
    const reloaded = (await import('./variants')).useVariants()
    expect(reloaded.config.value.siblingBonus).toBe(true)
    expect(reloaded.canUndo.value).toBe(true)
    reloaded.undo()
    expect(reloaded.config.value.siblingBonus).toBe(false)
  })
})
