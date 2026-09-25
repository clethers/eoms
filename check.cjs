const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) getFiles(path.join(dir, file), fileList);
    else if (file.endsWith('.js')) fileList.push(path.join(dir, file));
  }
  return fileList;
}

const allJsFiles = getFiles('./js');
let hasErrors = false;

allJsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const imports = match[1].split(',').map(i => i.trim());
    const sourcePath = match[2];
    const targetPath = path.resolve(path.dirname(file), sourcePath);
    if (fs.existsSync(targetPath)) {
      const targetContent = fs.readFileSync(targetPath, 'utf8');
      imports.forEach(imp => {
        const impName = imp.split(' as ')[0].trim();
        const exportRegex1 = new RegExp('export\\s+(async\\s+)?function\\s+' + impName + '\\b');
        const exportRegex2 = new RegExp('export\\s+(const|let|var)\\s+' + impName + '\\b');
        const exportRegex3 = new RegExp('export\\s+\\{[^}]*' + impName + '[^}]*\\}');
        if (!exportRegex1.test(targetContent) && !exportRegex2.test(targetContent) && !exportRegex3.test(targetContent)) {
          console.error(`ERROR: '${impName}' is imported in ${file} but not exported by ${targetPath}`);
          hasErrors = true;
        }
      });
    }
  }
});
if (!hasErrors) console.log('All imports verified successfully.');
