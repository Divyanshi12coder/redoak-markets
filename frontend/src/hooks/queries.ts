import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/endpoints'
import type { Range, WatchlistResponse } from '../types/api'

const MIN = 60_000

/** Daily-bar indicator windows: intraday ranges reuse the 1M window (same cache entry). */
export const indicatorRange = (range: Range): Range => (range === '1D' || range === '5D' ? '1M' : range)

export const useHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 10 * MIN, retry: 1 })

export const useOverview = () =>
  useQuery({ queryKey: ['overview'], queryFn: api.overview, staleTime: 5 * MIN })

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q.toLowerCase()],
    queryFn: ({ signal }) => api.search(q, signal),
    enabled: q.trim().length >= 1,
    staleTime: 30 * MIN,
    placeholderData: keepPreviousData,
  })

export const useQuote = (ticker: string) =>
  useQuery({ queryKey: ['quote', ticker], queryFn: () => api.quote(ticker), staleTime: MIN, refetchInterval: 2 * MIN })

export const useHistory = (ticker: string, range: Range, enabled = true) =>
  useQuery({
    queryKey: ['history', ticker, range],
    queryFn: () => api.history(ticker, range),
    enabled: enabled && !!ticker,
    staleTime: 5 * MIN,
    placeholderData: keepPreviousData,
  })

export const useIndicators = (ticker: string, range: Range) => {
  const effective = indicatorRange(range)
  return useQuery({
    queryKey: ['indicators', ticker, effective],
    queryFn: () => api.indicators(ticker, effective),
    staleTime: 5 * MIN,
    placeholderData: keepPreviousData,
  })
}

export const useAnalysis = (ticker: string) =>
  useQuery({ queryKey: ['analysis', ticker], queryFn: () => api.analysis(ticker), staleTime: 5 * MIN })

export const useMlAnalysis = (ticker: string) =>
  useQuery({
    queryKey: ['ml', ticker],
    queryFn: () => api.mlAnalysis(ticker),
    staleTime: 5 * MIN,
    retry: false, // training is expensive; let the user decide to retry
  })

export const useCompare = (tickers: string[], range: Range) =>
  useQuery({
    queryKey: ['compare', [...tickers].sort().join(','), range],
    queryFn: () => api.compare(tickers, range),
    enabled: tickers.length >= 2,
    staleTime: 5 * MIN,
    placeholderData: keepPreviousData,
  })

export const useWatchlist = (enabled: boolean) =>
  useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist, enabled, staleTime: MIN })

export const useMlHistory = (enabled: boolean) =>
  useQuery({ queryKey: ['ml-history'], queryFn: api.mlHistory, enabled, staleTime: MIN })

export function useWatchlistMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['watchlist'] })

  const add = useMutation({ mutationFn: api.addToWatchlist, onSuccess: invalidate })

  const remove = useMutation({
    mutationFn: api.removeFromWatchlist,
    onMutate: async (ticker: string) => {
      await qc.cancelQueries({ queryKey: ['watchlist'] })
      const previous = qc.getQueryData<WatchlistResponse>(['watchlist'])
      if (previous) {
        qc.setQueryData<WatchlistResponse>(['watchlist'], {
          ...previous,
          items: previous.items.filter((i) => i.ticker !== ticker),
        })
      }
      return { previous }
    },
    onError: (_e, _t, ctx) => ctx?.previous && qc.setQueryData(['watchlist'], ctx.previous),
    onSettled: invalidate,
  })

  const reorder = useMutation({
    mutationFn: api.reorderWatchlist,
    onMutate: async (tickers: string[]) => {
      await qc.cancelQueries({ queryKey: ['watchlist'] })
      const previous = qc.getQueryData<WatchlistResponse>(['watchlist'])
      if (previous) {
        const byTicker = new Map(previous.items.map((i) => [i.ticker, i]))
        qc.setQueryData<WatchlistResponse>(['watchlist'], {
          ...previous,
          items: tickers.flatMap((t, position) => {
            const item = byTicker.get(t)
            return item ? [{ ...item, position }] : []
          }),
        })
      }
      return { previous }
    },
    onError: (_e, _t, ctx) => ctx?.previous && qc.setQueryData(['watchlist'], ctx.previous),
    onSettled: invalidate,
  })

  return { add, remove, reorder }
}
