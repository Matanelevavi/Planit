import { z } from "zod";

const text = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const failure = (error) => ({
  isError: true,
  content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
});

/** Wrap a handler so API failures are returned to the model as tool errors, not crashes. */
const safe = (fn) => async (args) => {
  try {
    return text(await fn(args));
  } catch (error) {
    return failure(error);
  }
};

const goalId = z.number().int().positive().describe("Goal id (from list_goals)");

/**
 * Registers all tools on an McpServer.
 * Reads are annotated read-only; log_contribution is the only tool that changes data.
 */
export function registerTools(server, client) {
  server.registerTool(
    "list_goals",
    {
      title: "List goals",
      description:
        "Lists the user's financial goals with progress, status (completed / on_track / at_risk / off_track) " +
        "and the suggested monthly deposit, plus a portfolio-level summary. Amounts are in ILS.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    safe(async () => ({ summary: await client.getSummary(), goals: await client.listGoals() })),
  );

  server.registerTool(
    "get_goal_projection",
    {
      title: "Get goal projection",
      description:
        "Month-by-month projection for one goal: the expected path with cautious/optimistic bands, " +
        "the required monthly deposit, and the history of the balance so far.",
      inputSchema: { goal_id: goalId },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ goal_id }) => ({ goal: await client.getGoal(goal_id), projection: await client.getProjection(goal_id) })),
  );

  server.registerTool(
    "simulate_what_if",
    {
      title: "Simulate a different deposit",
      description:
        "Calculates what would happen to a goal if the user deposited a given amount every month " +
        "(optionally with a different yearly return). Does not change any data.",
      inputSchema: {
        goal_id: goalId,
        monthly: z.number().min(0).max(1_000_000).describe("Monthly deposit in ILS"),
        annual_return_pct: z.number().min(0).max(20).optional().describe("Yearly return in percent (default: the goal's own)"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(({ goal_id, monthly, annual_return_pct }) => client.whatIf(goal_id, monthly.toFixed(2), annual_return_pct)),
  );

  server.registerTool(
    "log_contribution",
    {
      title: "Log a deposit or withdrawal",
      description:
        "Records a deposit (positive amount) or withdrawal (negative) on a goal, dated today. " +
        "This CHANGES the user's data — only call it when the user has explicitly asked to record it.",
      inputSchema: {
        goal_id: goalId,
        amount: z.number().refine((n) => n !== 0, "must not be zero").describe("ILS; negative for a withdrawal"),
        note: z.string().max(200).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    safe(({ goal_id, amount, note }) => client.logContribution(goal_id, amount.toFixed(2), note)),
  );
}
