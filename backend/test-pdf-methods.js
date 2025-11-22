// Check available methods
const { PDFParse } = require('pdf-parse');

const parser = new PDFParse({ verbosity: 0 });

console.log('Parser instance:', parser);
console.log('\nParser prototype:', Object.getPrototypeOf(parser));
console.log('\nAll properties:');
for (let key in parser) {
  console.log(`  ${key}:`, typeof parser[key]);
}

console.log('\nOwn properties:', Object.getOwnPropertyNames(parser));
console.log('\nPrototype properties:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
