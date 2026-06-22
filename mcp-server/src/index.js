// =============================================================================
//  Planit MCP Server – src/index.js
//  Entry point: creates the McpServer, registers all three tools, and listens
//  via StdioServerTransport (stdin / stdout).
// =============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { fetchPortfolio, fetchVOOHistory, fetchSellTransactions } from "./mockData.js";

// ── 1. Instantiate the MCP server ─────────────────────────────────────────
const mcpServer = new McpServer({
  name: "planit-finance-server",
  version: "1.0.0",
});

// ── 2a. Tool: get_portfolio_status ─────────────────────────────────────────
mcpServer.registerTool(
  "get_portfolio_status",
  {
    title: "Get Portfolio Status",
    description:
      "Fetches the current Planit portfolio holdings. Returns each position " +
      "with ticker, shares, current price, average cost basis, current market " +
      "value, unrealised P&L (USD and %), and a portfolio-level summary " +
      "(total invested, total value, overall gain/loss).",
    inputSchema: {},   // no inputs
  },
  async () => {
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
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── 2b. Tool: compare_voo_performance ─────────────────────────────────────
/** Get the N most-recent monthly entries, sorted oldest → newest */
function getRecentMonths(history, n) {
  return Object.entries(history)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-n);
}

mcpServer.registerTool(
  "compare_voo_performance",
  {
    title: "Compare VOO Performance",
    description:
      "Returns the historical performance of VOO (Vanguard S&P 500 ETF) over " +
      "the last N months and compares it against the overall Planit portfolio. " +
      "Input: months (integer 1–24).",
    inputSchema: z.object({
      months: z
        .number()
        .int()
        .min(1)
        .max(24)
        .describe("Number of months to look back (1 – 24)"),
    }),
  },
  async ({ months }) => {
    const [vooHistory, holdings] = await Promise.all([
      fetchVOOHistory(),
      fetchPortfolio(),
    ]);

    const recentMonths = getRecentMonths(vooHistory, months + 1);

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

    const vooMonthlyData = recentMonths.map(([month, price]) => ({
      month,
      price: `$${price.toFixed(2)}`,
    }));

    let totalInvested = 0;
    let totalCurrentValue = 0;
    holdings.forEach((h) => {
      totalInvested += h.shares * h.avgCostBasis;
      totalCurrentValue += h.shares * h.currentPrice;
    });

    const vooHolding = holdings.find((h) => h.ticker === "VOO");
    const vooCurrentValue = vooHolding ? vooHolding.shares * vooHolding.currentPrice : 0;
    const vooWeightPct = ((vooCurrentValue / totalCurrentValue) * 100).toFixed(1);
    const portfolioReturnPct = (
      ((totalCurrentValue - totalInvested) / totalInvested) * 100
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
        returnPerShare: `$${(endVOO - startVOO).toFixed(2)}`,
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
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── 2c. Tool: calculate_tax_events ─────────────────────────────────────────
const SHORT_TERM_RATE = 0.22;
const LONG_TERM_RATE = 0.15;
const LT_THRESHOLD_DAYS = 365;

mcpServer.registerTool(
  "calculate_tax_events",
  {
    title: "Calculate Tax Events",
    description:
      "Analyses recent sell transactions in the Planit portfolio and simulates " +
      "a capital-gains tax report (Form 867 / Schedule D). Returns short-term " +
      "and long-term gains/losses, estimated federal tax liability, and a " +
      "per-transaction breakdown. No input required.",
    inputSchema: {},   // no inputs
  },
  async () => {
    const transactions = await fetchSellTransactions();

    const shortTermEvents = [];
    const longTermEvents = [];
    let stGainTotal = 0;
    let ltGainTotal = 0;

    for (const txn of transactions) {
      const grossProceeds = txn.shares * txn.salePrice;
      const costBasisTotal = txn.shares * txn.costBasis;
      const capitalGain = grossProceeds - costBasisTotal;
      const isLongTerm = txn.holdingPeriodDays >= LT_THRESHOLD_DAYS;

      const event = {
        id: txn.id,
        ticker: txn.ticker,
        shares: txn.shares,
        saleDate: txn.saleDate,
        salePrice: `$${txn.salePrice.toFixed(2)}`,
        costBasis: `$${txn.costBasis.toFixed(2)}`,
        grossProceeds: `$${grossProceeds.toFixed(2)}`,
        costBasisTotal: `$${costBasisTotal.toFixed(2)}`,
        capitalGain: `$${capitalGain.toFixed(2)}`,
        holdingDays: txn.holdingPeriodDays,
        termType: isLongTerm ? "LONG-TERM (≥365 days)" : "SHORT-TERM (<365 days)",
        applicableRate: isLongTerm
          ? `${(LONG_TERM_RATE * 100).toFixed(0)}% LTCG`
          : `${(SHORT_TERM_RATE * 100).toFixed(0)}% Ordinary`,
      };

      if (isLongTerm) {
        ltGainTotal += capitalGain;
        longTermEvents.push(event);
      } else {
        stGainTotal += capitalGain;
        shortTermEvents.push(event);
      }
    }

    const taxableST = Math.max(stGainTotal, 0);
    const taxableLT = Math.max(ltGainTotal, 0);
    const netLossCarryForward = Math.min(stGainTotal + ltGainTotal, 0);
    const estimatedSTTax = taxableST * SHORT_TERM_RATE;
    const estimatedLTTax = taxableLT * LONG_TERM_RATE;
    const totalEstimatedTax = estimatedSTTax + estimatedLTTax;
    const totalGrossProceeds = transactions.reduce(
      (s, t) => s + t.shares * t.salePrice, 0
    );

    const result = {
      reportTitle: "Planit Capital Gains Tax Summary (Form 867 Simulation)",
      taxYear: new Date().getFullYear(),
      generatedAt: new Date().toISOString(),
      ratesUsed: {
        shortTermRate: `${(SHORT_TERM_RATE * 100).toFixed(0)}% (ordinary income)`,
        longTermRate: `${(LONG_TERM_RATE * 100).toFixed(0)}% (preferential LTCG)`,
        note: "Federal rates only. State taxes not included.",
      },
      shortTermTransactions: {
        events: shortTermEvents,
        netGainLoss: `$${stGainTotal.toFixed(2)}`,
        estimatedTax: `$${estimatedSTTax.toFixed(2)}`,
      },
      longTermTransactions: {
        events: longTermEvents,
        netGainLoss: `$${ltGainTotal.toFixed(2)}`,
        estimatedTax: `$${estimatedLTTax.toFixed(2)}`,
      },
      summary: {
        totalGrossProceeds: `$${totalGrossProceeds.toFixed(2)}`,
        totalCostBasis: `$${transactions
          .reduce((s, t) => s + t.shares * t.costBasis, 0)
          .toFixed(2)}`,
        netShortTermGainLoss: `$${stGainTotal.toFixed(2)}`,
        netLongTermGainLoss: `$${ltGainTotal.toFixed(2)}`,
        netLossCarryForward:
          netLossCarryForward < 0
            ? `$${Math.abs(netLossCarryForward).toFixed(2)}`
            : "$0.00",
        totalEstimatedFederalTax: `$${totalEstimatedTax.toFixed(2)}`,
        effectiveTaxRate:
          totalGrossProceeds > 0
            ? `${((totalEstimatedTax / totalGrossProceeds) * 100).toFixed(2)}%`
            : "N/A",
        disclaimer:
          "⚠️ This is an estimate for planning purposes only and does not constitute professional tax advice.",
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── 3. Connect via Stdio transport ─────────────────────────────────────────
const transport = new StdioServerTransport();
await mcpServer.connect(transport);

process.stderr.write(
  "[planit-mcp-server] ✅ Server running on stdio – 3 tools registered:\n" +
  "  • get_portfolio_status\n" +
  "  • compare_voo_performance\n" +
  "  • calculate_tax_events\n"
);
