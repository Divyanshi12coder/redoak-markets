import type {
  AnalysisResponse,
  CompareResponse,
  HealthResponse,
  HistoryResponse,
  MlHistoryItem,
  IndicatorsResponse,
  MlAnalysisResponse,
  OverviewResponse,
  Preferences,
  Profile,
  QuoteResponse,
  Range,
  SearchResponse,
  TokenResponse,
  WatchlistItem,
  WatchlistResponse,
} from '../types/api'
import { request } from './client'

const enc = encodeURIComponent

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  overview: () => request<OverviewResponse>('/api/market/overview'),
  search: (q: string, signal?: AbortSignal) => request<SearchResponse>('/api/stocks/search', { params: { q }, signal }),
  quote: (t: string) => request<QuoteResponse>(`/api/stocks/${enc(t)}`),
  history: (t: string, range: Range) => request<HistoryResponse>(`/api/stocks/${enc(t)}/history`, { params: { range } }),
  indicators: (t: string, range: Range) =>
    request<IndicatorsResponse>(`/api/stocks/${enc(t)}/indicators`, { params: { range } }),
  analysis: (t: string) => request<AnalysisResponse>(`/api/stocks/${enc(t)}/analysis`),
  mlAnalysis: (t: string) => request<MlAnalysisResponse>(`/api/stocks/${enc(t)}/ml-analysis`),
  compare: (tickers: string[], range: Range) =>
    request<CompareResponse>('/api/compare', { params: { tickers: tickers.join(','), range } }),

  register: (body: { name: string; email: string; password: string }) =>
    request<TokenResponse>('/api/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) =>
    request<TokenResponse>('/api/auth/login', { method: 'POST', body }),
  profile: () => request<Profile>('/api/user/profile'),
  mlHistory: () => request<MlHistoryItem[]>('/api/user/ml-history'),
  savePreferences: (body: Preferences) => request<Preferences>('/api/user/preferences', { method: 'PUT', body }),

  watchlist: () => request<WatchlistResponse>('/api/watchlist'),
  addToWatchlist: (ticker: string) => request<WatchlistItem>('/api/watchlist', { method: 'POST', body: { ticker } }),
  removeFromWatchlist: (ticker: string) => request<void>(`/api/watchlist/${enc(ticker)}`, { method: 'DELETE' }),
  reorderWatchlist: (tickers: string[]) => request<string[]>('/api/watchlist/order', { method: 'PUT', body: { tickers } }),
}
