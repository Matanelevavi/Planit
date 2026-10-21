import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney, todayISO, toNumber } from './format'

describe('format', () => {
  it('parses decimal strings safely', () => {
    expect(toNumber('1234.50')).toBe(1234.5)
    expect(toNumber('abc')).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
  })

  it('formats shekels without decimals', () => {
    expect(formatMoney('120000', 'en')).toMatch(/120,000/)
    expect(formatMoney('120000', 'en')).toMatch(/₪|ILS/)
    expect(formatMoney(0, 'he')).toMatch(/0/)
  })

  it('formats compact amounts', () => {
    expect(formatMoney('1500000', 'en', { compact: true })).toMatch(/1\.5M|1\.5/)
  })

  it('formats ISO dates without timezone drift', () => {
    expect(formatDate('2029-11-30', 'he')).toBe('30.11.2029')
    expect(formatDate('2029-01-01', 'en')).toMatch(/01\/01\/2029/)
    expect(formatDate('garbage', 'en')).toBe('garbage')
  })

  it('builds today in local ISO form', () => {
    expect(todayISO(new Date(2025, 0, 5))).toBe('2025-01-05')
    expect(todayISO(new Date(2025, 11, 31))).toBe('2025-12-31')
  })
})
