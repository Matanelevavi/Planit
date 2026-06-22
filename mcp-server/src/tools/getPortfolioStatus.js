// =============================================================================
//  Planit MCP Server – src/tools/getPortfolioStatus.js
//  Tool: get_portfolio_status
//  Returns the current Planit portfolio holdings with P&L calculations.
// =============================================================================

import { fetchPortfolio } from "../mockData.js";

/**
 * Tool definition object consumed by the MCP server registration helper.
 */
export const getPortfolioStatusTool = {
  name: "get_portfolio_status",
  description:
    "Fetches the current Planit portfolio holdings. Returns each position " +
    "with ticker, shares, current price, average cost basis, current market " +
    "value, unrealised P&L (in USD and %), and a portfolio-level summary " +
    "(total invested, total value, overall gain/loss).",

  // No input parameters required
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },

  async handler(_args) {
    const holdings = await fetchPortfolio();

    let totalInvested = 0;
    let totalValue = 0;

    const positions = holdings.map((h) => {
      const invested = h.shares * h.avgCostBasis;
      const currentValue = h.shares * h.currentPrice;
      const unrealisedPnL = currentValue - invested;
      const unrealisedPnLPct = ((unrealisedPnL / invested) * 100).toFixed(2);

      totalInvested += invested;
      totalValue += currentValue;

      return {
        ticker: h.ticker,
        name: h.name,
        sector: h.sector,
        shares: h.shares,
        avgCostBasis: `$${h.avgCostBasis.toFixed(2)}`,
        currentPrice: `$${h.currentPrice.toFixed(2)}`,
        currentValue: `$${currentValue.toFixed(2)}`,
        unrealisedPnL: `$${unrealisedPnL.toFixed(2)}`,
        unrealisedPnLPct: `${unrealisedPnLPct}%`,
        currency: h.currency,
        purchaseDates: h.purchaseDates,
      };
    });

    const totalPnL = totalValue - totalInvested;
    const totalPnLPct = ((totalPnL / totalInvested) * 100).toFixed(2);

    const result = {
      asOf: new Date().toISOString(),
      summary: {
        totalInvested: `$${totalInvested.toFixed(2)}`,
        totalCurrentValue: `$${totalValue.toFixed(2)}`,
        totalUnrealisedPnL: `$${totalPnL.toFixed(2)}`,
        totalUnrealisedPnLPct: `${totalPnLPct}%`,
        positionCount: positions.length,
      },
      positions,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};
