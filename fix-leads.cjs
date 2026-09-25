const fs = require('fs');
const path = require('path');
const spv = 'js/workspaces/manager/SalesPipelineView.js';
let content = fs.readFileSync(spv, 'utf8');
content = content.replace(/leads\.find\(/g, 'this.allLeads.find(');
fs.writeFileSync(spv, content, 'utf8');
console.log('Fixed leads variable reference');
