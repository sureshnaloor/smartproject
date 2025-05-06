import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Log connection details (masking password)
const connectionString = process.env.DATABASE_URL;
const maskedConnectionString = connectionString.replace(
  /(postgres:\/\/[^:]+):[^@]+(@.+)/,
  '$1:******$2'
);
console.log('Attempting to connect using:', maskedConnectionString);

const { Pool } = pg;

// Create a pool with database connection details and explicit SSL setting
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Accept self-signed certificates
  }
});

async function main() {
  try {
    // Test connection
    console.log('Testing connection to PostgreSQL...');
    const client = await pool.connect();
    console.log('Connection successful!');
    
    // Get server version
    const versionResult = await client.query('SELECT version()');
    console.log('Server version:', versionResult.rows[0].version);
    
    // Apply migrations
    console.log('\nApplying migrations...');
    
    // Read the migration files
    const mainMigration = fs.readFileSync(path.join(__dirname, './migrations/0000_woozy_captain_midlands.sql'), 'utf8');
    const alterDates = fs.readFileSync(path.join(__dirname, './migrations/alter-wbs-items-dates.sql'), 'utf8');

    // Execute migrations in a transaction
    await client.query('BEGIN');
    try {
      console.log('Creating tables...');
      await client.query(mainMigration);
      
      console.log('Updating table columns...');
      await client.query(alterDates);
      
      // Commit transaction if all queries succeed
      await client.query('COMMIT');
      console.log('All migrations applied successfully!\n');
    } catch (err) {
      // Rollback transaction if any query fails
      await client.query('ROLLBACK');
      console.error('Error applying migrations, rolling back:', err.message);
      throw err;
    }

    // Create tasks table if it doesn't exist in the migrations
    try {
      console.log('Ensuring tasks table exists...');
      const tasksTableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'tasks'
        );
      `);
      
      if (!tasksTableExists.rows[0].exists) {
        await client.query(`
          CREATE TABLE "tasks" (
            "id" serial PRIMARY KEY NOT NULL,
            "activity_id" integer NOT NULL,
            "project_id" integer NOT NULL,
            "name" text NOT NULL,
            "description" text,
            "start_date" date,
            "end_date" date,
            "duration" integer,
            "percent_complete" numeric(5, 2) DEFAULT '0',
            "created_at" timestamp DEFAULT now() NOT NULL
          );

          ALTER TABLE "tasks" ADD CONSTRAINT "tasks_activity_id_wbs_items_id_fk" 
            FOREIGN KEY ("activity_id") REFERENCES "public"."wbs_items"("id") ON DELETE cascade ON UPDATE no action;
          
          ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" 
            FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
        `);
        console.log('Tasks table created successfully!\n');
      } else {
        console.log('Tasks table already exists.\n');
      }
    } catch (err) {
      console.error('Error ensuring tasks table exists:', err.message);
    }

    console.log('Database setup complete. Your AWS PostgreSQL database is ready to use!');
    client.release();
  } catch (err) {
    console.error('Connection error:', err.message);
    console.log('\nPlease make sure:');
    console.log('1. Your AWS RDS security group allows connections from your IP address');
    console.log('2. The database credentials in your .env file are correct');
    console.log('3. The database instance is running and publicly accessible');
    console.log('4. If using SSL, the certificate is valid or try with ?sslmode=no-verify');
    
    if (err.code === '28000') {
      console.log('\nThis specific error (28000) suggests a authentication/permission issue:');
      console.log('- Verify the database username and password are correct');
      console.log('- Check if the database user has the necessary permissions');
    }
  } finally {
    await pool.end();
  }
}

main(); 