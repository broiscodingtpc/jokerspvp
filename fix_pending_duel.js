const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Open the database
const dbPath = path.join(__dirname, 'data', 'data.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Fixing pending duel issue...\n');

// Check the specific pending duel
db.get("SELECT * FROM duels WHERE id = 34", (err, row) => {
  if (err) {
    console.error('Error:', err);
    return;
  }

  if (row) {
    console.log('Found pending duel:');
    console.log(`ID: ${row.id}`);
    console.log(`Player1: ${row.player1}`);
    console.log(`Player2: ${row.player2}`);
    console.log(`Amount: ${row.amount}`);
    console.log(`Status: ${row.status}`);
    console.log(`Timestamp: ${row.timestamp}`);
    
    // This duel has been pending for too long, let's cancel it
    db.run("UPDATE duels SET status = 'cancelled' WHERE id = 34", (err) => {
      if (err) {
        console.error('Error cancelling duel:', err);
      } else {
        console.log('\n✅ Successfully cancelled the pending duel!');
        console.log('Now you should be able to start new duels.');
      }
      db.close();
    });
  } else {
    console.log('No pending duel found with ID 34');
    db.close();
  }
}); 