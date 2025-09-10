import puppeteer from 'puppeteer';
import { formatDate } from '../../shared/utils/dateFormatter';

export interface InvoicePDFData {
  invoiceNumber: string;
  contactName: string;
  contactEmail: string;
  companyName?: string;
  amount: number;
  taxAmount: number;
  issueDate: string;
  dueDate: string;
  description: string;
  currency: string;
  status: string;
  // Company details
  fromCompany: string;
  fromAddress?: string;
  fromEmail: string;
  fromPhone?: string;
  // Additional line items (future extensibility)
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] // Replit-friendly
  });
  
  try {
    const page = await browser.newPage();
    
    // Calculate amounts
    const subtotal = data.amount - data.taxAmount;
    const total = data.amount;
    
    // Format dates
    const issueDate = formatDate(data.issueDate);
    const dueDate = formatDate(data.dueDate);
    
    // Get status color
    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'paid': return '#10B981';
        case 'overdue': return '#EF4444';
        case 'pending': return '#F59E0B';
        default: return '#6B7280';
      }
    };

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Helvetica Neue', Arial, sans-serif; 
            font-size: 14px;
            line-height: 1.4;
            color: #333;
            background: white;
          }
          .invoice-container { 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 40px;
          }
          
          /* Header Section - Xero Style */
          .invoice-header { 
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 20px;
          }
          .company-info h1 { 
            font-size: 24px;
            font-weight: bold;
            color: #17B6C3;
            margin-bottom: 8px;
          }
          .company-info p { 
            color: #666;
            margin: 2px 0;
          }
          .invoice-title-section {
            text-align: right;
          }
          .invoice-title {
            font-size: 32px;
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
          }
          .invoice-number {
            font-size: 18px;
            color: #666;
            margin-bottom: 12px;
          }
          .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
            background-color: ${getStatusColor(data.status)};
          }
          
          /* Invoice Details Section */
          .invoice-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
          }
          .detail-section {
            flex: 1;
          }
          .detail-section:not(:last-child) {
            margin-right: 40px;
          }
          .detail-section h3 {
            font-size: 14px;
            font-weight: bold;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 8px;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 4px;
          }
          .detail-section p {
            margin: 4px 0;
            color: #333;
          }
          .detail-section .company-name {
            font-weight: bold;
            color: #333;
          }
          
          /* Line Items Table - Xero Style */
          .line-items-container {
            margin-bottom: 30px;
          }
          .line-items {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
          }
          .line-items thead {
            background-color: #f8f9fa;
          }
          .line-items th {
            padding: 16px 12px;
            text-align: left;
            font-weight: bold;
            color: #555;
            font-size: 13px;
            text-transform: uppercase;
            border-right: 1px solid #e0e0e0;
          }
          .line-items th:last-child {
            border-right: none;
            text-align: right;
          }
          .line-items td {
            padding: 16px 12px;
            border-bottom: 1px solid #f0f0f0;
            border-right: 1px solid #f0f0f0;
          }
          .line-items td:last-child {
            border-right: none;
            text-align: right;
            font-weight: bold;
          }
          .line-items tbody tr:last-child td {
            border-bottom: none;
          }
          
          /* Totals Section - Xero Style */
          .totals-section {
            margin-top: 30px;
            float: right;
            width: 300px;
          }
          .totals-table {
            width: 100%;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #f0f0f0;
          }
          .totals-table td:first-child {
            text-align: left;
            color: #666;
          }
          .totals-table td:last-child {
            text-align: right;
            font-weight: bold;
          }
          .total-row {
            background-color: #17B6C3;
            color: white;
          }
          .total-row td {
            border-bottom: none;
            font-size: 16px;
            font-weight: bold;
          }
          
          /* Payment Info */
          .payment-info {
            clear: both;
            margin-top: 60px;
            padding: 20px;
            background-color: #f8f9fa;
            border-left: 4px solid #17B6C3;
            border-radius: 4px;
          }
          .payment-info h3 {
            color: #17B6C3;
            margin-bottom: 12px;
            font-size: 16px;
          }
          .payment-info p {
            margin: 6px 0;
            color: #666;
          }
          
          /* Footer */
          .invoice-footer {
            margin-top: 40px;
            text-align: center;
            color: #888;
            font-size: 12px;
            border-top: 1px solid #e0e0e0;
            padding-top: 20px;
          }
          
          @media print {
            body { print-color-adjust: exact; }
            .invoice-container { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="invoice-header">
            <div class="company-info">
              <h1>${data.fromCompany}</h1>
              ${data.fromAddress ? `<p>${data.fromAddress}</p>` : ''}
              <p>${data.fromEmail}</p>
              ${data.fromPhone ? `<p>${data.fromPhone}</p>` : ''}
            </div>
            <div class="invoice-title-section">
              <div class="invoice-title">INVOICE</div>
              <div class="invoice-number">${data.invoiceNumber}</div>
              <div class="status-badge">${data.status}</div>
            </div>
          </div>
          
          <!-- Invoice Details -->
          <div class="invoice-details">
            <div class="detail-section">
              <h3>Bill To</h3>
              <p class="company-name">${data.contactName}</p>
              ${data.companyName ? `<p>${data.companyName}</p>` : ''}
              <p>${data.contactEmail}</p>
            </div>
            <div class="detail-section">
              <h3>Invoice Details</h3>
              <p><strong>Issue Date:</strong> ${issueDate}</p>
              <p><strong>Due Date:</strong> ${dueDate}</p>
              <p><strong>Currency:</strong> ${data.currency}</p>
            </div>
          </div>
          
          <!-- Line Items -->
          <div class="line-items-container">
            <table class="line-items">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="width: 80px;">Qty</th>
                  <th style="width: 100px;">Unit Price</th>
                  <th style="width: 120px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${data.lineItems && data.lineItems.length > 0 
                  ? data.lineItems.map(item => `
                    <tr>
                      <td>${item.description}</td>
                      <td>${item.quantity}</td>
                      <td>${data.currency} ${item.unitPrice.toFixed(2)}</td>
                      <td>${data.currency} ${item.amount.toFixed(2)}</td>
                    </tr>
                  `).join('')
                  : `
                    <tr>
                      <td>${data.description || 'Services Rendered'}</td>
                      <td>1</td>
                      <td>${data.currency} ${subtotal.toFixed(2)}</td>
                      <td>${data.currency} ${subtotal.toFixed(2)}</td>
                    </tr>
                  `
                }
              </tbody>
            </table>
          </div>
          
          <!-- Totals -->
          <div class="totals-section">
            <table class="totals-table">
              <tr>
                <td>Subtotal:</td>
                <td>${data.currency} ${subtotal.toFixed(2)}</td>
              </tr>
              ${data.taxAmount > 0 ? `
                <tr>
                  <td>Tax:</td>
                  <td>${data.currency} ${data.taxAmount.toFixed(2)}</td>
                </tr>
              ` : ''}
              <tr class="total-row">
                <td>Total:</td>
                <td>${data.currency} ${total.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          <!-- Payment Info -->
          <div class="payment-info">
            <h3>Payment Information</h3>
            <p>Please make payment by ${dueDate} to avoid any late fees.</p>
            <p>If you have any questions about this invoice, please contact us at ${data.fromEmail}</p>
          </div>
          
          <!-- Footer -->
          <div class="invoice-footer">
            <p>Thank you for your business!</p>
            <p>Generated on ${formatDate(new Date())}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { 
        top: '0.5in', 
        right: '0.5in', 
        bottom: '0.5in', 
        left: '0.5in' 
      }
    });
    
    return Buffer.from(pdf);
    
  } finally {
    await browser.close();
  }
}