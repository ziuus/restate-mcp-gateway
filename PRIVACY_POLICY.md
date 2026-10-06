# Privacy Policy for Restate MCP Gateway

This Privacy Policy describes how the Restate MCP Gateway operates regarding data collection and usage.

## 1. No Personal Data Collection

**The Restate MCP Gateway does not collect, store, or transmit any personal identifiable information (PII) from its users.** It acts purely as a middleware to route and manage tool calls for AI agents.

## 2. No Usage Data Collection

**The Restate MCP Gateway does not collect any usage data, analytics, or telemetry.** All operations are confined to your local or private Restate cluster.

## 3. Data Processing

When you use the Restate MCP Gateway:
*   **Tool Execution Requests**: Tool calls (toolName, arguments) are processed locally by the Restate runtime. These requests may contain data required for the tool to function (e.g., file paths, command strings).
*   **Human-in-the-Loop (HITL) Data**: If HITL is enabled, metadata about pending approvals (toolName, arguments, sessionId, timestamp, policyRule) is stored temporarily in Restate's durable Key-Value store until resolved. This data is not shared externally.
*   **Audit Logs**: Execution results are stored in Restate's durable Key-Value store as an audit log. This log is accessible only via authenticated API endpoints (`/mcp/v1/audit/:sessionId`) and is not transmitted externally by the Gateway itself.

## 4. No External Services (except Restate)

The Gateway's core functionality does not rely on any third-party analytics, logging, or monitoring services outside of the Restate runtime itself. Your Restate cluster's privacy policy (whether self-hosted or managed) will apply to its internal operations.

## 5. Security & Trust

We prioritize the security and trust of the Restate MCP Gateway. For independent verification, refer to the project's listing on the M8ven Trust Index.

## 6. Changes to this Privacy Policy

This Privacy Policy may be updated from time to time. We encourage users to review this page periodically for any changes. Your continued use of the Gateway after any modifications will constitute your acknowledgment of the modifications and your consent to abide and be bound by the modified Privacy Policy.

## 7. Contact Us

If you have any questions about this Privacy Policy, please contact the project maintainers via the GitHub repository issues.
