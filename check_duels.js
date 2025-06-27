const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'data', 'data.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking duels in database...\n');

// Check all duels
db.all("SELECT id, player1, player2, amount, status, timestamp FROM duels ORDER BY id DESC", (err, rows) => {
  if (err) {
    console.error('Error:', err);
    return;
  }

  console.log('📊 All duels:');
  console.log('ID | Player1 | Player2 | Amount | Status | Timestamp');
  console.log('---|---------|---------|--------|--------|----------');
  
  rows.forEach(row => {
    console.log(`${row.id} | ${row.player1} | ${row.player2 || 'NULL'} | ${row.amount} | ${row.status} | ${row.timestamp}`);
  });

  console.log('\n🔍 Pending duels:');
  const pendingDuels = rows.filter(row => row.status === 'pending');
  if (pendingDuels.length === 0) {
    console.log('✅ No pending duels found');
  } else {
    pendingDuels.forEach(duel => {
      console.log(`- Duel ${duel.id}: Player ${duel.player1} waiting for opponent (${duel.amount} tokens)`);
    });
  }

  console.log('\n🔍 Completed duels:');
  const completedDuels = rows.filter(row => row.status === 'completed');
  console.log(`Total completed: ${completedDuels.length}`);

  console.log('\n🔍 Active duels:');
  const activeDuels = rows.filter(row => row.status === 'active');
  console.log(`Total active: ${activeDuels.length}`);

  db.close();
}); 