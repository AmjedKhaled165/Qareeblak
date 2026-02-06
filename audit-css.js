const fs = require('fs');
const path = require('path');

const srcPath = 'C:\\Users\\Eng.Amjed\\Desktop\\new-assiut-services\\src';
const basePath = 'C:\\Users\\Eng.Amjed\\Desktop\\new-assiut-services';

const results = {};

const patterns = [
    { regex: /bg-white(?!\s*dark:)/g, type: 'bg-white without dark:bg' },
    { regex: /bg-slate-50(?!\s*dark:)/g, type: 'bg-slate-50 without dark:bg' },
    { regex: /bg-slate-100(?!\s*dark:)/g, type: 'bg-slate-100 without dark:bg' },
    { regex: /border-slate-50(?!\s*dark:)/g, type: 'border-slate-50 without dark:border' },
    { regex: /border-white(?!\s*dark:)/g, type: 'border-white without dark:border' },
    { regex: /text-slate-900(?!\s*dark:)/g, type: 'text-slate-900 without dark:text' },
    { regex: /text-slate-800(?!\s*dark:)/g, type: 'text-slate-800 without dark:text' },
    { regex: /text-white(?!.*dark:text-)/g, type: 'text-white without dark:text' },
    { regex: /bg-black(?!\s*dark:)/g, type: 'bg-black in light mode' },
    { regex: /style\s*=\s*["'][^"']*?(#[0-9a-f]+|rgb|color|background)/gi, type: 'Inline hard-coded colors' },
];

function walkDir(dir) {
    try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walkDir(fullPath);
            } else if (/\.(tsx?|jsx?)$/.test(file)) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.split('\n');
                    const relPath = fullPath.replace(basePath, '');
                    
                    lines.forEach((line, i) => {
                        patterns.forEach(p => {
                            if (p.regex.test(line)) {
                                if (!results[p.type]) results[p.type] = [];
                                results[p.type].push({
                                    file: relPath,
                                    line: i + 1,
                                    code: line.trim().substring(0, 150)
                                });
                            }
                        });
                    });
                } catch (e) {}
            }
        });
    } catch (e) {}
}

walkDir(srcPath);

console.log('=== DARK MODE CSS AUDIT ===');
const totalIssues = Object.values(results).reduce((a, b) => a + b.length, 0);
console.log('Total issues:', totalIssues);

Object.keys(results).sort().forEach(type => {
    console.log('\n[' + results[type].length + '] ' + type);
    console.log('-'.repeat(100));
    results[type].forEach(item => {
        console.log(item.file + ':' + item.line);
        console.log('  └─ ' + item.code);
    });
});
