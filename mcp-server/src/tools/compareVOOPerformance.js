// =============================================================================
//  Planit MCP Server – src/tools/compareVOOPerformance.js
//  Tool: compare_voo_performance
//  Compares VOO ETF performance over N months against the full portfolio.
// =============================================================================

import { z } from "zod";
import { fetchPortfolio, fetchVOOHistory } from "../mockData.js";

/**
 * Helper: get the N most-recent monthly entries from the history map,
 * sorted oldest → newest.
 */
function getRecentMonths(history, n) {
  const sorted = Object.entries(history).sort(([a], [b]) => a.localeCompare(b));
  return sorted.slice(-n);
}

export const compareVOOPerformanceTool = {
  name: "compare_voo_performance",
  description:
    "Returns the historical performance of VOO (Vanguard S&P 500 ETF) over " +
    "the last N months and compares it with the overall Planit portfolio " +
    "performance over the same window. Input: months (integer 1–24).",

  inputSchema: {
    type: "object",
    properties: {
      months: {
        type: "number",
        description: "Number of months to look back (1 – 24)",
        minimum: 1,
        maximum: 24,
      },
    },
    required: ["months"],
  },

  // Zod schema used for runtime validation inside the handler
  _zodSchema: z.object({
    months: z.number().int().min(1).max(24),
  }),

  async handler(args) {
    // Validate with Zod
    const parsed = compareVOOPerformanceTool._zodSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Input validation error: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }
    const { months } = parsed.data;

    const [vooHistory, holdings] = await Promise.all([
      fetchVOOHistory(),
      fetchPortfolio(),
    ]);

    // --- VOO performance ---
    const recentMonths = getRecentMonths(vooHistory, months + 1); // +1 for start price
    if (recentMonths.length < 2) {
      return {
        content: [
          {
            type: "text",
            text: `⚠️ Not enough VOO history for ${months} month(s). Available: ${
              Object.keys(vooHistory).length
            } months.`,
          },
        ],
        isError: true,
      };
    }

    const startVOO = recentMonths[0][1];
    const endVOO = recentMonths[recentMonths.length - 1][1];
    const vooReturnPct = (((endVOO - startVOO) / startVOO) * 100).toFixed(2);
    const vooReturnUSDperShare = (endVOO - startVOO).toFixed(2);

    const vooMonthlyData = recentMonths.map(([month, price]) => ({
      month,
      price: `$${price.toFixed(2)}`,
    }));

    // --- Portfolio performance (simplified, based on current vs cost basis) ---
    let totalInvested = 0;
    let totalCurrentValue = 0;
    holdings.forEach((h) => {
      totalInvested += h.shares * h.avgCostBasis;
      totalCurrentValue += h.shares * h.currentPrice;
    });

    // VOO weight in portfolio
    const vooHolding = holdings.find((h) => h.ticker === "VOO");
    const vooCurrentValue = vooHolding
      ? vooHolding.shares * vooHolding.currentPrice
      : 0;
    const vooWeightPct = ((vooCurrentValue / totalCurrentValue) * 100).toFixed(1);

    const portfolioReturnPct = (
      ((totalCurrentValue - totalInvested) / totalInvested) *
      100
    ).toFixed(2);

    const result = {
      window: {
        months,
        from: recentMonths[0][0],
        to: recentMonths[recentMonths.length - 1][0],
      },
      voo: {
        startPrice: `$${startVOO.toFixed(2)}`,
        endPrice: `$${endVOO.toFixed(2)}`,
        returnPerShare: `$${vooReturnUSDperShare}`,
        returnPct: `${vooReturnPct}%`,
        monthlyPrices: vooMonthlyData,
      },
      portfolio: {
        totalInvested: `$${totalInvested.toFixed(2)}`,
        totalCurrentValue: `$${totalCurrentValue.toFixed(2)}`,
        overallReturnPct: `${portfolioReturnPct}%`,
        vooAllocationPct: `${vooWeightPct}%`,
      },
      comparison: {
        vooPct: parseFloat(vooReturnPct),
        portfolioPct: parseFloat(portfolioReturnPct),
        delta: `${(parseFloat(portfolioReturnPct) - parseFloat(vooReturnPct)).toFixed(2)}%`,
        verdict:
          parseFloat(portfolioReturnPct) >= parseFloat(vooReturnPct)
            ? "✅ Your portfolio is outperforming VOO over this window."
            : "📉 VOO is outperforming your portfolio over this window.",
      },
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
