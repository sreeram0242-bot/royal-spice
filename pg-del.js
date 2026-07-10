require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => client.query('DELETE FROM "TablePasscode"'))
  .then(() => console.log('DELETED successfully'))
  .catch(console.error)
  .finally(() => client.end());
