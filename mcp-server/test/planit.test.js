import assert from "node:assert/strict";
import { test } from "node:test";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PlanitApiError, PlanitClient } from "../src/planitClient.js";
import { registerTools } from "../src/tools.js";

const json = (status, body) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Fake fetch with a scripted list of responses; records every call. */
function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body });
    const next = responses.shift();
    assert.ok(next, `unexpected request to ${url}`);
    return typeof next === "function" ? next(url, init) : next;
  };
  return { impl, calls };
}

const make = (responses) => {
  const f = fakeFetch(responses);
  const client = new PlanitClient({ baseUrl: "http://api.test/", email: "a@b.co", password: "pw", fetchImpl: f.impl });
  return { client, calls: f.calls };
};

test("requires credentials", () => {
  assert.throws(() => new PlanitClient({ baseUrl: "x", email: "", password: "" }), /must be set/);
});

test("logs in once and reuses the token", async () => {
  const { client, calls } = make([json(200, { access_token: "T1" }), json(200, []), json(200, [])]);
  await client.listGoals();
  await client.listGoals();
  assert.equal(calls.filter((c) => c.url.endsWith("/auth/login")).length, 1);
  assert.equal(calls[1].headers.Authorization, "Bearer T1");
  assert.equal(calls[1].url, "http://api.test/goals/");
});

test("signs in again when the token expires", async () => {
  const { client, calls } = make([
    json(200, { access_token: "old" }),
    json(401, { detail: "Not authenticated" }),
    json(200, { access_token: "new" }),
    json(200, [{ id: 1 }]),
  ]);
  assert.deepEqual(await client.listGoals(), [{ id: 1 }]);
  assert.equal(calls[3].headers.Authorization, "Bearer new");
});

test("a failed sign-in gives a clear error without leaking the password", async () => {
  const { client } = make([json(401, { detail: "Incorrect e-mail or password" })]);
  await assert.rejects(client.listGoals(), (e) => e instanceof PlanitApiError && !e.message.includes("pw") && /sign-in failed/.test(e.message));
});

test("surfaces API errors with the server's detail", async () => {
  const { client } = make([json(200, { access_token: "T" }), json(404, { detail: "Goal not found" })]);
  await assert.rejects(client.getGoal(9), /404: Goal not found/);
});

test("builds what-if and contribution requests", async () => {
  const { client, calls } = make([json(200, { access_token: "T" }), json(200, {}), json(201, {})]);
  await client.whatIf(3, "250.00", 6);
  await client.logContribution(3, "100.00", "salary");
  assert.equal(calls[1].url, "http://api.test/goals/3/what-if?monthly=250.00&annual_return_pct=6");
  assert.equal(calls[2].method, "POST");
  assert.deepEqual(JSON.parse(calls[2].body), { amount: "100.00", note: "salary" });
});

test("tools return API failures as tool errors instead of throwing", async () => {
  const { client } = make([json(200, { access_token: "T" }), json(500, { detail: "boom" })]);
  const handlers = {};
  registerTools({ registerTool: (name, _cfg, handler) => (handlers[name] = handler) }, client);
  assert.deepEqual(Object.keys(handlers).sort(), ["get_goal_projection", "list_goals", "log_contribution", "simulate_what_if"]);
  const result = await handlers.list_goals({});
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /500/);
});

test("list_goals returns summary and goals as JSON text", async () => {
  const { client } = make([json(200, { access_token: "T" }), json(200, { goal_count: 1 }), json(200, [{ id: 1, title: "Car" }])]);
  const handlers = {};
  registerTools({ registerTool: (name, _cfg, handler) => (handlers[name] = handler) }, client);
  const out = JSON.parse((await handlers.list_goals({})).content[0].text);
  assert.equal(out.summary.goal_count, 1);
  assert.equal(out.goals[0].title, "Car");
});

test("log_contribution is the only tool not marked read-only", () => {
  const cfgs = {};
  registerTools({ registerTool: (name, cfg) => (cfgs[name] = cfg) }, {});
  for (const [name, cfg] of Object.entries(cfgs)) {
    assert.equal(cfg.annotations.readOnlyHint, name !== "log_contribution", name);
  }
});

test("tools register on a real McpServer", () => {
  assert.doesNotThrow(() => registerTools(new McpServer({ name: "t", version: "0" }), {}));
});
