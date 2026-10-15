import axios, { AxiosError } from 'axios'

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' })

/** Turns any API failure into a readable sentence for toasts and inline errors. */
export function errorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined
    const msg = data?.message
    if (Array.isArray(msg)) return msg.join(', ')
    if (msg) return msg
    if (!error.response) return 'Cannot reach the server. Is the backend running?'
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}
