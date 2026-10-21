import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import App from './App'
import { AuthPage } from './pages/AuthPage'
import { api } from './api/client'
import { renderApp } from './test/utils'

describe('routing guards', () => {
  it('sends anonymous visitors to the login page', async () => {
    renderApp(<App />, { auth: { status: 'anon', user: null }, route: '/' })
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('does not expose private pages to anonymous visitors', async () => {
    renderApp(<App />, { auth: { status: 'anon', user: null }, route: '/settings' })
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText('Change password')).not.toBeInTheDocument()
  })

  it('redirects signed-in users away from the login page', async () => {
    api.defaults.adapter = async (config) => ({ data: [], status: 200, statusText: '', headers: {}, config })
    renderApp(<App />, { route: '/login' })
    expect(await screen.findByRole('heading', { name: 'Your financial goals' })).toBeInTheDocument()
  })

  it('waits for the session check before deciding', () => {
    renderApp(<App />, { auth: { status: 'loading', user: null } })
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('shows a 404 page for unknown routes', async () => {
    renderApp(<App />, { auth: { status: 'anon', user: null }, route: '/nope' })
    expect(await screen.findByText('Page not found.')).toBeInTheDocument()
  })
})

describe('AuthPage', () => {
  it('validates before calling the server', async () => {
    const login = vi.fn()
    renderApp(<AuthPage mode="login" />, { auth: { login } })
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(login).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a valid e-mail address.')).toBeInTheDocument()
  })

  it('enforces the password policy on registration', async () => {
    const register = vi.fn()
    const user = userEvent.setup()
    renderApp(<AuthPage mode="register" />, { auth: { register } })
    await user.type(screen.getByLabelText('E-mail'), 'me@example.com')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(register).not.toHaveBeenCalled()
    expect(screen.getByText('Password must be at least 10 characters.')).toBeInTheDocument()
  })

  it('submits valid credentials', async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderApp(<AuthPage mode="login" />, { auth: { login } })
    await user.type(screen.getByLabelText('E-mail'), 'me@example.com')
    await user.type(screen.getByLabelText('Password'), 'whatever-123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(login).toHaveBeenCalledWith('me@example.com', 'whatever-123')
  })

  it('shows a friendly message, not server text, on failure', async () => {
    const err = new AxiosError('x', 'E', undefined, null, { status: 401, data: { detail: 'SECRET' } } as never)
    const login = vi.fn().mockRejectedValue(err)
    const user = userEvent.setup()
    renderApp(<AuthPage mode="login" />, { auth: { login } })
    await user.type(screen.getByLabelText('E-mail'), 'me@example.com')
    await user.type(screen.getByLabelText('Password'), 'whatever-123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Incorrect e-mail or password.'))
    expect(document.body).not.toHaveTextContent('SECRET')
  })

  it('reports a duplicate e-mail on registration', async () => {
    const err = new AxiosError('x', 'E', undefined, null, { status: 409 } as never)
    const user = userEvent.setup()
    renderApp(<AuthPage mode="register" />, { auth: { register: vi.fn().mockRejectedValue(err) } })
    await user.type(screen.getByLabelText('E-mail'), 'me@example.com')
    await user.type(screen.getByLabelText('Password'), 'long-enough-1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('This e-mail is already registered.')).toBeInTheDocument()
  })
})
