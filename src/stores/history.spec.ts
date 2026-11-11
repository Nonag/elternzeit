import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useVariants } from './variants'

// The store keeps its state in localStorage, which Node does not have.
vi.hoisted(() => {
  const items = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: () => null,
    length: 0,
  }
})

describe('undo and redo', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** Lets the debounced history take the changes so far as one step. */
  async function settle() {
    await nextTick()
    vi.advanceTimersByTime(1000)
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
    expect(store.undo()).toBeNull()
    expect(store.config.value).toMatchObject({ relationship: 'married', dueDate: '' })
    expect(store.redo()).toBeNull()
    expect(store.config.value.dueDate).toBe('2027-01-15')
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
    expect(store.undo()?.id).toBe(second)
    expect(store.config.value.dueDate).toBe('')
    store.select(first)
    expect(store.redo()?.id).toBe(second)
    expect(store.config.value.dueDate).toBe('2027-03-01')
  })
})
