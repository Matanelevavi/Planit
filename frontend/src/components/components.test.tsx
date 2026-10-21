import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Goal } from '../api/types'
import { renderApp } from '../test/utils'
import { GoalCard } from './GoalCard'
import { GoalForm } from './GoalForm'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'

const goal: Goal = {
  id: 7,
  title: 'Dream apartment',
  target_amount: '120000.00',
  current_amount: '30000.00',
  target_date: '2030-01-01',
  annual_return_pct: 5,
  progress_pct: 25,
  months_left: 60,
  status: 'at_risk',
  expected_now: '40000.00',
  suggestion_monthly_deposit: '1400.00',
  created_at: '2025-01-01T00:00:00Z',
}

describe('GoalCard', () => {
  it('links to the goal and shows status, progress and the suggested deposit', () => {
    renderApp(<GoalCard goal={goal} />)
    expect(screen.getByRole('link', { name: 'Dream apartment' })).toHaveAttribute('href', '/goals/7')
    expect(screen.getByText('At risk')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25')
    expect(screen.getByText(/1,400/)).toBeInTheDocument()
  })

  it('hides the suggested deposit for completed goals', () => {
    renderApp(<GoalCard goal={{ ...goal, status: 'completed', progress_pct: 100 }} />)
    expect(screen.queryByText('Suggested deposit')).not.toBeInTheDocument()
  })

  it('renders in Hebrew', () => {
    renderApp(<GoalCard goal={goal} />, { lang: 'he' })
    expect(screen.getByText('בסיכון')).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('renders HTML in titles as plain text', () => {
    const { container } = renderApp(<GoalCard goal={{ ...goal, title: '<img src=x onerror=alert(1)>' }} />)
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  })
})

describe('StatusBadge / ProgressBar', () => {
  it('labels every status with text', () => {
    for (const [status, text] of [['completed', 'Completed'], ['on_track', 'On track'], ['at_risk', 'At risk'], ['off_track', 'Off track']] as const) {
      const { unmount } = renderApp(<StatusBadge status={status} />)
      expect(screen.getByText(text)).toBeInTheDocument()
      unmount()
    }
  })
  it('clamps progress to 0ג€“100 and survives NaN', () => {
    const { unmount } = renderApp(<ProgressBar pct={250} label="p" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    unmount()
    renderApp(<ProgressBar pct={Number.NaN} label="p" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('GoalForm', () => {
  const setup = () => {
    const onSubmit = vi.fn()
    renderApp(<GoalForm submitLabel="Create goal" busyLabel="Creatingג€¦" busy={false} onSubmit={onSubmit} />)
    return { onSubmit, user: userEvent.setup() }
  }

  it('shows validation errors and does not submit empty input', async () => {
    const { onSubmit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Create goal' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(3)
  })

  it('submits a trimmed, typed payload', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Goal name'), '  Car  ')
    await user.type(screen.getByLabelText('Target amount'), '50000')
    await user.type(screen.getByLabelText('Target date'), '2040-01-01')
    await user.click(screen.getByRole('button', { name: 'Create goal' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Car',
      target_amount: '50000',
      current_amount: '0',
      target_date: '2040-01-01',
      annual_return_pct: 5,
    })
  })

  it('rejects a past date', async () => {
    const { onSubmit, user } = setup()
    await user.type(screen.getByLabelText('Goal name'), 'Car')
    await user.type(screen.getByLabelText('Target amount'), '50000')
    await user.type(screen.getByLabelText('Target date'), '2001-01-01')
    await user.click(screen.getByRole('button', { name: 'Create goal' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Pick a date in the future.')).toBeInTheDocument()
  })

  it('disables the button while busy', () => {
    renderApp(<GoalForm submitLabel="Create goal" busyLabel="Creatingג€¦" busy onSubmit={() => {}} />)
    expect(screen.getByRole('button', { name: 'Creatingג€¦' })).toBeDisabled()
  })
})

