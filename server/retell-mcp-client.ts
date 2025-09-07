import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';

export class RetellMCPClient {
  private client: Client;
  private connected = false;
  private serverProcess: ChildProcess | null = null;

  constructor() {
    this.client = new Client({
      name: "nexus-ar-client",
      version: "1.0.0"
    }, {
      capabilities: {}
    });
  }

  async connect() {
    if (this.connected) return;

    try {
      // Start the MCP server process
      this.serverProcess = spawn('node', ['server/mcp/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      const transport = new StdioClientTransport({
        readable: this.serverProcess.stdout as any,
        writable: this.serverProcess.stdin as any
      });

      await this.client.connect(transport);
      this.connected = true;
      console.log('Connected to Retell MCP server');
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  async createCall(params: {
    toNumber: string;
    fromNumber?: string;
    agentId?: string;
    customerName: string;
    invoiceData: any;
  }) {
    try {
      await this.connect();

      return await this.client.callTool({
        name: "create_phone_call",
        arguments: {
          to_number: params.toNumber,
          from_number: params.fromNumber || process.env.RETELL_PHONE_NUMBER,
          agent_id: params.agentId || process.env.RETELL_AGENT_ID,
          dynamic_variables: {
            customer_name: params.customerName,
            invoice_number: params.invoiceData.invoiceNumber,
            invoice_amount: params.invoiceData.amount,
            days_overdue: params.invoiceData.daysOverdue,
            demo_message: `[DEMO] This is a live demonstration of Nexus AR's AI collection system for ${params.customerName}.`
          }
        }
      });
    } catch (error) {
      console.error("MCP call failed, using fallback:", error);
      // Fallback for demo purposes
      return {
        result: {
          success: true,
          call_id: `fallback-call-${Date.now()}`,
          status: "queued",
          message: `Demo call initiated to ${params.toNumber} (fallback mode)`
        }
      };
    }
  }

  async getCallStatus(callId: string) {
    await this.connect();

    return await this.client.callTool({
      name: "get_call_status",
      arguments: { call_id: callId }
    });
  }

  async listCalls() {
    await this.connect();

    return await this.client.callTool({
      name: "list_calls",
      arguments: {}
    });
  }

  async disconnect() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
    this.connected = false;
  }
}