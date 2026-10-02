import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Sample target MCP server representing external tools (FS, Exec, DB)
const server = new Server({
    name: "sample-system-tools",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Define tools available on this target server
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "read_file",
                description: "Read contents of a file",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "File path to read" },
                    },
                    required: ["path"],
                },
            },
            {
                name: "write_file",
                description: "Write content to a file",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "File path to write" },
                        content: { type: "string", description: "Content to write" },
                    },
                    required: ["path", "content"],
                },
            },
            {
                name: "delete_file",
                description: "RISKY: Delete a file from disk",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string", description: "File path to delete" },
                    },
                    required: ["path"],
                },
            },
            {
                name: "execute_command",
                description: "RISKY: Execute a shell command",
                inputSchema: {
                    type: "object",
                    properties: {
                        command: { type: "string", description: "Command to execute" },
                    },
                    required: ["command"],
                },
            },
        ],
    };
});
// Handle tool execution logic
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case "read_file":
            return {
                content: [
                    {
                        type: "text",
                        text: `[Sample Output] Read file '${args?.path}': File content loaded successfully.`,
                    },
                ],
            };
        case "write_file":
            return {
                content: [
                    {
                        type: "text",
                        text: `[Sample Output] Wrote ${String(args?.content).length} bytes to '${args?.path}'.`,
                    },
                ],
            };
        case "delete_file":
            return {
                content: [
                    {
                        type: "text",
                        text: `[Sample Output] Deleted file '${args?.path}'.`,
                    },
                ],
            };
        case "execute_command":
            return {
                content: [
                    {
                        type: "text",
                        text: `[Sample Output] Command '${args?.command}' executed with exit code 0.`,
                    },
                ],
            };
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("Fatal error in sample MCP server:", err);
    process.exit(1);
});
