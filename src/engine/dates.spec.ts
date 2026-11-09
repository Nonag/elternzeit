import { describe, expect, it } from 'vitest'
import {
  addMonths,
  lifeMonth,
  lifeMonthForCalendarMonth,
  lifeMonthIndexOf,
  overlapDays,
  primaryCalendarMonth,
} from './dates'

describe('addMonths', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths('2027-01-31', 1)).toEqual({ date: '2027-02-28', clamped: true })
    expect(addMonths('2027-01-28', 1)).toEqual({ date: '2027-02-28', clamped: false })
    expect(addMonths('2027-01-30', 13)).toEqual({ date: '2028-02-29', clamped: true })
  })
})

describe('life months (Lebensmonate)', () => {
  it('matches the official examples for a birth on the 28th', () => {
    expect(lifeMonth('2027-01-28', 1)).toMatchObject({ start: '2027-01-28', end: '2027-02-27', days: 31 })
    expect(lifeMonth('2027-01-28', 2)).toMatchObject({ start: '2027-02-28', end: '2027-03-27' })
    expect(lifeMonth('2027-01-28', 14)).toMatchObject({ start: '2028-02-28', end: '2028-03-27' })
    expect(lifeMonth('2027-01-28', 15).start).toBe('2028-03-28')
    expect(lifeMonth('2027-01-28', 32).end).toBe('2029-09-27')
  })

  it('handles births on the 29th to 31st', () => {
    expect(lifeMonth('2027-01-29', 1)).toMatchObject({ start: '2027-01-29', end: '2027-02-28' })
    expect(lifeMonth('2027-01-29', 2)).toMatchObject({ start: '2027-03-01', end: '2027-03-28' })
    expect(lifeMonth('2027-01-30', 13)).toMatchObject({ start: '2028-01-30', end: '2028-02-29' })
    expect(lifeMonth('2027-01-30', 14)).toMatchObject({ start: '2028-03-01', end: '2028-03-29' })
    expect(lifeMonth('2027-01-31', 2)).toMatchObject({ start: '2027-03-01', end: '2027-03-30' })
    expect(lifeMonth('2027-01-31', 3)).toMatchObject({ start: '2027-03-31', end: '2027-04-30' })
    expect(lifeMonth('2027-01-31', 4)).toMatchObject({ start: '2027-05-01', end: '2027-05-30' })
  })

  it('finds the life month of a date', () => {
    expect(lifeMonthIndexOf('2027-01-28', '2027-01-27')).toBe(0)
    expect(lifeMonthIndexOf('2027-01-28', '2027-02-27')).toBe(1)
    expect(lifeMonthIndexOf('2027-01-28', '2027-02-28')).toBe(2)
    expect(lifeMonthIndexOf('2027-01-28', '2028-08-01')).toBe(19)
  })

  it('books calendar months via the 16th', () => {
    expect(lifeMonthForCalendarMonth('2027-01-28', '2027-01')).toBe(1)
    expect(lifeMonthForCalendarMonth('2027-01-28', '2027-02')).toBe(1)
    expect(lifeMonthForCalendarMonth('2027-01-28', '2027-03')).toBe(2)
    expect(lifeMonthForCalendarMonth('2027-01-03', '2027-01')).toBe(1)
    expect(lifeMonthForCalendarMonth('2027-01-03', '2027-02')).toBe(2)
    expect(primaryCalendarMonth(lifeMonth('2027-01-28', 1))).toBe('2027-02')
    expect(primaryCalendarMonth(lifeMonth('2027-01-03', 1))).toBe('2027-01')
  })

  it('counts overlapping days inclusively', () => {
    expect(overlapDays('2027-02-28', '2027-03-27', '2027-01-28', '2027-03-25')).toBe(26)
  })
})
