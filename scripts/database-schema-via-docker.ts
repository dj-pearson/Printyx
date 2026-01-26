#!/usr/bin/env tsx
/**
 * Database Schema Reporter - Docker Exec Approach
 *
 * This script connects via SSH and uses docker exec to query the database directly,
 * bypassing all connection pooler and SSL issues.
 */

import 'dotenv/config';
import { Client as SSHClient } from 'ssh2';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

async function executeSSHCommand(sshConfig: SSHConfig, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();

    conn.on('ready', () => {
      console.log(`🔧 Executing: ${command}`);

      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        let stdout = '';
        let stderr = '';

        stream
          .on('close', (code: number) => {
            conn.end();
            if (code !== 0) {
              reject(new Error(`Command failed with code ${code}: ${stderr}`));
            } else {
              resolve(stdout);
            }
          })
          .on('data', (data: Buffer) => {
            stdout += data.toString();
          })
          .stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect(sshConfig);
  });
}

async function executeDockerCommand(
  sshConfig: SSHConfig,
  container: string,
  command: string,
): Promise<string> {
  const dockerCmd = `docker exec ${container} ${command}`;
  return executeSSHCommand(sshConfig, dockerCmd);
}

async function main() {
  console.log('🔍 Starting Database Schema Report Generation (Docker Exec Mode)...\n');

  // SSH Configuration
  const sshHost = process.env.SSH_HOST || process.env.SERVER_HOST || process.env.DB_HOST;
  const sshPort = parseInt(process.env.SSH_PORT || '22');
  const sshUser = process.env.SSH_USER || process.env.SERVER_USER || 'root';
  const sshPassword = process.env.SSH_PASSWORD || process.env.DB_PASSWORD;

  // Database Configuration
  const dbUser = process.env.DB_USER || 'postgres';
  const dbName = process.env.DB_NAME || 'postgres';
  const dbContainer = process.env.DB_CONTAINER;

  if (!sshHost) {
    throw new Error('SSH_HOST or DB_HOST environment variable required');
  }

  if (!dbContainer) {
    throw new Error('DB_CONTAINER environment variable required');
  }

  if (!sshPassword) {
    throw new Error('SSH_PASSWORD or DB_PASSWORD environment variable required');
  }

  console.log(`🔐 SSH Config: ${sshUser}@${sshHost}:${sshPort}`);
  console.log(`🐳 Container: ${dbContainer}`);
  console.log(`📊 Database: ${dbUser}@${dbName}\n`);

  const sshConfig: SSHConfig = {
    host: sshHost,
    port: sshPort,
    username: sshUser,
    password: sshPassword,
  };

  try {
    // First, list all containers to find the correct Supabase DB container
    console.log('🔍 Finding Supabase database container...\n');
    const containers = await executeSSHCommand(
      sshConfig,
      'docker ps --filter "name=supabase" --format "{{.Names}}"',
    );

    console.log(`📦 Found containers:\n${containers}\n`);

    // Use the provided container name or try to find it
    let actualContainer = dbContainer;
    if (containers && !containers.includes(dbContainer)) {
      // Try to find a DB container in the list
      const dbMatch = containers
        .split('\n')
        .find(
          (c: string) => c.toLowerCase().includes('db') || c.toLowerCase().includes('postgres'),
        );
      if (dbMatch) {
        console.log(`⚠️  Container "${dbContainer}" not found, using "${dbMatch}" instead\n`);
        actualContainer = dbMatch;
      }
    }

    // Query to get all tables with their columns
    const query = `
      SELECT 
        t.table_schema,
        t.table_name,
        obj_description((t.table_schema||'.'||t.table_name)::regclass, 'pg_class') as table_description,
        c.column_name,
        c.ordinal_position,
        c.data_type,
        c.character_maximum_length,
        c.is_nullable,
        c.column_default,
        col_description((t.table_schema||'.'||t.table_name)::regclass, c.ordinal_position) as column_description
      FROM information_schema.tables t
      JOIN information_schema.columns c 
        ON t.table_schema = c.table_schema 
        AND t.table_name = c.table_name
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'supabase_functions')
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_schema, t.table_name, c.ordinal_position;
    `;

    const psqlCommand = `psql -U ${dbUser} -d ${dbName} -t -A -F'|' -c "${query.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;

    console.log('📊 Querying database schema...\n');
    const result = await executeDockerCommand(sshConfig, actualContainer, psqlCommand);

    // Parse the result
    const lines = result.trim().split('\n');
    const tables: any = {};

    for (const line of lines) {
      if (!line.trim()) continue;

      const [
        schema,
        tableName,
        tableDesc,
        columnName,
        position,
        dataType,
        maxLength,
        nullable,
        defaultValue,
        columnDesc,
      ] = line.split('|');

      const tableKey = `${schema}.${tableName}`;
      if (!tables[tableKey]) {
        tables[tableKey] = {
          schema,
          name: tableName,
          description: tableDesc || '',
          columns: [],
        };
      }

      tables[tableKey].columns.push({
        name: columnName,
        position: parseInt(position),
        type: dataType,
        maxLength: maxLength || null,
        nullable: nullable === 'YES',
        default: defaultValue || null,
        description: columnDesc || '',
      });
    }

    const tableCount = Object.keys(tables).length;
    const columnCount = Object.values(tables).reduce(
      (sum: number, t: any) => sum + t.columns.length,
      0,
    );

    console.log(`✅ Found ${tableCount} tables with ${columnCount} columns\n`);

    // Write JSON output
    const outputPath = join(process.cwd(), 'database-schema-report.json');
    writeFileSync(outputPath, JSON.stringify(tables, null, 2));
    console.log(`📄 Schema report saved to: ${outputPath}`);

    // Generate markdown summary
    let markdown = '# Database Schema Report\n\n';
    markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
    markdown += `**Statistics:** ${tableCount} tables, ${columnCount} columns\n\n`;
    markdown += '## Tables\n\n';

    for (const [tableKey, table] of Object.entries(tables) as [string, any][]) {
      markdown += `### ${table.schema}.${table.name}\n\n`;
      if (table.description) {
        markdown += `${table.description}\n\n`;
      }
      markdown += '| Column | Type | Nullable | Default | Description |\n';
      markdown += '|--------|------|----------|---------|-------------|\n';

      for (const col of table.columns) {
        const type = col.maxLength ? `${col.type}(${col.maxLength})` : col.type;
        const nullable = col.nullable ? 'YES' : 'NO';
        const defaultVal = col.default || '-';
        const desc = col.description || '-';
        markdown += `| ${col.name} | ${type} | ${nullable} | ${defaultVal} | ${desc} |\n`;
      }
      markdown += '\n';
    }

    const mdPath = join(process.cwd(), 'docs', 'DATABASE_SCHEMA.md');
    writeFileSync(mdPath, markdown);
    console.log(`📄 Markdown report saved to: ${mdPath}`);

    console.log('\n✅ Schema report generation complete!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
