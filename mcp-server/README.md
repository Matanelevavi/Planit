# Planit MCP Server

A local **Model Context Protocol (MCP)** server that exposes Planit's financial portfolio data as AI-readable tools.

## 📁 Location

```
Planit/
├── backend/         ← Python / FastAPI backend
├── frontend/        ← React / Vite frontend
└── mcp-server/      ← This directory
    ├── src/
    │   ├── index.js               ← Server entry point
    │   ├── mockData.js            ← Mock (or Firebase) data layer
    │   └── tools/
    │       ├── getPortfolioStatus.js
    │       ├── compareVOOPerformance.js
    │       └── calculateTaxEvents.js
    ├── package.json
    └── .gitignore
```

## 🛠️ Tech Stack

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server + Stdio transport |
| `zod` | Input validation |
| `firebase-admin` | (Future) Firebase data access |

## 🚀 Quick Start

```bash
cd mcp-server
npm install
npm start
```

## 🔍 Test with MCP Inspector

```bash
cd mcp-server
npm run inspect
```

This opens the browser-based MCP Inspector UI where you can call each tool manually.

## 🧰 Registered Tools

### `get_portfolio_status`
Returns all current holdings (VOO, AAPL, MSFT, BND) with:
- Current market value
- Unrealised P&L (USD + %)
- Portfolio-level summary

**Input:** none

---

### `compare_voo_performance`
Compares VOO's performance over the last N months vs. the overall portfolio.

**Input:**
```json
{ "months": 6 }
```

---

### `calculate_tax_events`
Analyses all sell transactions and produces a capital-gains tax summary (Form 867 / Schedule D simulation).

**Input:** none

**Output includes:**
- Short-term vs long-term capital gains breakdown
- Per-transaction details
- Estimated federal tax liability

## 🔥 Connecting to Firebase (Future)

1. Download your Firebase service account key from the Firebase Console.
2. Save it as `mcp-server/serviceAccountKey.json` (already in `.gitignore`).
3. Create a `.env` file:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
   FIREBASE_PROJECT_ID=your-planit-project-id
   ```
4. Uncomment the Firebase calls in `src/mockData.js`.

## 📡 Connecting to an AI Model (Claude / Cursor / etc.)

Add this to your MCP client config (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "planit-finance": {
      "command": "node",
      "args": ["C:/Users/USER/OneDrive - Ariel University/שולחן העבודה/Planit/mcp-server/src/index.js"]
    }
  }
}
```
