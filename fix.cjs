const fs = require('fs');

function unescapeFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\\\`/g, '\`');
    content = content.replace(/\\\$/g, '\$');
    fs.writeFileSync(filePath, content);
}

unescapeFile('js/workspaces/inspector/OcularFormView.js');
unescapeFile('js/workspaces/inspector/InstallationFormView.js');
console.log('Done');
