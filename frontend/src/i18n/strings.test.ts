import { describe, expect, it } from 'vitest'
import { strings } from './strings'

describe('translations', () => {
  it('Hebrew and English define exactly the same keys', () => {
    expect(Object.keys(strings.he).sort()).toEqual(Object.keys(strings.en).sort())
  })
  it('has no empty strings', () => {
    for (const lang of ['he', 'en'] as const) {
      for (const [key, value] of Object.entries(strings[lang])) {
        expect(value.trim(), `${lang}.${key}`).not.toBe('')
      }
    }
  })
})
