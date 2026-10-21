import type { StringKey } from '../i18n/strings'
import { todayISO } from './format'

export const MAX_AMOUNT = 1_000_000_000
export type Errors<T extends string> = Partial<Record<T, StringKey>>

function parseAmount(raw: string): number {
  return raw.trim() === '' ? NaN : Number(raw)
}

function hasMoreThanTwoDecimals(raw: string): boolean {
  const [, frac = ''] = raw.trim().split('.')
  return frac.length > 2
}

export interface GoalFormValues {
  title: string
  targetAmount: string
  currentAmount: string
  targetDate: string
  annualReturn: string
}
export type GoalField = keyof GoalFormValues

export const EMPTY_GOAL: GoalFormValues = {
  title: '',
  targetAmount: '',
  currentAmount: '',
  targetDate: '',
  annualReturn: '5',
}

/** Mirrors the server-side rules so users get instant feedback; the server remains the authority. */
export function validateGoal(v: GoalFormValues, today: string = todayISO()): Errors<GoalField> {
  const e: Errors<GoalField> = {}
  const title = v.title.trim()
  if (!title) e.title = 'required'
  else if (title.length > 100) e.title = 'titleTooLong'

  const target = parseAmount(v.targetAmount)
  if (Number.isNaN(target)) e.targetAmount = 'required'
  else if (target <= 0 || hasMoreThanTwoDecimals(v.targetAmount)) e.targetAmount = 'mustBePositive'
  else if (target > MAX_AMOUNT) e.targetAmount = 'tooBig'

  if (v.currentAmount.trim() !== '') {
    const cur = parseAmount(v.currentAmount)
    if (Number.isNaN(cur) || cur < 0 || hasMoreThanTwoDecimals(v.currentAmount)) e.currentAmount = 'mustBeNonNegative'
    else if (cur > MAX_AMOUNT) e.currentAmount = 'tooBig'
  }

  if (!v.targetDate) e.targetDate = 'required'
  else if (v.targetDate <= today) e.targetDate = 'dateMustBeFuture'
  else {
    const limit = new Date(today)
    limit.setFullYear(limit.getFullYear() + 60)
    if (new Date(v.targetDate) > limit) e.targetDate = 'dateTooFar'
  }

  const ret = parseAmount(v.annualReturn)
  if (Number.isNaN(ret) || ret < 0 || ret > 20) e.annualReturn = 'returnRange'
  return e
}

export interface ContributionFormValues {
  amount: string
  date: string
  note: string
}
export type ContributionField = keyof ContributionFormValues

export function validateContribution(v: ContributionFormValues, today: string = todayISO()): Errors<ContributionField> {
  const e: Errors<ContributionField> = {}
  const amount = parseAmount(v.amount)
  if (Number.isNaN(amount)) e.amount = 'required'
  else if (amount === 0) e.amount = 'notZero'
  else if (Math.abs(amount) > MAX_AMOUNT || hasMoreThanTwoDecimals(v.amount)) e.amount = 'tooBig'
  if (v.date && v.date > today) e.date = 'dateNotFuture'
  if (v.note.length > 200) e.note = 'noteTooLong'
  return e
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export function validateNewPassword(pw: string, email = ''): StringKey | null {
  if (pw.length < 10) return 'passwordTooShort'
  if (/^\d+$/.test(pw) || /^\p{L}+$/u.test(pw)) return 'passwordTooWeak'
  // mirrors the server rule: the part of the e-mail before "@" (if 4+ chars) must not appear in the password
  const local = email.trim().toLowerCase().split('@')[0]
  if (local.length >= 4 && pw.toLowerCase().includes(local)) return 'passwordSimilar'
  return null
}
