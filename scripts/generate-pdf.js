import { mdToPdf } from 'md-to-pdf';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generatePDF() {
  console.log('📄 Generating PDF from markdown...');
  
  const mdPath = join(__dirname, '..', 'DEVELOPER_HANDOVER.md');
  const pdfPath = join(__dirname, '..', 'DEVELOPER_HANDOVER.pdf');
  
  try {
    const pdf = await mdToPdf(
      { path: mdPath },
      {
        dest: pdfPath,
        pdf_options: {
          format: 'A4',
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          },
          printBackground: true
        },
        stylesheet: `
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #2d3748;
            font-size: 11pt;
          }
          
          h1 {
            color: #17B6C3;
            font-size: 24pt;
            margin-top: 30px;
            margin-bottom: 15px;
            page-break-after: avoid;
          }
          
          h2 {
            color: #1a202c;
            font-size: 18pt;
            margin-top: 25px;
            margin-bottom: 12px;
            page-break-after: avoid;
            border-bottom: 2px solid #17B6C3;
            padding-bottom: 5px;
          }
          
          h3 {
            color: #2d3748;
            font-size: 14pt;
            margin-top: 20px;
            margin-bottom: 10px;
            page-break-after: avoid;
          }
          
          h4 {
            color: #4a5568;
            font-size: 12pt;
            margin-top: 15px;
            margin-bottom: 8px;
          }
          
          p {
            margin: 8px 0;
          }
          
          code {
            background-color: #f7fafc;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 10pt;
            color: #e53e3e;
          }
          
          pre {
            background-color: #2d3748;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            page-break-inside: avoid;
            margin: 15px 0;
          }
          
          pre code {
            background-color: transparent;
            color: #e2e8f0;
            padding: 0;
          }
          
          ul, ol {
            margin: 10px 0;
            padding-left: 30px;
          }
          
          li {
            margin: 5px 0;
          }
          
          strong {
            color: #1a202c;
            font-weight: 600;
          }
          
          hr {
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 20px 0;
          }
          
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
            page-break-inside: avoid;
          }
          
          th, td {
            border: 1px solid #e2e8f0;
            padding: 8px;
            text-align: left;
          }
          
          th {
            background-color: #17B6C3;
            color: white;
          }
        `
      }
    );
    
    const fileSize = (readFileSync(pdfPath).length / 1024 / 1024).toFixed(2);
    console.log('✅ PDF generated successfully:', pdfPath);
    console.log('📦 File size:', fileSize, 'MB');
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
}

generatePDF().catch(console.error);
