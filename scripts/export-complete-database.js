/**
 * Export complete database schema and data
 * This script generates SQL statements for both schema and data
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function exportDatabase() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const outputFile = path.join(process.cwd(), 'database-exports', 'complete-backup.sql');
    let sql = `-- Complete Database Backup
-- Generated: ${new Date().toISOString()}
-- Database: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown'}

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

`;

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`Found ${tablesResult.rows.length} tables`);

    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      console.log(`Processing table: ${tableName}`);

      // Get CREATE TABLE statement
      const createResult = await client.query(
        `
        SELECT 
          'CREATE TABLE IF NOT EXISTS ' || quote_ident(table_name) || ' (' ||
          string_agg(
            quote_ident(column_name) || ' ' ||
            data_type ||
            CASE 
              WHEN character_maximum_length IS NOT NULL 
              THEN '(' || character_maximum_length || ')'
              ELSE ''
            END ||
            CASE 
              WHEN is_nullable = 'NO' THEN ' NOT NULL'
              ELSE ''
            END ||
            CASE 
              WHEN column_default IS NOT NULL 
              THEN ' DEFAULT ' || column_default
              ELSE ''
            END,
            ', '
          ) || ');' as create_statement
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
        GROUP BY table_name;
      `,
        [tableName],
      );

      if (createResult.rows.length > 0) {
        sql += `\n-- Table: ${tableName}\n`;
        sql += createResult.rows[0].create_statement + '\n\n';
      }

      // Get data
      const dataResult = await client.query(`SELECT * FROM ${tableName}`);

      if (dataResult.rows.length > 0) {
        sql += `-- Data for ${tableName}\n`;

        for (const dataRow of dataResult.rows) {
          const columns = Object.keys(dataRow);
          const values = columns.map((col) => {
            const val = dataRow[col];
            if (val === null) return 'NULL';
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return val;
          });

          sql += `INSERT INTO ${tableName} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        sql += '\n';
      }
    }

    // Write to file
    fs.writeFileSync(outputFile, sql, 'utf8');
    console.log(`\n✅ Database exported successfully to: ${outputFile}`);
    console.log(`   Size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.error('Error exporting database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

exportDatabase();


