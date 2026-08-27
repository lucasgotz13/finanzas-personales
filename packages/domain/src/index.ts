export { DomainError, ValidationError, NotFoundError, ConflictError } from './errors';
export type { ErrorCode } from './errors';

export { Money, SUPPORTED_CURRENCIES, BASE_CURRENCY, isSupportedCurrency } from './vo/money';
export type { Currency, MoneyInput } from './vo/money';

export { DIRECTIONS, parseDirection, isDirection } from './vo/direction';
export type { Direction } from './vo/direction';

export { PeriodKey, arDateParts, arDateString, isArDateString } from './vo/period-key';
export type { PeriodType, ArDateParts } from './vo/period-key';

export { arIsoString } from './vo/ar-tz';

export { KEYS, UNIT_BY_KEY, CLASS_BY_KEY, TTL_BY_CLASS } from './indicators/catalog';
export { IndicatorService } from './indicators/service';
export type { IndicatorServiceDeps } from './indicators/service';
export type { IndicatorSource, IndicatorCache } from './indicators/ports';

export { PRICE_TTL_MS, normalizeTicker } from './investments/catalog';
export { PortfolioService } from './investments/service';
export type { PortfolioServiceDeps } from './investments/service';
export { TradeService, derivedPositionId } from './investments/trades';
export type { TradeServiceDeps } from './investments/trades';
export { DerivedPositionRepository } from './investments/derived-repo';
export type { PriceSource, PriceCache, PositionRepository, PortfolioFxPort, TradeRepository, LegacyPositionPort, RealizedLedgerPort } from './investments/ports';
export type {
  PriceStatus,
  CcStatus,
  PositionCurrency,
  Position,
  PriceSnapshot,
  PriceQuote,
  PositionView,
  PortfolioSummary,
  PortfolioRefreshResult,
  Trade,
  TradeInput,
  TradeType,
  RealizedTotals,
} from './investments/types';

export { SERIES_TTL_MS, FF_MAX_DAYS, RANGE_WINDOW_DAYS, SERIES_RANGES, SERIES_CURRENCIES, isSeriesRange, isSeriesCurrency } from './priceCharts/catalog';
export { alignToCalendar } from './priceCharts/align';
export { CclLookup, convertSeries } from './priceCharts/ccl';
export { ChartService } from './priceCharts/service';
export type { ChartServiceDeps } from './priceCharts/service';
export type { PriceSeriesSource, CclSeriesSource, SeriesCache } from './priceCharts/ports';
export type {
  SeriesRange,
  SeriesCurrency,
  SeriesStatus,
  PricePoint,
  CclPoint,
  NativeSeries,
  SeriesSnapshot,
  CclSnapshot,
  ChartCacheEntry,
  HistoryResponse,
} from './priceCharts/types';
export type {
  IndicatorClass,
  IndicatorKey,
  IndicatorStatus,
  IndicatorSample,
  IndicatorView,
  IndicatorSnapshot,
  IndicatorRefreshResult,
} from './indicators/types';

export { Transaction } from './entities/transaction';
export type { TransactionInput } from './entities/transaction';

export { Category } from './entities/category';
export type { CategoryInput } from './entities/category';

export { Budget } from './entities/budget';
export type { BudgetInput } from './entities/budget';

export type {
  Clock,
  TransactionRepository,
  TransactionFilters,
  CategoryRepository,
  BudgetRepository,
} from './ports/repositories';

export { TransactionService } from './use-cases/transactions';
export type { TransactionServiceDeps, CreateTransactionInput, TransactionPatch } from './use-cases/transactions';

export { CategoryService } from './use-cases/categories';
export type { CategoryServiceDeps } from './use-cases/categories';

export { BudgetService } from './use-cases/budgets';
export type { BudgetServiceDeps, BudgetStatus, CategoryBudgetStatus } from './use-cases/budgets';

export { SummaryService } from './use-cases/summaries';
export type { SummaryServiceDeps, PeriodSummary, CurrencySummary, CategorySummary } from './use-cases/summaries';
