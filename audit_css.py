import os
import re
from collections import defaultdict

src_path = r'C:\Users\Eng.Amjed\Desktop\new-assiut-services\src'
base_path = r'C:\Users\Eng.Amjed\Desktop\new-assiut-services'

results = defaultdict(list)

# Define patterns to search for (pattern, issue type)
patterns = [
    (r'bg-white(?!\s*dark:)', 'bg-white without dark:bg'),
    (r'bg-slate-50(?!\s*dark:)', 'bg-slate-50 without dark:bg'),
    (r'bg-slate-100(?!\s*dark:)', 'bg-slate-100 without dark:bg'),
    (r'border-slate-50(?!\s*dark:)', 'border-slate-50 without dark:border'),
    (r'border-white(?!\s*dark:)', 'border-white without dark:border'),
    (r'text-slate-900(?!\s*dark:)', 'text-slate-900 without dark:text'),
    (r'text-slate-800(?!\s*dark:)', 'text-slate-800 without dark:text'),
    (r'text-white(?!.*dark:text-)', 'text-white without dark:text'),
    (r'bg-black(?!\s*dark:)', 'bg-black in light mode'),
    (r'style\s*=\s*["\'].*?(#[0-9a-f]+|rgb|color|background)', 'Inline hard-coded colors'),
]

file_count = 0

for root, dirs, files in os.walk(src_path):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.jsx', '.js')):
            file_count += 1
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                rel_path = filepath.replace(base_path, '')
                
                for i, line in enumerate(lines, 1):
                    for pattern, issue_type in patterns:
                        if re.search(pattern, line):
                            results[issue_type].append({
                                'file': rel_path,
                                'line': i,
                                'code': line.strip()
                            })
            except Exception as e:
                pass

print(f'=== DARK MODE CSS AUDIT ===')
print(f'Files scanned: {file_count}')
print(f'Total issues found: {sum(len(v) for v in results.values())}')
print()

for issue_type in sorted(results.keys()):
    issues = results[issue_type]
    print(f'\n[{len(issues)} occurrences] {issue_type}')
    print('-' * 100)
    
    for item in issues:
        print(f'{item["file"]}:{item["line"]}')
        print(f'  └─ {item["code"][:140]}')

print(f'\n\n=== SUMMARY BY FILE ===')
files_with_issues = defaultdict(list)
for issue_type, issues in results.items():
    for item in issues:
        files_with_issues[item['file']].append(issue_type)

for file_path in sorted(files_with_issues.keys()):
    issue_count = len(files_with_issues[file_path])
    print(f'{file_path}: {issue_count} issues')
