// =============================================================================
//  Planit MCP Server – src/tools/calculateTaxEvents.js
//  Tool: calculate_tax_events
//  Analyses sell transactions and simulates a capital-gains tax summary
//  (analogous to the US Schedule D / Form 8949 – referenced as "Form 867"
//  in the project spec for illustrative purposes).
// =============================================================================

import { fetchSellTransactions } from "../mockData.js";

// ── Tax rate constants (US 2024 federal rates – adjust as needed) ──────────
const SHORT_TERM_TAX_RATE = 0.22; // Ordinary income rate (22% bracket example)
const LONG_TERM_TAX_RATE  = 0.15; // Preferential LTCG rate (15% bracket example)
const LONG_TERM_THRESHOLD_DAYS = 365;

export const calculateTaxEventsTool = {
  name: "calculate_tax_events",
  description:
    "Analyses recent sell transactions in the Planit portfolio and simulates " +
    "a capital-gains tax calculation (Form 867 / Schedule D equivalent). " +
    "Returns short-term and long-term gains/losses, estimated federal tax " +
    "liability, and a per-transaction breakdown. No input required.",

  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },

  async handler(_args) {
    const transactions = await fetchSellTransactions();

    const shortTermEvents = [];
    const longTermEvents  = [];
    let shortTermGainTotal = 0;
    let longTermGainTotal  = 0;

    for (const txn of transactions) {
      const grossProceeds   = txn.shares * txn.salePrice;
      const costBasisTotal  = txn.shares * txn.costBasis;
      const capitalGain     = grossProceeds - costBasisTotal;
      const isLongTerm      = txn.holdingPeriodDays >= LONG_TERM_THRESHOLD_DAYS;

      const event = {
        id:              txn.id,
        ticker:          txn.ticker,
        shares:          txn.shares,
        saleDate:        txn.saleDate,
        salePrice:       `$${txn.salePrice.toFixed(2)}`,
        costBasis:       `$${txn.costBasis.toFixed(2)}`,
        grossProceeds:   `$${grossProceeds.toFixed(2)}`,
        costBasisTotal:  `$${costBasisTotal.toFixed(2)}`,
        capitalGain:     `$${capitalGain.toFixed(2)}`,
        holdingDays:     txn.holdingPeriodDays,
        termType:        isLongTerm ? "LONG-TERM (≥365 days)" : "SHORT-TERM (<365 days)",
        applicableRate:  isLongTerm
          ? `${(LONG_TERM_TAX_RATE  * 100).toFixed(0)}% LTCG`
          : `${(SHORT_TERM_TAX_RATE * 100).toFixed(0)}% Ordinary`,
      };

      if (isLongTerm) {
        longTermGainTotal += capitalGain;
        longTermEvents.push(event);
      } else {
        shortTermGainTotal += capitalGain;
        shortTermEvents.push(event);
      }
    }

    // ── Net gain/loss positions ───────────────────────────────────────────
    // Allow short-term losses to offset short-term gains, and LT losses → LT gains
    const netShortTerm = shortTermGainTotal;
    const netLongTerm  = longTermGainTotal;

    // If one category has a net loss, it can partially offset the other
    let taxableShortTerm = Math.max(netShortTerm, 0);
    let taxableLongTerm  = Math.max(netLongTerm, 0);
    const netLossCarryForward = Math.min(netShortTerm + netLongTerm, 0);

    const estimatedShortTermTax = taxableShortTerm * SHORT_TERM_TAX_RATE;
    const estimatedLongTermTax  = taxableLongTerm  * LONG_TERM_TAX_RATE;
    const totalEstimatedTax     = estimatedShortTermTax + estimatedLongTermTax;

    const result = {
      reportTitle: "Planit Capital Gains Tax Summary (Form 867 Simulation)",
      taxYear:     new Date().getFullYear(),
      generatedAt: new Date().toISOString(),
      ratesUsed: {
        shortTermRate: `${(SHORT_TERM_TAX_RATE * 100).toFixed(0)}% (ordinary income)`,
        longTermRate:  `${(LONG_TERM_TAX_RATE  * 100).toFixed(0)}% (preferential LTCG)`,
        note: "Federal rates only. State taxes not included.",
      },

      shortTermTransactions: {
        events:          shortTermEvents,
        netGainLoss:     `$${netShortTerm.toFixed(2)}`,
        estimatedTax:    `$${estimatedShortTermTax.toFixed(2)}`,
      },

      longTermTransactions: {
        events:          longTermEvents,
        netGainLoss:     `$${netLongTerm.toFixed(2)}`,
        estimatedTax:    `$${estimatedLongTermTax.toFixed(2)}`,
      },

      summary: {
        totalGrossProceeds:      `$${transactions
          .reduce((s, t) => s + t.shares * t.salePrice, 0)
          .toFixed(2)}`,
        totalCostBasis:          `$${transactions
          .reduce((s, t) => s + t.shares * t.costBasis, 0)
          .toFixed(2)}`,
        netShortTermGainLoss:    `$${netShortTerm.toFixed(2)}`,
        netLongTermGainLoss:     `$${netLongTerm.toFixed(2)}`,
        netLossCarryForward:     netLossCarryForward < 0
          ? `$${Math.abs(netLossCarryForward).toFixed(2)}`
          : "$0.00",
        totalEstimatedFederalTax:`$${totalEstimatedTax.toFixed(2)}`,
        effectiveTaxRate:
          transactions.reduce((s, t) => s + t.shares * t.salePrice, 0) > 0
            ? `${(
                (totalEstimatedTax /
                  transactions.reduce((s, t) => s + t.shares * t.salePrice, 0)) *
                100
              ).toFixed(2)}%`
            : "N/A",
        disclaimer:
          "⚠️  This is an estimate for planning purposes only and does not " +
          "constitute professional tax advice. Consult a licensed tax advisor.",
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
