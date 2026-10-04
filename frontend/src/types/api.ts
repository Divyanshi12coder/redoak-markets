// Mirrors the FastAPI response schemas (backend/app/schemas).

export type Range = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y'
export const RANGES: Range[] = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y']
export const COMPARE_RANGES: Range[] = ['1M', '3M', '6M', '1Y', '5Y']

export interface DataMeta {
  source: 'demo' | 'twelvedata' | string
  source_label: string
  data_note: string
  stale: boolean
  fetched_at: string | null
}

export interface Quote {
  ticker: string
  name: string
  exchange: string
  currency: string
  price: number
  change: number
  change_percent: number
  previous_close: number | null
  open: number | null
  high: number | null
  low: number | null
  volume: number | null
  average_volume: number | null
  is_market_open: boolean
  as_of: string
  fifty_two_week_low: number | null
  fifty_two_week_high: number | null
}
export interface QuoteResponse extends Quote {
  meta: DataMeta
}

export interface SearchItem {
  ticker: string
  name: string
  exchange: string
  country: string | null
  instrument_type: string | null
  currency: string | null
  price: number | null
  change_percent: number | null
}
export interface SearchResponse {
  query: string
  results: SearchItem[]
  meta: DataMeta
}

export interface Candle {
  t: number
  o: number | null
  h: number | null
  l: number | null
  c: number | null
  v: number
}
export interface HistoryResponse {
  ticker: string
  range: Range
  interval: '5min' | '30min' | '1day'
  candles: Candle[]
  meta: DataMeta
}

export type IndicatorKey =
  | 'sma20' | 'sma50' | 'sma200' | 'ema20' | 'ema50' | 'rsi14'
  | 'macd' | 'macd_signal' | 'macd_hist' | 'bb_upper' | 'bb_mid' | 'bb_lower'
export interface IndicatorsResponse {
  ticker: string
  range: Range
  range_used: Range
  interval: string
  t: number[]
  series: Record<IndicatorKey, (number | null)[]>
  latest: Record<string, number | null>
  price: number | null
  meta: DataMeta
}

export interface SignalScore {
  score: number
  label: string
  position?: number | null
  detail?: string | null
}
export interface SignalRule {
  key: string
  group: string
  score: number
  label: string
  detail: string
  weight: number
}
export interface AnalysisResponse {
  ticker: string
  as_of: string
  signal: SignalScore
  components: Record<'rsi' | 'moving_average' | 'momentum', SignalScore>
  rules: SignalRule[]
  rule_catalogue: string[]
  latest: Record<string, number | null>
  disclaimer: string
  meta: DataMeta
}

export interface OverviewResponse {
  market_open: boolean
  indices: (Quote & { name: string })[]
  gainers: Quote[]
  losers: Quote[]
  most_active: Quote[]
  movers: Quote[]
  total_volume: number
  advancers: number
  decliners: number
  universe_size: number
  stale: boolean
  generated_at: string
  meta: DataMeta
}

export interface CompareRow {
  ticker: string
  name: string
  price: number
  change_percent: number | null
  volume: number
  average_volume: number
  range_return_percent: number
  volatility: number | null
  max_drawdown_percent: number
  rsi14: number | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
  ema20: number | null
  ema50: number | null
  signal: string
}
export interface CompareResponse {
  range: Range
  tickers: string[]
  t: number[]
  performance: Record<string, (number | null)[]>
  table: CompareRow[]
  meta: DataMeta
}

// ---------------------------------------------------------------- ML ------
export type RegimeClass = 'bullish' | 'bearish' | 'neutral'

export interface ConfusionMatrix {
  labels: string[]
  matrix: number[][]
}
export interface Evaluation {
  accuracy: number
  balanced_accuracy: number
  precision_macro: number
  recall_macro: number
  f1_macro: number
  roc_auc_ovr: number | null
  confusion_matrix: ConfusionMatrix
  per_class: Record<string, { precision: number; recall: number; f1: number; support: number }>
  baseline_accuracy: number
  beats_baseline: boolean
  n_folds: number
  n_test_samples: number
  fold_accuracy: number[]
  validation: string
}
export interface ImportanceRow {
  key: string
  label: string
  description: string
  importance?: number
  contribution?: number
  value: number
}
export interface AnomalyEvent {
  t: number
  date: string
  kinds: string[]
  z_price: number | null
  z_volume: number | null
  z_volatility: number | null
  isolation_forest_flag: boolean
  return_pct: number
}
export interface Anomalies {
  available: boolean
  headline: string
  detected: boolean
  kinds: string[]
  events: AnomalyEvent[]
  methods: string[]
  note: string
  window_sessions?: number
  z_threshold?: number
  isolation_forest_used?: boolean
}
export interface RegimeDashboard {
  trend: { label: string; source: string }
  character: { label: string; efficiency_ratio: number | null }
  momentum: { label: string; direction: string; z_score: number }
  volatility: { label: string; annualised: number; percentile: number | null }
  volume: { label: string; ratio_to_20d_avg: number }
}
export interface Badge {
  label: string
  tone: 'bull' | 'bear' | 'neutral' | 'warn'
}
export interface DiaResult {
  summary: string
  source: 'template' | 'llm'
  model: string | null
  llm_enabled: boolean
  grounded_on: Record<string, unknown>
  note: string | null
}
export interface MlAnalysisResponse {
  ticker: string
  as_of: string
  model: {
    version: string
    algorithm: string
    hyperparameters: Record<string, unknown>
    trained_through: string
    n_training_samples: number
    horizon_days: number
    target_definition: string
    n_features: number
    class_distribution: Record<string, number>
    created_at: string
  }
  classification: {
    regime: RegimeClass
    probabilities: Record<RegimeClass, number>
    confidence: number
    confidence_note: string
  }
  regime: RegimeDashboard
  evaluation: Evaluation
  feature_importance: { global: ImportanceRow[]; local: ImportanceRow[] }
  anomalies: Anomalies
  signals: { overall: SignalScore; components: AnalysisResponse['components'] }
  dia: DiaResult
  badges: Badge[]
  disclaimer: string
  meta: DataMeta
}

// ------------------------------------------------------------ account -----
export interface User {
  id: number
  name: string
  email: string
  created_at: string
}
export interface Preferences {
  default_range: Range
  chart_type: 'candles' | 'line' | 'area'
  indicators: string[]
}
export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}
export interface Profile {
  user: User
  preferences: Preferences
  recent_tickers: string[]
}
export interface MlHistoryItem {
  ticker: string
  model_version: string
  regime: RegimeClass
  confidence: number
  volatility_regime: string
  anomaly_detected: boolean
  data_source: string
  analyzed_at: string
}
export interface WatchlistItem {
  ticker: string
  position: number
  added_at: string
  quote: Quote | null
}
export interface WatchlistResponse {
  items: WatchlistItem[]
  quotes_error: string | null
  meta: DataMeta
}
export interface HealthResponse {
  status: string
  version: string
  environment: string
  database: string
  market_data: { provider: string; configured: boolean; synthetic: boolean }
  llm_enabled: boolean
}
