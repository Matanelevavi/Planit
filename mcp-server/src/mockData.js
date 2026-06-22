// =============================================================================
//  Planit MCP Server – src/mockData.js
//  Mock data that simulates a Firebase / Planit backend response.
//  Replace the `fetchPortfolio`, `fetchVOOHistory`, and `fetchTaxEvents`
//  functions with real Firebase Admin SDK calls once you have credentials.
// =============================================================================

/**
 * Simulated portfolio holdings.
 * Each entry mirrors a Firestore document in the `holdings` collection.
 */
export const MOCK_HOLDINGS = [
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    shares: 12.5,
    avgCostBasis: 380.0,      // USD per share (purchase average)
    currentPrice: 512.34,     // USD per share (latest market price)
    currency: "USD",
    sector: "Index ETF",
    purchaseDates: ["2023-01-15", "2023-06-10", "2024-02-20"],
  },
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    shares: 8,
    avgCostBasis: 155.0,
    currentPrice: 211.50,
    currency: "USD",
    sector: "Technology",
    purchaseDates: ["2022-11-03"],
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    shares: 5,
    avgCostBasis: 290.0,
    currentPrice: 420.15,
    currency: "USD",
    sector: "Technology",
    purchaseDates: ["2023-03-22"],
  },
  {
    ticker: "BND",
    name: "Vanguard Total Bond Market ETF",
    shares: 20,
    avgCostBasis: 72.0,
    currentPrice: 73.80,
    currency: "USD",
    sector: "Bond ETF",
    purchaseDates: ["2023-08-14"],
  },
];

/**
 * Simulated VOO monthly closing prices (last 24 months).
 * Key: "YYYY-MM", Value: closing price in USD.
 */
export const MOCK_VOO_HISTORY = {
  "2024-06": 492.10,
  "2024-07": 488.90,
  "2024-08": 505.22,
  "2024-09": 509.75,
  "2024-10": 495.60,
  "2024-11": 530.40,
  "2024-12": 518.30,
  "2025-01": 525.10,
  "2025-02": 498.75,
  "2025-03": 470.20,
  "2025-04": 488.95,
  "2025-05": 505.60,
  "2025-06": 512.34,
};

/**
 * Simulated sell transactions (used for capital gains calculation).
 * Mirrors the `transactions` collection in Firestore.
 */
export const MOCK_SELL_TRANSACTIONS = [
  {
    id: "txn_001",
    ticker: "AAPL",
    type: "SELL",
    shares: 3,
    salePrice: 190.0,       // USD per share
    costBasis: 155.0,       // USD per share
    saleDate: "2024-03-15",
    holdingPeriodDays: 498, // > 365 → long-term
  },
  {
    id: "txn_002",
    ticker: "MSFT",
    type: "SELL",
    shares: 2,
    salePrice: 380.0,
    costBasis: 290.0,
    saleDate: "2024-07-20",
    holdingPeriodDays: 485, // > 365 → long-term
  },
  {
    id: "txn_003",
    ticker: "VOO",
    type: "SELL",
    shares: 1,
    salePrice: 505.0,
    costBasis: 380.0,
    saleDate: "2025-01-10",
    holdingPeriodDays: 360, // < 365 → short-term
  },
];

// ---------------------------------------------------------------------------
// Data-access helpers (swap these for real Firebase calls)
// ---------------------------------------------------------------------------

/** Returns all portfolio holdings */
export async function fetchPortfolio() {
  // TODO: replace with Firebase Admin SDK call
  // const snapshot = await adminFirestore.collection("holdings").get();
  // return snapshot.docs.map(doc => doc.data());
  return MOCK_HOLDINGS;
}

/** Returns VOO monthly price history */
export async function fetchVOOHistory() {
  // TODO: replace with Firebase / market-data API call
  return MOCK_VOO_HISTORY;
}

/** Returns completed sell transactions */
export async function fetchSellTransactions() {
  // TODO: replace with Firebase Admin SDK call
  // const snapshot = await adminFirestore
  //   .collection("transactions")
  //   .where("type", "==", "SELL")
  //   .orderBy("saleDate", "desc")
  //   .get();
  // return snapshot.docs.map(doc => doc.data());
  return MOCK_SELL_TRANSACTIONS;
}
