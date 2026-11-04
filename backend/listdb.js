const Database = require('better-sqlite3');
const db = new Database('./data/learnspace.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
for (let t of tables) {
  console.log('=== ' + t.name + ' ===');
  const rows = db.prepare('SELECT * FROM ' + t.name).all();
  console.log('COUNT: ' + rows.length);
  if (t.name === 'users') {
    for (let r of rows) console.log(r.full_name + ' | ' + r.role + ' | ' + r.username);
  } else if (t.name === 'classes') {
    for (let r of rows) console.log(r.class_name + ' | ' + r.class_code);
  } else if (t.name === 'quizzes') {
    for (let r of rows) console.log(r.quiz_title + ' | class:' + r.class_id);
  }
  console.log('');
}
db.close();
