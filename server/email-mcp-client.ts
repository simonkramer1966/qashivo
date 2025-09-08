import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';

export class EmailMCPClient {
  private client: Client;
  private connected = false;
  private serverProcess?: ChildProcess;

  constructor() {
    this.client = new Client({
      name: "nexus-ar-email-client",
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
      console.log('Connected to Nexus AR MCP server');
    } catch (error) {
      console.error('Failed to connect to Email MCP server:', error);
      throw error;
    }
  }

  async sendInvoiceByEmail(params: {
    invoiceNumber: string;
    contactName: string;
    contactEmail: string;
    companyName?: string;
    amount: number;
    taxAmount?: number;
    issueDate: string;
    dueDate: string;
    description: string;
    currency: string;
    status: string;
    fromEmail: string;
    fromCompany: string;
    fromAddress?: string;
    fromPhone?: string;
    subject?: string;
    customMessage?: string;
    lineItems?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }>;
  }) {
    try {
      await this.connect();

      return await this.client.callTool({
        name: "sendInvoiceByEmail",
        arguments: {
          invoiceNumber: params.invoiceNumber,
          contactName: params.contactName,
          contactEmail: params.contactEmail,
          companyName: params.companyName,
          amount: params.amount,
          taxAmount: params.taxAmount || 0,
          issueDate: params.issueDate,
          dueDate: params.dueDate,
          description: params.description,
          currency: params.currency,
          status: params.status,
          fromEmail: params.fromEmail,
          fromCompany: params.fromCompany,
          fromAddress: params.fromAddress,
          fromPhone: params.fromPhone,
          subject: params.subject,
          customMessage: params.customMessage,
          lineItems: params.lineItems
        }
      });
    } catch (error) {
      console.error("MCP email call failed, using fallback:", error);
      // Fallback for demo purposes
      console.log("Fallback mode - would have sent email with these details:", {
        invoiceNumber: params.invoiceNumber,
        contactName: params.contactName,
        contactEmail: params.contactEmail,
        amount: params.amount,
        fromCompany: params.fromCompany
      });
      
      return {
        success: true,
        message: `Demo mode: Invoice email would be sent to ${params.contactEmail}`,
        recipientEmail: params.contactEmail,
        invoiceNumber: params.invoiceNumber,
        mode: "demo"
      };
    }
  }

  async sendReminderEmail(params: {
    contactEmail: string;
    contactName: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    daysPastDue: number;
    fromEmail: string;
    customMessage?: string;
  }) {
    try {
      await this.connect();

      return await this.client.callTool({
        name: "sendReminderEmail",
        arguments: params
      });
    } catch (error) {
      console.error("MCP reminder email call failed:", error);
      return {
        success: false,
        message: `Failed to send reminder: ${error}`,
        recipientEmail: params.contactEmail,
        mode: "error"
      };
    }
  }

  async disconnect() {
    if (this.connected) {
      try {
        await this.client.close();
        this.serverProcess?.kill();
        this.connected = false;
        console.log('Disconnected from Email MCP server');
      } catch (error) {
        console.error('Error disconnecting from MCP server:', error);
      }
    }
  }
}

// Create a singleton instance
export const emailMCPClient = new EmailMCPClient();