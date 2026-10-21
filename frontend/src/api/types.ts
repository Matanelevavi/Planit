export type GoalStatus = 'completed' | 'on_track' | 'at_risk' | 'off_track'

/** Money values arrive from the API as decimal strings. */
export interface Goal {
  id: number
  title: string
  target_amount: string
  current_amount: string
  target_date: string
  annual_return_pct: number
  progress_pct: number
  months_left: number
  status: GoalStatus
  expected_now: string
  suggestion_monthly_deposit: string
  created_at: string
}

export interface GoalCreateBody {
  title: string
  target_amount: string
  current_amount: string
  target_date: string
  annual_return_pct: number
}

export type GoalUpdateBody = Partial<Omit<GoalCreateBody, never>>

export interface Contribution {
  id: number
  amount: string
  date: string
  note: string
}

export interface Summary {
  goal_count: number
  total_target: string
  total_current: string
  total_required_monthly: string
  status_counts: Record<GoalStatus, number>
  most_at_risk_goal_id: number | null
}

export interface ProjectionPoint {
  month: number
  date: string
  expected: string
  low: string
  high: string
  no_deposits: string
}

export interface Projection {
  months: number
  required_monthly: string
  points: ProjectionPoint[]
  history: { date: string; balance: string }[]
}

export interface WhatIf {
  monthly: string
  annual_return_pct: number
  balance_at_target_date: string
  target_amount: string
  reaches_target: boolean
  months_to_reach: number | null
  reach_date: string | null
  required_monthly: string
}

export interface User {
  id: number
  email: string
  created_at: string
}
