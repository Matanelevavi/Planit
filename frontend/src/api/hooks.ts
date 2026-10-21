import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  Contribution,
  Goal,
  GoalCreateBody,
  GoalUpdateBody,
  Projection,
  Summary,
  WhatIf,
} from './types'

export const keys = {
  goals: ['goals'] as const,
  summary: ['goals', 'summary'] as const,
  goal: (id: number) => ['goals', id] as const,
  contributions: (id: number) => ['goals', id, 'contributions'] as const,
  projection: (id: number) => ['goals', id, 'projection'] as const,
}

export const useGoals = () =>
  useQuery({ queryKey: keys.goals, queryFn: async () => (await api.get<Goal[]>('/goals/')).data })

export const useSummary = () =>
  useQuery({ queryKey: keys.summary, queryFn: async () => (await api.get<Summary>('/goals/summary')).data })

export const useGoal = (id: number) =>
  useQuery({
    queryKey: keys.goal(id),
    queryFn: async () => (await api.get<Goal>(`/goals/${id}`)).data,
    retry: (count, err) => (isNotFound(err) ? false : count < 2),
  })

export const useContributions = (id: number) =>
  useQuery({
    queryKey: keys.contributions(id),
    queryFn: async () => (await api.get<Contribution[]>(`/goals/${id}/contributions`)).data,
  })

export const useProjection = (id: number) =>
  useQuery({
    queryKey: keys.projection(id),
    queryFn: async () => (await api.get<Projection>(`/goals/${id}/projection`)).data,
  })

export const fetchWhatIf = async (id: number, monthly: string): Promise<WhatIf> =>
  (await api.get<WhatIf>(`/goals/${id}/what-if`, { params: { monthly } })).data

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'response' in err && (err as { response?: { status?: number } }).response?.status === 404
}

function useInvalidateGoals() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: keys.goals })
}

export function useCreateGoal() {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: async (body: GoalCreateBody) => (await api.post<Goal>('/goals/', body)).data,
    onSuccess: invalidate,
  })
}

export function useUpdateGoal(id: number) {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: async (body: GoalUpdateBody) => (await api.patch<Goal>(`/goals/${id}`, body)).data,
    onSuccess: invalidate,
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/goals/${id}`)
    },
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.goal(id) })
      return qc.invalidateQueries({ queryKey: keys.goals })
    },
  })
}

export function useAddContribution(id: number) {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: async (body: { amount: string; date?: string; note?: string }) =>
      (await api.post<Goal>(`/goals/${id}/contributions`, body)).data,
    onSuccess: invalidate,
  })
}

export function useDeleteContribution(id: number) {
  const invalidate = useInvalidateGoals()
  return useMutation({
    mutationFn: async (contributionId: number) =>
      (await api.delete<Goal>(`/goals/${id}/contributions/${contributionId}`)).data,
    onSuccess: invalidate,
  })
}
