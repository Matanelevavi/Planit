import { describe, expect, it } from 'vitest'
import {
  validateContribution,
  validateEmail,
  validateGoal,
  validateNewPassword,
  type GoalFormValues,
} from './validation'

const TODAY = '2025-06-15'
const good: GoalFormValues = {
  title: 'Apartment',
  targetAmount: '100000',
  currentAmount: '0',
  targetDate: '2030-01-01',
  annualReturn: '5',
}

describe('validateGoal', () => {
  it('accepts a valid goal', () => {
    expect(validateGoal(good, TODAY)).toEqual({})
  })
  it('accepts an empty "already saved"', () => {
    expect(validateGoal({ ...good, currentAmount: '' }, TODAY)).toEqual({})
  })

  it.each([
    [{ title: '' }, 'title', 'required'],
    [{ title: '   ' }, 'title', 'required'],
    [{ title: 'x'.repeat(101) }, 'title', 'titleTooLong'],
    [{ targetAmount: '' }, 'targetAmount', 'required'],
    [{ targetAmount: '0' }, 'targetAmount', 'mustBePositive'],
    [{ targetAmount: '-5' }, 'targetAmount', 'mustBePositive'],
    [{ targetAmount: '10.123' }, 'targetAmount', 'mustBePositive'],
    [{ targetAmount: '9999999999' }, 'targetAmount', 'tooBig'],
    [{ currentAmount: '-1' }, 'currentAmount', 'mustBeNonNegative'],
    [{ targetDate: '' }, 'targetDate', 'required'],
    [{ targetDate: '2025-06-15' }, 'targetDate', 'dateMustBeFuture'],
    [{ targetDate: '2020-01-01' }, 'targetDate', 'dateMustBeFuture'],
    [{ targetDate: '4332-03-02' }, 'targetDate', 'dateTooFar'],
    [{ annualReturn: '' }, 'annualReturn', 'returnRange'],
    [{ annualReturn: '-1' }, 'annualReturn', 'returnRange'],
    [{ annualReturn: '21' }, 'annualReturn', 'returnRange'],
  ])('rejects %o', (over, field, message) => {
    expect(validateGoal({ ...good, ...over }, TODAY)[field as keyof GoalFormValues]).toBe(message)
  })
})

describe('validateContribution', () => {
  const ok = { amount: '100', date: '2025-06-01', note: '' }
  it('accepts deposits and withdrawals', () => {
    expect(validateContribution(ok, TODAY)).toEqual({})
    expect(validateContribution({ ...ok, amount: '-50' }, TODAY)).toEqual({})
  })
  it('rejects zero, empty, future dates and long notes', () => {
    expect(validateContribution({ ...ok, amount: '0' }, TODAY).amount).toBe('notZero')
    expect(validateContribution({ ...ok, amount: '' }, TODAY).amount).toBe('required')
    expect(validateContribution({ ...ok, date: '2025-06-16' }, TODAY).date).toBe('dateNotFuture')
    expect(validateContribution({ ...ok, note: 'x'.repeat(201) }, TODAY).note).toBe('noteTooLong')
  })
})

describe('auth validation', () => {
  it('validates e-mails', () => {
    expect(validateEmail('a@b.co')).toBe(true)
    expect(validateEmail(' a@b.co ')).toBe(true)
    expect(validateEmail('nope')).toBe(false)
    expect(validateEmail('a@b')).toBe(false)
    expect(validateEmail('a b@c.com')).toBe(false)
  })
  it('enforces the password policy used by the server', () => {
    expect(validateNewPassword('short1')).toBe('passwordTooShort')
    expect(validateNewPassword('1234567890123')).toBe('passwordTooWeak')
    expect(validateNewPassword('onlyletterslong')).toBe('passwordTooWeak')
    expect(validateNewPassword('סיסמה-ארוכה-12')).toBeNull()
    expect(validateNewPassword('correct-horse-9')).toBeNull()
  })
})
