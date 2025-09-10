import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendEmailWithAttachment } from '../../services/sendgrid.js';
import { generateInvoicePDF } from '../../services/invoicePDF.js';
import { formatDate } from '../../shared/utils/dateFormatter.js';

export const registerEmailTools = (server: McpServer) => {
  server.tool(
    "sendInvoiceByEmail",
    "Send invoice email with PDF attachment to customer",
    {
      // Invoice data
      invoiceNumber: { type: "string", description: "Invoice number" },
      contactName: { type: "string", description: "Customer name" },
      contactEmail: { type: "string", description: "Customer email" },
      companyName: { type: "string", description: "Customer company name", optional: true },
      amount: { type: "number", description: "Total invoice amount" },
      taxAmount: { type: "number", description: "Tax amount", optional: true },
      issueDate: { type: "string", description: "Invoice issue date (ISO format)" },
      dueDate: { type: "string", description: "Invoice due date (ISO format)" },
      description: { type: "string", description: "Invoice description" },
      currency: { type: "string", description: "Currency code (e.g., USD, EUR)" },
      status: { type: "string", description: "Invoice status (pending, paid, overdue)" },
      
      // Company/Sender details
      fromEmail: { type: "string", description: "Sender email address" },
      fromCompany: { type: "string", description: "Company name" },
      fromAddress: { type: "string", description: "Company address", optional: true },
      fromPhone: { type: "string", description: "Company phone", optional: true },
      
      // Email settings
      subject: { type: "string", description: "Email subject line", optional: true },
      customMessage: { type: "string", description: "Custom email body message", optional: true },
      
      // Advanced options
      lineItems: { 
        type: "array", 
        description: "Detailed line items for invoice", 
        optional: true,
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unitPrice: { type: "number" },
            amount: { type: "number" }
          }
        }
      }
    },
    async (data: any) => {
      try {
        console.log(`Generating PDF invoice for ${data.invoiceNumber}...`);
        
        // Generate PDF with Xero-style layout
        const pdfBuffer = await generateInvoicePDF({
          invoiceNumber: data.invoiceNumber,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          companyName: data.companyName,
          amount: data.amount,
          taxAmount: data.taxAmount || 0,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          description: data.description,
          currency: data.currency,
          status: data.status,
          fromCompany: data.fromCompany,
          fromAddress: data.fromAddress,
          fromEmail: data.fromEmail,
          fromPhone: data.fromPhone,
          lineItems: data.lineItems
        });

        console.log(`PDF generated successfully, size: ${Math.round(pdfBuffer.length / 1024)}KB`);

        // Prepare email content
        const subject = data.subject || `Invoice ${data.invoiceNumber} - ${data.fromCompany}`;
        
        const defaultMessage = `
Dear ${data.contactName},

Please find attached invoice ${data.invoiceNumber} for ${data.currency} ${data.amount.toFixed(2)}.

Invoice Details:
- Invoice Number: ${data.invoiceNumber}
- Issue Date: ${formatDate(data.issueDate)}
- Due Date: ${formatDate(data.dueDate)}
- Amount: ${data.currency} ${data.amount.toFixed(2)}
- Status: ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}

Payment is due by ${formatDate(data.dueDate)}. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.

Best regards,
${data.fromCompany}
        `.trim();

        const htmlMessage = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #17B6C3; margin: 0;">${data.fromCompany}</h1>
    <p style="color: #666; margin: 5px 0;">Invoice Delivery</p>
  </div>
  
  <p>Dear ${data.contactName},</p>
  
  <p>Please find attached invoice ${data.invoiceNumber} for ${data.currency} ${data.amount.toFixed(2)}.</p>
  
  <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #17B6C3; margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; color: #333;">Invoice Details</h3>
    <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
    <p style="margin: 5px 0;"><strong>Issue Date:</strong> ${formatDate(data.issueDate)}</p>
    <p style="margin: 5px 0;"><strong>Due Date:</strong> ${formatDate(data.dueDate)}</p>
    <p style="margin: 5px 0;"><strong>Amount:</strong> ${data.currency} ${data.amount.toFixed(2)}</p>
    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${data.status === 'paid' ? '#10B981' : data.status === 'overdue' ? '#EF4444' : '#F59E0B'};">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span></p>
  </div>
  
  <p>Payment is due by <strong>${formatDate(data.dueDate)}</strong>. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to contact us.</p>
  
  <div style="margin: 30px 0; padding: 15px; background: #f0f9ff; border-radius: 4px;">
    <p style="margin: 0; color: #0369a1; font-size: 14px;"><strong>📎 PDF Invoice attached</strong> - Please open the attached PDF for the complete invoice details.</p>
  </div>
  
  <p>Best regards,<br>
  <strong>${data.fromCompany}</strong></p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #888; font-size: 12px; text-align: center;">
    <p>This email was generated automatically. Please do not reply to this email.</p>
  </div>
</div>
        `;

        const message = data.customMessage || defaultMessage;

        console.log(`Sending email to ${data.contactEmail}...`);

        // Send email with PDF attachment
        const success = await sendEmailWithAttachment({
          to: data.contactEmail,
          from: data.fromEmail,
          subject,
          text: message,
          html: data.customMessage ? undefined : htmlMessage,
          attachments: [{
            content: pdfBuffer,
            filename: `Invoice-${data.invoiceNumber}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment'
          }]
        });

        const result = {
          success,
          message: success 
            ? `Invoice email with PDF successfully sent to ${data.contactEmail}` 
            : "Failed to send invoice email with PDF attachment",
          recipientEmail: data.contactEmail,
          recipientName: data.contactName,
          invoiceNumber: data.invoiceNumber,
          invoiceAmount: `${data.currency} ${data.amount.toFixed(2)}`,
          attachmentSize: `${Math.round(pdfBuffer.length / 1024)}KB`,
          pdfFilename: `Invoice-${data.invoiceNumber}.pdf`,
          emailSubject: subject,
          timestamp: new Date().toISOString()
        };

        console.log('Email send result:', result);
        return result;
        
      } catch (error: any) {
        console.error(`Error sending invoice email: ${error.message}`);
        return {
          success: false,
          message: `Failed to send email: ${error.message}`,
          recipientEmail: data.contactEmail || 'unknown',
          recipientName: data.contactName || 'unknown',
          invoiceNumber: data.invoiceNumber || 'unknown',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
  );

  // Additional tool for sending simple reminder emails (existing functionality)
  server.tool(
    "sendReminderEmail",
    "Send simple payment reminder email without PDF attachment",
    {
      contactEmail: { type: "string", description: "Customer's email address" },
      contactName: { type: "string", description: "Customer's name" },
      invoiceNumber: { type: "string", description: "Invoice number" },
      amount: { type: "number", description: "Invoice amount" },
      dueDate: { type: "string", description: "Invoice due date" },
      daysPastDue: { type: "number", description: "Days past due" },
      fromEmail: { type: "string", description: "Sender email address" },
      customMessage: { type: "string", description: "Optional custom message", optional: true }
    },
    async (data: any) => {
      try {
        const { sendReminderEmail } = await import('../../services/sendgrid.js');
        
        const success = await sendReminderEmail(
          {
            contactEmail: data.contactEmail,
            contactName: data.contactName,
            invoiceNumber: data.invoiceNumber,
            amount: data.amount,
            dueDate: data.dueDate,
            daysPastDue: data.daysPastDue,
          },
          data.fromEmail,
          data.customMessage
        );

        return {
          success,
          message: success 
            ? `Payment reminder sent successfully to ${data.contactEmail}` 
            : "Failed to send payment reminder",
          recipientEmail: data.contactEmail,
          invoiceNumber: data.invoiceNumber,
          reminderType: 'simple_text',
          timestamp: new Date().toISOString()
        };
      } catch (error: any) {
        console.error(`Error sending reminder email: ${error.message}`);
        return {
          success: false,
          message: `Failed to send reminder: ${error.message}`,
          recipientEmail: data.contactEmail,
          invoiceNumber: data.invoiceNumber,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
  );
};