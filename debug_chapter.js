// Debug script - delete after use
const db = require('./src/db');
const fs = require('fs');
const path = require('path');

const out = [];

out.push('=== DB exports: ' + Object.keys(db).join(', '));

// Check books
const books = db.db.prepare('SELECT id, title, storage_path FROM books').all();
out.push('Books count: ' + books.length);

books.forEach(b => {
  out.push(`Book ${b.id}: ${b.title} => ${b.storage_path} [exists: ${fs.existsSync(b.storage_path)}]`);
  const chapters = db.db.prepare('SELECT id, title, relative_path, order_index FROM chapters WHERE book_id = ? ORDER BY order_index').all(b.id);
  chapters.forEach(c => {
    const fp = path.join(b.storage_path, c.relative_path);
    const exists = fs.existsSync(fp);
    out.push(`  Ch ${c.id} (idx=${c.order_index}): ${c.relative_path} [${exists ? 'FILE_OK' : 'FILE_MISSING'}]`);
  });
});

// Try getChapterContent with string IDs (as express would pass)
out.push('\n--- Testing getChapterContent with string IDs ---');
try {
  const result = db.getChapterContent('3', '4');
  out.push('SUCCESS: ' + result.chapter.title + ' content length=' + result.content.length);
} catch(e) {
  out.push('ERROR: ' + e.message);
}

fs.writeFileSync('./debug_out.txt', out.join('\n'));
process.stdout.write(out.join('\n') + '\n');
