// Thin client for the Planit REST API. Signs in once, reuses the access token and
// signs in again transparently when it expires.

export class PlanitApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "PlanitApiError";
    this.status = status;
  }
}

export class PlanitClient {
  /**
   * @param {{baseUrl: string, email: string, password: string, fetchImpl?: typeof fetch}} opts
   */
  constructor({ baseUrl, email, password, fetchImpl = fetch }) {
    if (!baseUrl || !email || !password) {
      throw new Error("PLANIT_API_URL, PLANIT_EMAIL and PLANIT_PASSWORD must be set");
    }
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.email = email;
    this.password = password;
    this.fetch = fetchImpl;
    this.token = null;
  }

  async #login() {
    const res = await this.fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });
    if (!res.ok) throw new PlanitApiError(res.status, "Planit sign-in failed (check PLANIT_EMAIL / PLANIT_PASSWORD)");
    this.token = (await res.json()).access_token;
  }

  async request(method, path, { query, body } = {}) {
    if (!this.token) await this.#login();
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));

    const send = () =>
      this.fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

    let res = await send();
    if (res.status === 401) {
      await this.#login();
      res = await send();
    }
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = typeof j.detail === "string" ? j.detail : "invalid request";
      } catch {
        /* non-JSON error body */
      }
      throw new PlanitApiError(res.status, `Planit API error ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    return res.status === 204 ? null : res.json();
  }

  listGoals() {
    return this.request("GET", "/goals/");
  }
  getSummary() {
    return this.request("GET", "/goals/summary");
  }
  getGoal(id) {
    return this.request("GET", `/goals/${id}`);
  }
  getProjection(id) {
    return this.request("GET", `/goals/${id}/projection`);
  }
  whatIf(id, monthly, annualReturnPct) {
    return this.request("GET", `/goals/${id}/what-if`, {
      query: { monthly, ...(annualReturnPct === undefined ? {} : { annual_return_pct: annualReturnPct }) },
    });
  }
  logContribution(id, amount, note) {
    return this.request("POST", `/goals/${id}/contributions`, { body: { amount, ...(note ? { note } : {}) } });
  }
}
