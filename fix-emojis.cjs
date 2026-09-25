const fs = require('fs');
const path = require('path');

const dir = 'js/workspaces';

function replaceInFile(filePath, regex, replacement) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
}

// SalesPipelineView
const spv = path.join(dir, 'manager', 'SalesPipelineView.js');
let content = fs.readFileSync(spv, 'utf8');
content = content.replace(/dY` \s*<\/button>/g, '👤</button>');
content = content.replace(/dY"<|<\/button>/g, '📋</button>');
content = content.replace(/dYss<\/button>/g, '🚚</button>');
content = content.replace(/dY'<\/button>/g, '💰</button>');
content = content.replace(/dY>,\?<\/button>/g, '🛠️</button>');
// The actual corrupted text in SalesPipelineView:
// `dY` ` -> 👤
// `dY"<` -> 📋
// `dYss` -> 🚚
// `dY'` -> 💰
// `dY>,?` -> 🛠️
fs.writeFileSync(spv, content, 'utf8');

// MasterDataCatalogView
const mdcv = path.join(dir, 'admin', 'MasterDataCatalogView.js');
let mdcvContent = fs.readFileSync(mdcv, 'utf8');
mdcvContent = mdcvContent.replace(/>o\?,\?<\/button>/g, '>✏️</button>');
mdcvContent = mdcvContent.replace(/>dY-`,\?<\/button>/g, '>🗑️</button>');
// It has ">o?,?</button>" and ">dY-`,?</button>"
fs.writeFileSync(mdcv, mdcvContent, 'utf8');

// The rest have "??" in them
const filesWithQQ = [
    path.join(dir, 'operations', 'AssignedQueueView.js'),
    path.join(dir, 'operations', 'HistoryView.js'),
    path.join(dir, 'operations', 'ReadyQueueView.js'),
    path.join(dir, 'operations', 'SavedDraftsView.js')
];

filesWithQQ.forEach(f => {
    if (fs.existsSync(f)) {
        let c = fs.readFileSync(f, 'utf8');
        // Replace based on title attribute
        c = c.replace(/title="[^"]*lock[^"]*"\s+style="[^"]*">\?\?<\/button>/gi, match => match.replace('??', '🔒'));
        c = c.replace(/title="Start Inspection"\s+style="[^"]*">\?\?<\/button>/gi, match => match.replace('??', '📝'));
        c = c.replace(/title="View Summary"\s+style="[^"]*">\?\?<\/button>/gi, match => match.replace('??', '👁️'));
        c = c.replace(/title="View Ocular Summary"\s+style="[^"]*">\?\?<\/button>/gi, match => match.replace('??', '👁️'));
        c = c.replace(/title="Edit"\s+style="[^"]*">\?\?<\/button>/gi, match => match.replace('??', '✏️'));
        c = c.replace(/title="Start Install"\s+style="[^"]*">\?\?<\/button>/gi, match => match.replace('??', '🛠️'));
        // Any remaining "??" in buttons just turn to an arrow or something
        c = c.replace(/>\?\?<\/button>/g, '>▶️</button>');
        fs.writeFileSync(f, c, 'utf8');
    }
});

console.log('Fixed emojis');
