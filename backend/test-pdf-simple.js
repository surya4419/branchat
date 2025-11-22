// Simple test based on pdf-parse v2 documentation
const fs = require('fs');

async function testPdfParse() {
  try {
    // Import the module
    const pdfModule = require('pdf-parse');
    console.log('Module loaded:', Object.keys(pdfModule));
    
    // Try to use PDFParse class
    const { PDFParse } = pdfModule;
    console.log('PDFParse class:', typeof PDFParse);
    
    // Create instance
    const parser = new PDFParse();
    console.log('Parser created:', typeof parser);
    console.log('Parser methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
    
    // Try to parse a dummy buffer (will fail but shows the API)
    const dummyBuffer = Buffer.from('%PDF-1.4\n');
    
    try {
      const result = await parser.parse(dummyBuffer);
      console.log('Parse result:', result);
    } catch (err) {
      console.log('Parse error (expected):', err.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPdfParse();
