// Final test with correct API
const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function testPdfExtraction() {
  try {
    console.log('Testing PDF extraction with correct API...\n');
    
    // Create a minimal valid PDF
    const minimalPDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000214 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n308\n%%EOF');
    
    // Create parser
    const parser = new PDFParse({ verbosity: 0 });
    console.log('✓ Parser created');
    
    // Load PDF
    await parser.load(minimalPDF);
    console.log('✓ PDF loaded');
    
    // Get text
    const text = await parser.getText();
    console.log('✓ Text extracted:', text);
    
    // Clean up
    await parser.destroy();
    console.log('✓ Parser destroyed');
    
    console.log('\n✅ PDF extraction working correctly!');
    console.log('\nYour backend should now work with real PDF files.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPdfExtraction();
