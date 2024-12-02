// Test pdf-parse v2 with correct API
const fs = require('fs');

async function testPdfParse() {
  try {
    const { PDFParse } = require('pdf-parse');
    
    // Create parser with options
    const parser = new PDFParse({
      verbosity: 0 // 0 = errors only
    });
    
    console.log('✓ Parser created successfully');
    console.log('Parser type:', typeof parser);
    console.log('Has parse method?', typeof parser.parse === 'function');
    
    // Test with a minimal PDF buffer
    const minimalPDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000214 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n308\n%%EOF');
    
    try {
      console.log('\nAttempting to parse PDF...');
      const result = await parser.parse(minimalPDF);
      console.log('✓ Parse successful!');
      console.log('Text extracted:', result.text);
      console.log('Number of pages:', result.numpages);
    } catch (parseError) {
      console.log('Parse error:', parseError.message);
    }
    
    console.log('\n--- Correct usage for your code ---');
    console.log('const { PDFParse } = require("pdf-parse");');
    console.log('const parser = new PDFParse({ verbosity: 0 });');
    console.log('const result = await parser.parse(buffer);');
    console.log('const text = result.text;');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPdfParse();
