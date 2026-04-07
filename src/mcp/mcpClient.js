import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class McpToolClient {
  constructor() {
    this.client = null;
    this.transport = null;
  }

  async connect() {
    // Start the local toolsServer as a child process
    const serverPath = path.join(__dirname, "toolsServer.js");
    this.transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
    });

    this.client = new Client(
      {
        name: "monsoonflow-coordinator-agent",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
    console.log("MCP Client connected to Tools Server");
  }

  async getTools() {
    if (!this.client) await this.connect();
    const response = await this.client.listTools();
    return response.tools;
  }

  async callTool(toolName, args) {
    if (!this.client) await this.connect();
    const response = await this.client.callTool({
      name: toolName,
      arguments: args,
    });
    return response.content[0].text;
  }

  async close() {
    if (this.transport) {
      await this.transport.close();
    }
  }
}

export const mcpClient = new McpToolClient();
