# 🛡️ Restate MCP Gateway

> **Make Any Model Context Protocol (MCP) Tool Durable, Rate-Limited, and Human-Gated in 1 Command.**

Restate MCP Gateway is an open-source proxy middleware that sits between AI clients (Claude Desktop, Cursor, AI agents) and external MCP tools. It wraps tool calls in [Restate's](https://restate.dev) durable execution engine to provide automatic retries, execution journaling, concurrency shaping, and human-in-the-loop (HITL) safety policy gates.

---

## 🏗️ Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │             Restate Engine (Rust)            │
                               │                                              │
┌──────────────────┐           │  ┌────────────────────────────────────────┐  │           ┌───────────────────────┐
│                  │  HTTP/MCP │  │            DurableMCPTool              │  │  Executes │                       │
│    AI Client     │──────────>│  │           (Virtual Object)             │  │──────────>│  Target MCP Servers   │
│ (Claude / Cursor)│           │  │                                        │  │           │ (GitHub, DB, Shell)   │
└──────────────────┘           │  │  • Automatic Retries (ctx.run)        │  │           └───────────────────────┘
                               │  │  • Human Approval Gate (awakeable)   │  │
                               │  │  • Durable Audit Log                 │  │
                               │  └────────────────────────────────────────┘  │
                               └──────────────────────────────────────────────┘
                                                      │
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │   Human Approval Dashboard   │
                                       │   (Slack / Webhook / UI)     │
                                       └──────────────────────────────┘
```

---

## ✨ Features

- 🔄 **Durable Execution & Retries:** Every tool execution is wrapped in `ctx.run()`. If a tool crashes or times out midway, Restate retries automatically without re-executing completed steps.
- 🛑 **Human-in-the-Loop Policy Gate:** Flag risky tools (`delete_file`, `drop_table`, `send_email`). Restate suspends execution via durable `awakeable` (zero CPU/memory footprint) until an admin approves or rejects the call.
- 📜 **Durable Audit Logging:** Full execution history per session stored in Restate Virtual Object state.
- 🚦 **Concurrency & Rate Limiting:** Enforce virtual queues per tool/scope to prevent hitting rate limits on external APIs.

---

## 🚀 Quickstart

### 1. Install Dependencies

```bash
# restate-mcp-gateway

[![M8ven Score](https://m8ven.ai/badge/mcp/ziuus/restate-mcp-gateway)](https://m8ven.ai/mcp/ziuus/restate-mcp-gateway?s=readme)
npm install
```

### 2. Start Restate Server & Service Endpoint

```bash
# Terminal 1: Start local Restate Engine
restate-server

# Terminal 2: Start Gateway & Services
npm run dev
```

### 3. Register Deployment with Restate

```bash
restate deployment register --force --yes http://localhost:9088/
```

---

## 🧪 Testing the Gateway

### 1. Normal Durable Tool Call (Auto-Executed)

```bash
curl -X POST http://localhost:3000/mcp/v1/call \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "agent-session-1",
    "toolName": "read_file",
    "args": { "path": "/etc/config.json" }
  }'
```

**Output:**
```json
{
  "toolName": "read_file",
  "status": "COMPLETED",
  "result": { "content": "[Restate Gateway] Read file contents of /etc/config.json" },
  "timestamp": "2026-10-02T11:45:00.000Z"
}
```

### 2. Risky Tool Call (Suspends for Human Approval)

```bash
curl -X POST http://localhost:3000/mcp/v1/call \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "agent-session-1",
    "toolName": "delete_file",
    "args": { "path": "/var/db/production.sqlite" }
  }'
```

*The call suspends in Restate with zero CPU/RAM cost.*

### 3. Approve the Call

```bash
curl -X POST http://localhost:3000/mcp/v1/approve \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "agent-session-1",
    "awakeableId": "<AWAKEABLE_ID>",
    "approve": true
  }'
```

### 4. Fetch Durable Audit Log

```bash
curl http://localhost:3000/mcp/v1/audit/agent-session-1
```

---

## 🛠️ API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp/v1/call` | `POST` | Execute an MCP tool through Restate durable proxy |
| `/mcp/v1/approve` | `POST` | Resolve a pending Human-in-the-Loop approval |
| `/mcp/v1/audit/:sessionId` | `GET` | Retrieve session execution audit log |

---

## 📄 License

MIT
