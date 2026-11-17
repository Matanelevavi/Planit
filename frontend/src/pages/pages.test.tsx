import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter } from 'axios'
import App from '../App'
import { api } from '../api/client'
import { renderApp } from '../test/utils'

const anon = { status: 'anon' as const, user: null }

function server(handler: (url: string, method: string, body?: unknown) => { status: number; data?: unknown }) {
  const calls: string[] = []
  const adapter: AxiosAdapter = async (config) => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    calls.push(`${config.method} ${config.url}`)
    const { status, data } = handler(config.url ?? '', config.method ?? 'get', body)
    const response = { data, status, statusText: '', headers: {}, config }
    if (status >= 400) throw new AxiosError('fail', 'ERR', config, null, response)
    return response
  }
  api.defaults.adapter = adapter
  return calls
}

describe('legal pages', () => {
  it('shows privacy policy and terms without signing in, with a draft notice', async () => {
    renderApp(<App />, { auth: anon, route: '/privacy' })
    expect(await screen.findByRole('heading', { name: 'Privacy policy' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/lawyer/i)
  })
  it('renders the terms in Hebrew too', async () => {
    renderApp(<App />, { auth: anon, route: '/terms', lang: 'he' })
    expect(await screen.findByRole('heading', { name: 'תנאי שימוש' })).toBeInTheDocument()
  })
  it('links to both from the registration form', async () => {
    server(() => ({ status: 200, data: { password_reset_enabled: false } }))
    renderApp(<App />, { auth: anon, route: '/register' })
    // each link also appears in the page footer, so both places are expected
    const terms = await screen.findAllByRole('link', { name: 'Terms of use' })
    const privacy = screen.getAllByRole('link', { name: 'Privacy policy' })
    expect(terms).toHaveLength(2)
    expect(privacy).toHaveLength(2)
    expect(terms.every((a) => a.getAttribute('href') === '/terms')).toBe(true)
    expect(privacy.every((a) => a.getAttribute('href') === '/privacy')).toBe(true)
    expect(screen.getByRole('button', { name: 'Create account' }).closest('form')).toHaveTextContent(
      'By creating an account you agree to the Terms of use and Privacy policy.',
    )
  })
})

describe('forgot password', () => {
  it('is hidden on the login page when the server cannot send e-mail', async () => {
    server(() => ({ status: 200, data: { password_reset_enabled: false } }))
    renderApp(<App />, { auth: anon, route: '/login' })
    await screen.findByRole('heading', { name: 'Sign in' })
    await waitFor(() => expect(screen.queryByText('Forgot your password?')).not.toBeInTheDocument())
  })

  it('is offered when the server supports it', async () => {
    server(() => ({ status: 200, data: { password_reset_enabled: true } }))
    renderApp(<App />, { auth: anon, route: '/login' })
    expect(await screen.findByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot-password')
  })

  it('validates the e-mail, then shows the same confirmation for any address', async () => {
    const calls = server(() => ({ status: 202, data: { status: 'accepted' } }))
    const user = userEvent.setup()
    renderApp(<App />, { auth: anon, route: '/forgot-password' })
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(calls).toHaveLength(0)
    expect(screen.getByText('Enter a valid e-mail address.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('E-mail'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('status')).toHaveTextContent(/reset link is on its way/)
    expect(calls).toEqual(['post /auth/forgot-password'])
  })

  it('tells the user when the feature is unavailable', async () => {
    server(() => ({ status: 501 }))
    const user = userEvent.setup()
    renderApp(<App />, { auth: anon, route: '/forgot-password' })
    await user.type(screen.getByLabelText('E-mail'), 'someone@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Password reset is not available right now.')
  })
})

describe('reset password', () => {
  it('asks for a new link when the token is missing', async () => {
    renderApp(<App />, { auth: anon, route: '/reset-password' })
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or has expired/)
  })

  it('enforces the password policy before calling the server', async () => {
    const calls = server(() => ({ status: 204 }))
    const user = userEvent.setup()
    renderApp(<App />, { auth: anon, route: '/reset-password?token=abcdefghijklmnop' })
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(calls).toHaveLength(0)
    expect(screen.getByText('Password must be at least 10 characters.')).toBeInTheDocument()
  })

  it('sends the token and new password, then offers sign in', async () => {
    const seen = vi.fn()
    server((_u, _m, body) => {
      seen(body)
      return { status: 204 }
    })
    const user = userEvent.setup()
    renderApp(<App />, { auth: anon, route: '/reset-password?token=abcdefghijklmnop' })
    await user.type(screen.getByLabelText('New password'), 'brand-new-Secret-42')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Password changed')
    expect(seen).toHaveBeenCalledWith({ token: 'abcdefghijklmnop', new_password: 'brand-new-Secret-42' })
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('shows a friendly message for an expired or used link', async () => {
    server(() => ({ status: 400, data: { detail: 'SECRET-DETAIL' } }))
    const user = userEvent.setup()
    renderApp(<App />, { auth: anon, route: '/reset-password?token=abcdefghijklmnop' })
    await user.type(screen.getByLabelText('New password'), 'brand-new-Secret-42')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired')
    expect(document.body).not.toHaveTextContent('SECRET-DETAIL')
  })
})
