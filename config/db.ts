import { Pool } from 'pg';

const pool = new Pool({
  user: 'your_db_user', // Replace with your database user
  host: 'your_db_host', // Replace with your database host
  database: 'your_db_name', // Replace with your database name
  password: 'your_db_password', // Replace with your database password
  port: 5432, // Default PostgreSQL port
});

export default pool;
