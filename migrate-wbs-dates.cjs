// CommonJS format
const { Pool, neonConfig } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const ws = require('ws');

// Ensure environment variables are loaded
dotenv.config();

// Configure neon to use websockets
neonConfig.webSocketConstructor = ws;

// Get the database connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  console.log('Running migration to make WBS date fields nullable...');
  console.log('Connecting to database: ' + connectionString.split('@')[1]); // Log just the host part for safety
  
  const pool = new Pool({ connectionString });
  
  try {
    // Execute the SQL statements directly through the database connection
    await pool.query(`
      -- Alter the wbs_items table to make date fields nullable
      ALTER TABLE wbs_items ALTER COLUMN start_date DROP NOT NULL;
      ALTER TABLE wbs_items ALTER COLUMN end_date DROP NOT NULL;
      ALTER TABLE wbs_items ALTER COLUMN duration DROP NOT NULL;
      
      -- Comment explaining the change
      COMMENT ON COLUMN wbs_items.start_date IS 'Start date (nullable, only required for Activity type)';
      COMMENT ON COLUMN wbs_items.end_date IS 'End date (nullable, only required for Activity type)';
      COMMENT ON COLUMN wbs_items.duration IS 'Duration in days (nullable, only required for Activity type)';
    `);
    
    console.log('Migration completed successfully!');
    console.log('You can now create Summary and WorkPackage WBS items without date fields.');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigration(); 