import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  Board,
  Dashboard,
  Order,
  OrderDetail,
  OrderInput,
  OrderStatus,
  Paginated,
  Resource,
  ResourceInput,
  ResourceSummary,
  ResourceTransaction,
  Step,
  StepInput,
  TransitionPlan,
} from './types'

/** Server state lives in TanStack Query; these keys group what a mutation can affect. */
export const keys = {
  board: ['board'] as const,
  dashboard: ['dashboard'] as const,
  orders: ['orders'] as const,
  order: (id: number) => ['order', id] as const,
  next: (id: number) => ['order', id, 'next'] as const,
  steps: ['steps'] as const,
  resources: ['resources'] as const,
  transactions: ['transactions'] as const,
}

const LIVE = { refetchInterval: 15_000 } // shop-floor screens stay fresh when others make changes

function useInvalidate() {
  const qc = useQueryClient()
  return (...groups: (readonly unknown[])[]) =>
    Promise.all(groups.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

/** Anything that moves an order or stock changes nearly every view. */
const PRODUCTION = [keys.board, keys.dashboard, keys.orders, ['order'], keys.resources, keys.transactions]

// --- Overview ---------------------------------------------------------------

export const useBoard = () =>
  useQuery({ queryKey: keys.board, queryFn: async () => (await api.get<Board>('/board')).data, ...LIVE })

export const useDashboard = () =>
  useQuery({
    queryKey: keys.dashboard,
    queryFn: async () => (await api.get<Dashboard>('/dashboard')).data,
    ...LIVE,
  })

// --- Orders -----------------------------------------------------------------

export interface OrderFilters {
  status?: OrderStatus | ''
  stepId?: number | ''
  search?: string
  page?: number
  pageSize?: number
}

export const useOrders = (filters: OrderFilters) =>
  useQuery({
    queryKey: [...keys.orders, filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined),
      )
      return (await api.get<Paginated<Order>>('/orders', { params })).data
    },
    placeholderData: keepPreviousData,
    ...LIVE,
  })

export const useOrder = (id: number) =>
  useQuery({
    queryKey: keys.order(id),
    queryFn: async () => (await api.get<OrderDetail>(`/orders/${id}`)).data,
    enabled: Number.isFinite(id),
  })

export const useNextPreview = (id: number | null) =>
  useQuery({
    queryKey: keys.next(id ?? -1),
    queryFn: async () => (await api.get<TransitionPlan>(`/orders/${id}/next`)).data,
    enabled: id !== null,
    staleTime: 0,
    retry: false,
  })

export function useCreateOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: OrderInput) => (await api.post<Order>('/orders', input)).data,
    onSuccess: () => invalidate(...PRODUCTION),
  })
}

export function useUpdateOrder(id: number) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: Partial<OrderInput>) =>
      (await api.patch<Order>(`/orders/${id}`, input)).data,
    onSuccess: () => invalidate(...PRODUCTION),
  })
}

export function useDeleteOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/orders/${id}`),
    onSuccess: () => invalidate(...PRODUCTION),
  })
}

export function useAdvanceOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (v: { id: number; expectedStepId: number | null }) =>
      (
        await api.post<{ order: Order; plan: TransitionPlan }>(`/orders/${v.id}/advance`, {
          expectedStepId: v.expectedStepId,
        })
      ).data,
    // Refresh even on failure: a 409 usually means our view of the floor is stale.
    onSettled: () => invalidate(...PRODUCTION),
  })
}

export function useCancelOrder() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (v: { id: number; reason: string }) =>
      (await api.post<Order>(`/orders/${v.id}/cancel`, { reason: v.reason })).data,
    onSettled: () => invalidate(...PRODUCTION),
  })
}

// --- Steps ------------------------------------------------------------------

export const useSteps = () =>
  useQuery({ queryKey: keys.steps, queryFn: async () => (await api.get<Step[]>('/steps')).data })

function useStepMutation<T>(fn: (v: T) => Promise<unknown>) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate(keys.steps, keys.board, keys.dashboard, keys.resources),
  })
}

export const useCreateStep = () =>
  useStepMutation((input: StepInput) => api.post<Step>('/steps', input))
export const useUpdateStep = () =>
  useStepMutation(({ id, ...input }: StepInput & { id: number }) => api.patch(`/steps/${id}`, input))
export const useDeleteStep = () => useStepMutation((id: number) => api.delete(`/steps/${id}`))
export const useReorderSteps = () =>
  useStepMutation((ids: number[]) => api.put('/steps/reorder', { ids }))
export const useSetRequirements = () =>
  useStepMutation(
    (v: { id: number; requirements: { resourceId: number; quantityPerUnit: number }[] }) =>
      api.put(`/steps/${v.id}/requirements`, { requirements: v.requirements }),
  )

// --- Resources --------------------------------------------------------------

export const useResources = () =>
  useQuery({
    queryKey: keys.resources,
    queryFn: async () => (await api.get<ResourceSummary[]>('/resources')).data,
    ...LIVE,
  })

export const useTransactions = (resourceId?: number, limit = 100) =>
  useQuery({
    queryKey: [...keys.transactions, resourceId ?? 'all', limit],
    queryFn: async () =>
      (
        await api.get<ResourceTransaction[]>('/resources/transactions', {
          params: { resourceId, limit },
        })
      ).data,
    ...LIVE,
  })

function useResourceMutation<T>(fn: (v: T) => Promise<unknown>) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate(keys.resources, keys.transactions, keys.dashboard, keys.steps, ['order']),
  })
}

export const useCreateResource = () =>
  useResourceMutation((input: ResourceInput) => api.post<Resource>('/resources', input))
export const useUpdateResource = () =>
  useResourceMutation(({ id, ...input }: Partial<ResourceInput> & { id: number }) =>
    api.patch(`/resources/${id}`, input),
  )
export const useDeleteResource = () =>
  useResourceMutation((id: number) => api.delete(`/resources/${id}`))
export const useRestock = () =>
  useResourceMutation((v: { id: number; quantity: number; note: string }) =>
    api.post(`/resources/${v.id}/restock`, { quantity: v.quantity, note: v.note }),
  )
export const useAdjustStock = () =>
  useResourceMutation((v: { id: number; stockQuantity: number | null; note: string }) =>
    api.post(`/resources/${v.id}/adjust`, { stockQuantity: v.stockQuantity, note: v.note }),
  )
