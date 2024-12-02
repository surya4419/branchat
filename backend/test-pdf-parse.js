// Quick test script to verify pdf-parse works
const fs = require('fs');

async function testPdfParse() {
  console.log('Testing pdf-parse import methods...\n');
  
  // Method 1: Direct require
  const pdfParse1 = require('pdf-parse');
  console.log('Method 1 - require("pdf-parse")');
  console.log('  Type:', typeof pdfParse1);
  console.log('  Is function?', typeof pdfParse1 === 'function');
  console.log('  Has default?', pdfParse1.default !== undefined);
  console.log('  Has PDFParse?', pdfParse1.PDFParse !== undefined);
  
  // Method 2: Try default
  if (pdfParse1.default) {
    console.log('\nMethod 2 - require("pdf-parse").default');
    console.log('  Type:', typeof pdfParse1.default);
    console.log('  Is function?', typeof pdfParse1.default === 'function');
  }
  
  // Method 3: Try PDFParse
  if (pdfParse1.PDFParse) {
    console.log('\nMethod 3 - require("pdf-parse").PDFParse');
    console.log('  Type:', typeof pdfParse1.PDFParse);
    console.log('  Is function?', typeof pdfParse1.PDFParse === 'function');
  }
  
  // Find the actual parser function
  console.log('\n--- Finding the parser function ---');
  let parser = null;
  
  if (typeof pdfParse1 === 'function') {
    parser = pdfParse1;
    console.log('✓ Parser is the direct export');
  } else if (typeof pdfParse1.default === 'function') {
    parser = pdfParse1.default;
    console.log('✓ Parser is in .default');
  } else if (pdfParse1.PDFParse && typeof pdfParse1.PDFParse === 'function') {
    parser = new pdfParse1.PDFParse();
    console.log('✓ Parser is PDFParse class');
  }
  
  if (parser) {
    console.log('\n✓ Found parser function!');
    console.log('Use this in your code:');
    if (typeof pdfParse1 === 'function') {
      console.log('  const pdfParse = require("pdf-parse");');
    } else if (typeof pdfParse1.default === 'function') {
      console.log('  const pdfParse = require("pdf-parse").default;');
    }
  } else {
    console.log('\n✗ Could not find parser function');
    console.log('Available properties:', Object.keys(pdfParse1));
  }
}

testPdfParse().catch(console.error);
