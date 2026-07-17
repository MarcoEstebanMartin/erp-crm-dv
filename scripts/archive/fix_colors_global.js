const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            // Global regex for any #E30613 inside a style object
            // Just replace #E30613 with var(--color-danger) anywhere
            // Except for tabs where we want var(--accent-color)
            
            // Tab lines
            content = content.replace(/2px solid #E30613/g, "2px solid var(--accent-color)");
            // If they had 'color: activeReportTab === ... ? '#E30613'' -> this was already replaced by the previous script to var(--color-danger). Let's fix it back to accent-color
            content = content.replace(/\? 'var\(--color-danger\)' : 'var\(--text-secondary\)'/g, "? 'var(--accent-color)' : 'var(--text-secondary)'");

            // Remaining #E30613
            content = content.replace(/#E30613/g, "var(--color-danger)");

            // Fix the old replace where I might have double replaced something
            // No, the old script only did exact matches.

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated: ' + fullPath);
            }
        }
    }
}

processDir(path.join(__dirname, 'frontend', 'src'));
