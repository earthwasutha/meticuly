import { create } from 'zustand'
import type { OrderFilters } from '../api/hooks'

/** Identifies an order for a workflow dialog, plus the step the user saw it in. */
export interface OrderTarget {
  id: number
  code: string
  expectedStepId: number | null
}

/**
 * Client-only UI state (dialogs, filters). Server data is never copied here;
 * it stays in the TanStack Query cache.
 */
interface UiState {
  createOrderOpen: boolean
  advanceTarget: OrderTarget | null
  cancelTarget: OrderTarget | null
  orderFilters: Required<Pick<OrderFilters, 'status' | 'stepId' | 'search' | 'page'>>
  boardSearch: string

  openCreateOrder: () => void
  closeCreateOrder: () => void
  openAdvance: (target: OrderTarget) => void
  closeAdvance: () => void
  openCancel: (target: OrderTarget) => void
  closeCancel: () => void
  setOrderFilters: (patch: Partial<UiState['orderFilters']>) => void
  setBoardSearch: (value: string) => void
}

export const useUi = create<UiState>((set) => ({
  createOrderOpen: false,
  advanceTarget: null,
  cancelTarget: null,
  orderFilters: { status: '', stepId: '', search: '', page: 1 },
  boardSearch: '',

  openCreateOrder: () => set({ createOrderOpen: true }),
  closeCreateOrder: () => set({ createOrderOpen: false }),
  openAdvance: (advanceTarget) => set({ advanceTarget }),
  closeAdvance: () => set({ advanceTarget: null }),
  openCancel: (cancelTarget) => set({ cancelTarget }),
  closeCancel: () => set({ cancelTarget: null }),
  // Any filter change other than paging sends the user back to page 1.
  setOrderFilters: (patch) =>
    set((s) => ({ orderFilters: { ...s.orderFilters, page: 1, ...patch } })),
  setBoardSearch: (boardSearch) => set({ boardSearch }),
}))

export const targetOf = (o: { id: number; code: string; currentStepId: number | null }): OrderTarget => ({
  id: o.id,
  code: o.code,
  expectedStepId: o.currentStepId,
})
