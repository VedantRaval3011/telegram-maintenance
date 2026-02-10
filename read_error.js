
const fs = require('fs');
const content = fs.readFileSync('error.log', 'utf16le');
console.log(content.split('\n').slice(-20).join('\n'));
