/**
 * CSV Import Service
 *
 * Comprehensive service for importing CSV data with:
 * - Column mapping (auto and manual)
 * - Data validation and transformation
 * - Duplicate detection with fuzzy matching
 * - Merge/create resolution
 * - Import execution with rollback support
 */

import { db } from "../db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import {
  csvImportJobs,
  csvImportDuplicates,
  csvImportTemplates,
  ENTITY_TEMPLATES,
  DUPLICATE_DETECTION_CONFIG,
  type CsvImportJob,
  type NewCsvImportJob,
  type CsvImportDuplicate,
  type NewCsvImportDuplicate,
  type ColumnMapping,
  type ValidationError,
  type ImportError,
  type MatchingField,
  type MergeStrategy,
  type TemplateColumn,
} from "@shared/csv-import-schema";
import {
  businessRecords,
  enhancedContacts,
  equipment,
  inventoryItems,
} from "@shared/schema";
import { storage } from "../storage";

// ============= CSV PARSING =============

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

export function parseCSVContent(content: string): ParsedCSV {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every((v) => !v.trim())) continue;

    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || "";
    });
    rows.push(row);
  }

  return { headers, rows, rowCount: rows.length };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// ============= COLUMN MAPPING =============

export interface AutoMappingResult {
  mappings: ColumnMapping[];
  unmappedColumns: string[];
  overallConfidence: number;
}

export function autoMapColumns(
  sourceHeaders: string[],
  entityType: string
): AutoMappingResult {
  const templateColumns = ENTITY_TEMPLATES[entityType] || [];
  const mappings: ColumnMapping[] = [];
  const unmappedColumns: string[] = [];
  let totalConfidence = 0;
  let mappedCount = 0;

  for (const sourceHeader of sourceHeaders) {
    const normalizedSource = normalizeColumnName(sourceHeader);
    let bestMatch: TemplateColumn | null = null;
    let bestScore = 0;

    for (const templateCol of templateColumns) {
      // Check exact match on dbField
      if (normalizedSource === normalizeColumnName(templateCol.dbField)) {
        bestMatch = templateCol;
        bestScore = 100;
        break;
      }

      // Check exact match on name
      if (normalizedSource === normalizeColumnName(templateCol.name)) {
        bestMatch = templateCol;
        bestScore = 95;
        continue;
      }

      // Check aliases
      const aliases = templateCol.aliases || [];
      for (const alias of aliases) {
        if (normalizedSource === normalizeColumnName(alias)) {
          bestMatch = templateCol;
          bestScore = 90;
          break;
        }
      }

      // Fuzzy match
      const fuzzyScore = calculateSimilarity(
        normalizedSource,
        normalizeColumnName(templateCol.name)
      );
      if (fuzzyScore > bestScore && fuzzyScore >= 60) {
        bestMatch = templateCol;
        bestScore = fuzzyScore;
      }
    }

    if (bestMatch && bestScore >= 60) {
      mappings.push({
        sourceColumn: sourceHeader,
        targetField: bestMatch.dbField,
        confidence: bestScore,
        dataType: bestMatch.type,
        isRequired: bestMatch.required,
        aiSuggested: false,
        userConfirmed: bestScore >= 90,
      });
      totalConfidence += bestScore;
      mappedCount++;
    } else {
      unmappedColumns.push(sourceHeader);
    }
  }

  return {
    mappings,
    unmappedColumns,
    overallConfidence: mappedCount > 0 ? Math.round(totalConfidence / mappedCount) : 0,
  };
}

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  return Math.round((1 - matrix[a.length][b.length] / maxLen) * 100);
}

// ============= DATA VALIDATION =============

export function validateRow(
  row: Record<string, any>,
  mappings: ColumnMapping[],
  entityType: string,
  rowNumber: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const mapping of mappings) {
    const value = row[mapping.sourceColumn];
    const isEmpty = value === undefined || value === null || value === "";

    // Required field check
    if (mapping.isRequired && isEmpty) {
      errors.push({
        rowNumber,
        column: mapping.sourceColumn,
        value,
        errorType: "required",
        message: `${mapping.sourceColumn} is required`,
      });
      continue;
    }

    if (isEmpty) continue;

    // Type validation
    switch (mapping.dataType) {
      case "email":
        if (!isValidEmail(value)) {
          errors.push({
            rowNumber,
            column: mapping.sourceColumn,
            value,
            errorType: "format",
            message: `Invalid email format`,
            suggestion: "Ensure email is in format: name@domain.com",
          });
        }
        break;

      case "phone":
        if (!isValidPhone(value)) {
          errors.push({
            rowNumber,
            column: mapping.sourceColumn,
            value,
            errorType: "format",
            message: `Invalid phone format`,
            suggestion: "Use format: (555) 123-4567 or 555-123-4567",
          });
        }
        break;

      case "number":
        if (isNaN(parseFloat(value))) {
          errors.push({
            rowNumber,
            column: mapping.sourceColumn,
            value,
            errorType: "type",
            message: `Expected a number`,
          });
        }
        break;

      case "currency":
        const cleaned = String(value).replace(/[$,]/g, "");
        if (isNaN(parseFloat(cleaned))) {
          errors.push({
            rowNumber,
            column: mapping.sourceColumn,
            value,
            errorType: "type",
            message: `Invalid currency value`,
          });
        }
        break;

      case "date":
        if (!isValidDate(value)) {
          errors.push({
            rowNumber,
            column: mapping.sourceColumn,
            value,
            errorType: "format",
            message: `Invalid date format`,
            suggestion: "Use format: YYYY-MM-DD or MM/DD/YYYY",
          });
        }
        break;

      case "boolean":
        const boolVal = String(value).toLowerCase();
        if (!["true", "false", "yes", "no", "1", "0", "y", "n"].includes(boolVal)) {
          errors.push({
            rowNumber,
            column: mapping.sourceColumn,
            value,
            errorType: "type",
            message: `Expected true/false, yes/no, or 1/0`,
          });
        }
        break;

      case "url":
        if (!isValidUrl(value)) {
          errors.push({
            rowNumber,
            column: mapping.sourceColumn,
            value,
            errorType: "format",
            message: `Invalid URL format`,
            suggestion: "Include http:// or https://",
          });
        }
        break;
    }
  }

  return errors;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isValidDate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    // Try adding https://
    try {
      new URL(`https://${value}`);
      return true;
    } catch {
      return false;
    }
  }
}

// ============= DATA TRANSFORMATION =============

export function transformRow(
  row: Record<string, any>,
  mappings: ColumnMapping[]
): Record<string, any> {
  const transformed: Record<string, any> = {};

  for (const mapping of mappings) {
    const sourceValue = row[mapping.sourceColumn];
    if (sourceValue === undefined || sourceValue === null || sourceValue === "") {
      continue;
    }

    let value: any = sourceValue;

    // Transform based on data type
    switch (mapping.dataType) {
      case "phone":
        value = normalizePhone(sourceValue);
        break;

      case "email":
        value = String(sourceValue).toLowerCase().trim();
        break;

      case "number":
        value = parseFloat(sourceValue);
        break;

      case "currency":
        value = String(sourceValue).replace(/[$,]/g, "");
        value = parseFloat(value);
        break;

      case "date":
        const date = new Date(sourceValue);
        value = date.toISOString().split("T")[0];
        break;

      case "boolean":
        const boolVal = String(sourceValue).toLowerCase();
        value = ["true", "yes", "1", "y"].includes(boolVal);
        break;

      case "url":
        if (!sourceValue.startsWith("http")) {
          value = `https://${sourceValue}`;
        }
        break;

      default:
        value = String(sourceValue).trim();
    }

    transformed[mapping.targetField] = value;
  }

  return transformed;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// ============= DUPLICATE DETECTION =============

export interface DuplicateMatch {
  existingRecord: Record<string, any>;
  existingId: string;
  matchingFields: MatchingField[];
  matchScore: number;
}

export async function findDuplicates(
  transformedRow: Record<string, any>,
  entityType: string,
  tenantId: string
): Promise<DuplicateMatch[]> {
  const config = DUPLICATE_DETECTION_CONFIG[entityType];
  if (!config) return [];

  const matches: DuplicateMatch[] = [];

  // Build search criteria from primary fields
  const searchConditions: any[] = [];

  for (const field of config.primaryFields) {
    const value = transformedRow[field];
    if (value) {
      searchConditions.push({ field, value, type: "exact" });
    }
  }

  // Add secondary fields for broader matching
  for (const field of config.secondaryFields) {
    const value = transformedRow[field];
    if (value) {
      searchConditions.push({ field, value, type: "fuzzy" });
    }
  }

  if (searchConditions.length === 0) return [];

  // Search for potential duplicates based on entity type
  const existingRecords = await searchExistingRecords(
    entityType,
    tenantId,
    searchConditions
  );

  // Score each potential match
  for (const existing of existingRecords) {
    const matchingFields: MatchingField[] = [];
    let totalScore = 0;
    let fieldCount = 0;

    // Check primary fields (higher weight)
    for (const field of config.primaryFields) {
      const importValue = transformedRow[field];
      const existingValue = existing[field];
      if (importValue && existingValue) {
        const similarity = calculateFieldSimilarity(
          importValue,
          existingValue,
          config.fuzzyMatchFields.includes(field)
        );
        if (similarity > 50) {
          matchingFields.push({
            fieldName: field,
            importValue,
            existingValue,
            matchType: similarity === 100 ? "exact" : "fuzzy",
            similarity,
          });
          totalScore += similarity * 2; // Double weight for primary fields
          fieldCount += 2;
        }
      }
    }

    // Check secondary fields
    for (const field of config.secondaryFields) {
      const importValue = transformedRow[field];
      const existingValue = existing[field];
      if (importValue && existingValue) {
        const similarity = calculateFieldSimilarity(
          importValue,
          existingValue,
          config.fuzzyMatchFields.includes(field)
        );
        if (similarity > 50) {
          matchingFields.push({
            fieldName: field,
            importValue,
            existingValue,
            matchType: similarity === 100 ? "exact" : "fuzzy",
            similarity,
          });
          totalScore += similarity;
          fieldCount += 1;
        }
      }
    }

    if (fieldCount > 0) {
      const matchScore = Math.round(totalScore / fieldCount);
      if (matchScore >= config.matchThreshold) {
        matches.push({
          existingRecord: existing,
          existingId: existing.id,
          matchingFields,
          matchScore,
        });
      }
    }
  }

  // Sort by match score (highest first)
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

async function searchExistingRecords(
  entityType: string,
  tenantId: string,
  conditions: Array<{ field: string; value: any; type: string }>
): Promise<Record<string, any>[]> {
  // Build OR conditions for potential matches
  const orConditions: any[] = [];

  for (const condition of conditions) {
    if (condition.type === "exact") {
      orConditions.push({
        field: condition.field,
        value: condition.value,
        operator: "eq",
      });
    } else {
      // For fuzzy, use ILIKE
      orConditions.push({
        field: condition.field,
        value: `%${condition.value}%`,
        operator: "ilike",
      });
    }
  }

  switch (entityType) {
    case "business_records":
      return await searchBusinessRecords(tenantId, orConditions);

    case "contacts":
      return await searchContacts(tenantId, orConditions);

    case "equipment":
      return await searchEquipment(tenantId, orConditions);

    case "inventory":
      return await searchInventory(tenantId, orConditions);

    default:
      return [];
  }
}

async function searchBusinessRecords(
  tenantId: string,
  conditions: Array<{ field: string; value: any; operator: string }>
): Promise<Record<string, any>[]> {
  // Build dynamic WHERE conditions
  const whereConditions: any[] = [eq(businessRecords.tenantId, tenantId)];

  if (conditions.length > 0) {
    const orClauses = conditions.map((c) => {
      const column = (businessRecords as any)[c.field];
      if (!column) return null;
      if (c.operator === "eq") {
        return eq(column, c.value);
      } else {
        return ilike(column, c.value);
      }
    }).filter(Boolean);

    if (orClauses.length > 0) {
      whereConditions.push(or(...orClauses));
    }
  }

  const results = await db
    .select()
    .from(businessRecords)
    .where(and(...whereConditions))
    .limit(50);

  return results;
}

async function searchContacts(
  tenantId: string,
  conditions: Array<{ field: string; value: any; operator: string }>
): Promise<Record<string, any>[]> {
  const whereConditions: any[] = [eq(enhancedContacts.tenantId, tenantId)];

  if (conditions.length > 0) {
    const orClauses = conditions.map((c) => {
      const column = (enhancedContacts as any)[c.field];
      if (!column) return null;
      if (c.operator === "eq") {
        return eq(column, c.value);
      } else {
        return ilike(column, c.value);
      }
    }).filter(Boolean);

    if (orClauses.length > 0) {
      whereConditions.push(or(...orClauses));
    }
  }

  const results = await db
    .select()
    .from(enhancedContacts)
    .where(and(...whereConditions))
    .limit(50);

  return results;
}

async function searchEquipment(
  tenantId: string,
  conditions: Array<{ field: string; value: any; operator: string }>
): Promise<Record<string, any>[]> {
  const whereConditions: any[] = [eq(equipment.tenantId, tenantId)];

  if (conditions.length > 0) {
    const orClauses = conditions.map((c) => {
      const column = (equipment as any)[c.field];
      if (!column) return null;
      if (c.operator === "eq") {
        return eq(column, c.value);
      } else {
        return ilike(column, c.value);
      }
    }).filter(Boolean);

    if (orClauses.length > 0) {
      whereConditions.push(or(...orClauses));
    }
  }

  const results = await db
    .select()
    .from(equipment)
    .where(and(...whereConditions))
    .limit(50);

  return results;
}

async function searchInventory(
  tenantId: string,
  conditions: Array<{ field: string; value: any; operator: string }>
): Promise<Record<string, any>[]> {
  const whereConditions: any[] = [eq(inventoryItems.tenantId, tenantId)];

  if (conditions.length > 0) {
    const orClauses = conditions.map((c) => {
      const column = (inventoryItems as any)[c.field];
      if (!column) return null;
      if (c.operator === "eq") {
        return eq(column, c.value);
      } else {
        return ilike(column, c.value);
      }
    }).filter(Boolean);

    if (orClauses.length > 0) {
      whereConditions.push(or(...orClauses));
    }
  }

  const results = await db
    .select()
    .from(inventoryItems)
    .where(and(...whereConditions))
    .limit(50);

  return results;
}

function calculateFieldSimilarity(
  importValue: any,
  existingValue: any,
  useFuzzy: boolean
): number {
  const a = String(importValue).toLowerCase().trim();
  const b = String(existingValue).toLowerCase().trim();

  if (a === b) return 100;

  if (!useFuzzy) {
    // For non-fuzzy fields, only exact matches count
    return 0;
  }

  // Normalized comparison
  const normalizedA = a.replace(/[^a-z0-9]/g, "");
  const normalizedB = b.replace(/[^a-z0-9]/g, "");

  if (normalizedA === normalizedB) return 95;

  // Levenshtein similarity
  return calculateSimilarity(normalizedA, normalizedB);
}

// ============= MERGE LOGIC =============

export function mergeRecords(
  importData: Record<string, any>,
  existingData: Record<string, any>,
  strategy: MergeStrategy
): Record<string, any> {
  const merged: Record<string, any> = { ...existingData };

  for (const [field, source] of Object.entries(strategy.fieldSources)) {
    if (source === "import") {
      if (importData[field] !== undefined && importData[field] !== null && importData[field] !== "") {
        merged[field] = importData[field];
      }
    } else if (source === "combine") {
      const combineRule = strategy.combineRules?.[field] || "newer";
      merged[field] = combineFieldValues(
        importData[field],
        existingData[field],
        combineRule
      );
    }
    // If source === "existing", keep the existing value (already in merged)
  }

  return merged;
}

function combineFieldValues(
  importValue: any,
  existingValue: any,
  rule: string
): any {
  if (!importValue) return existingValue;
  if (!existingValue) return importValue;

  switch (rule) {
    case "concat":
      return `${existingValue}; ${importValue}`;

    case "longer":
      return String(importValue).length > String(existingValue).length
        ? importValue
        : existingValue;

    case "newer":
    default:
      return importValue;
  }
}

// ============= IMPORT JOB MANAGEMENT =============

export class CsvImportService {
  /**
   * Start a new import job
   */
  static async createImportJob(params: {
    tenantId: string;
    userId: string;
    entityType: string;
    fileName: string;
    fileSize: number;
    csvContent: string;
    useAiRefinement?: boolean;
    duplicateStrategy?: string;
  }): Promise<CsvImportJob> {
    const { headers, rows, rowCount } = parseCSVContent(params.csvContent);

    // Auto-map columns
    const { mappings, unmappedColumns, overallConfidence } = autoMapColumns(
      headers,
      params.entityType
    );

    // Create the import job
    const [job] = await db
      .insert(csvImportJobs)
      .values({
        tenantId: params.tenantId,
        userId: params.userId,
        entityType: params.entityType as any,
        fileName: params.fileName,
        fileSize: params.fileSize,
        status: "validating",
        useAiRefinement: params.useAiRefinement || false,
        originalHeaders: headers,
        columnMappings: mappings,
        unmappedColumns,
        totalRows: rowCount,
        duplicateStrategy: params.duplicateStrategy || "prompt",
        rawData: rows,
      })
      .returning();

    return job;
  }

  /**
   * Validate import data and detect duplicates
   */
  static async validateImport(jobId: string): Promise<{
    validRows: number;
    invalidRows: number;
    errors: ValidationError[];
    duplicatesDetected: number;
  }> {
    const [job] = await db
      .select()
      .from(csvImportJobs)
      .where(eq(csvImportJobs.id, jobId));

    if (!job) {
      throw new Error("Import job not found");
    }

    const rawData = job.rawData as Record<string, any>[];
    const mappings = job.columnMappings as ColumnMapping[];
    const entityType = job.entityType;
    const tenantId = job.tenantId;

    const errors: ValidationError[] = [];
    const transformedData: Record<string, any>[] = [];
    let validRows = 0;
    let invalidRows = 0;
    let duplicatesDetected = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 1;

      // Validate row
      const rowErrors = validateRow(row, mappings, entityType, rowNumber);

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        invalidRows++;
      } else {
        // Transform and check for duplicates
        const transformed = transformRow(row, mappings);
        transformedData.push({ ...transformed, _rowNumber: rowNumber });

        // Find duplicates
        const duplicates = await findDuplicates(transformed, entityType, tenantId);

        if (duplicates.length > 0) {
          duplicatesDetected++;

          // Create duplicate record for review
          await db.insert(csvImportDuplicates).values({
            importJobId: jobId,
            tenantId,
            rowNumber,
            rowData: transformed,
            existingRecordId: duplicates[0].existingId,
            existingRecordData: duplicates[0].existingRecord,
            matchingFields: duplicates[0].matchingFields,
            matchScore: duplicates[0].matchScore,
            resolution: "pending",
          });
        }

        validRows++;
      }
    }

    // Update job with validation results
    const newStatus = duplicatesDetected > 0 && job.duplicateStrategy === "prompt"
      ? "awaiting_review"
      : errors.length === 0 || validRows / rawData.length >= 0.8
        ? "processing"
        : "failed";

    await db
      .update(csvImportJobs)
      .set({
        status: newStatus,
        validRows,
        invalidRows,
        validationErrors: errors,
        duplicatesDetected,
        transformedData,
        updatedAt: new Date(),
      })
      .where(eq(csvImportJobs.id, jobId));

    return { validRows, invalidRows, errors, duplicatesDetected };
  }

  /**
   * Get pending duplicates for review
   */
  static async getPendingDuplicates(jobId: string): Promise<CsvImportDuplicate[]> {
    return await db
      .select()
      .from(csvImportDuplicates)
      .where(
        and(
          eq(csvImportDuplicates.importJobId, jobId),
          eq(csvImportDuplicates.resolution, "pending")
        )
      );
  }

  /**
   * Resolve a duplicate
   */
  static async resolveDuplicate(params: {
    duplicateId: string;
    resolution: "skip" | "merge" | "create_new";
    mergeStrategy?: MergeStrategy;
    userId: string;
  }): Promise<void> {
    await db
      .update(csvImportDuplicates)
      .set({
        resolution: params.resolution,
        mergeStrategy: params.mergeStrategy || null,
        resolvedBy: params.userId,
        resolvedAt: new Date(),
      })
      .where(eq(csvImportDuplicates.id, params.duplicateId));
  }

  /**
   * Resolve all duplicates with a single strategy
   */
  static async resolveAllDuplicates(params: {
    jobId: string;
    resolution: "skip" | "merge" | "create_new";
    userId: string;
  }): Promise<number> {
    const result = await db
      .update(csvImportDuplicates)
      .set({
        resolution: params.resolution,
        resolvedBy: params.userId,
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(csvImportDuplicates.importJobId, params.jobId),
          eq(csvImportDuplicates.resolution, "pending")
        )
      )
      .returning();

    return result.length;
  }

  /**
   * Execute the import after validation and duplicate resolution
   */
  static async executeImport(jobId: string): Promise<{
    imported: number;
    skipped: number;
    merged: number;
    errors: ImportError[];
  }> {
    const [job] = await db
      .select()
      .from(csvImportJobs)
      .where(eq(csvImportJobs.id, jobId));

    if (!job) {
      throw new Error("Import job not found");
    }

    // Check for unresolved duplicates
    const pendingDuplicates = await this.getPendingDuplicates(jobId);
    if (pendingDuplicates.length > 0 && job.duplicateStrategy === "prompt") {
      throw new Error(`${pendingDuplicates.length} duplicates still need resolution`);
    }

    // Get all duplicate resolutions
    const allDuplicates = await db
      .select()
      .from(csvImportDuplicates)
      .where(eq(csvImportDuplicates.importJobId, jobId));

    const duplicateRowNumbers = new Set(allDuplicates.map((d) => d.rowNumber));
    const duplicateMap = new Map(allDuplicates.map((d) => [d.rowNumber, d]));

    const transformedData = job.transformedData as Array<Record<string, any> & { _rowNumber: number }>;
    const entityType = job.entityType;
    const tenantId = job.tenantId;

    let imported = 0;
    let skipped = 0;
    let merged = 0;
    const errors: ImportError[] = [];

    // Update status to processing
    await db
      .update(csvImportJobs)
      .set({ status: "processing", startedAt: new Date() })
      .where(eq(csvImportJobs.id, jobId));

    for (const row of transformedData) {
      const rowNumber = row._rowNumber;
      delete row._rowNumber;

      try {
        if (duplicateRowNumbers.has(rowNumber)) {
          const duplicate = duplicateMap.get(rowNumber)!;
          const resolution = duplicate.resolution || job.duplicateStrategy;

          if (resolution === "skip" || resolution === "skip_all") {
            skipped++;
            continue;
          }

          if (resolution === "merge" || resolution === "merge_all") {
            // Merge with existing record
            const mergeStrategy = duplicate.mergeStrategy || {
              fieldSources: Object.fromEntries(
                Object.keys(row).map((k) => [k, "import" as const])
              ),
            };

            const mergedData = mergeRecords(
              row,
              duplicate.existingRecordData as Record<string, any>,
              mergeStrategy
            );

            await updateExistingRecord(
              entityType,
              duplicate.existingRecordId!,
              mergedData
            );

            // Update duplicate with result
            await db
              .update(csvImportDuplicates)
              .set({ resultRecordId: duplicate.existingRecordId })
              .where(eq(csvImportDuplicates.id, duplicate.id));

            merged++;
            continue;
          }

          // resolution === "create_new" or "create_all" - fall through to create
        }

        // Create new record
        const newId = await createNewRecord(entityType, tenantId, row);

        // Update duplicate record if it was marked create_new
        if (duplicateRowNumbers.has(rowNumber)) {
          const duplicate = duplicateMap.get(rowNumber)!;
          await db
            .update(csvImportDuplicates)
            .set({ resultRecordId: newId })
            .where(eq(csvImportDuplicates.id, duplicate.id));
        }

        imported++;
      } catch (error: any) {
        errors.push({
          rowNumber,
          errorType: "import_error",
          message: error.message || "Unknown error",
          details: { row },
        });
      }
    }

    // Update job with final results
    await db
      .update(csvImportJobs)
      .set({
        status: errors.length > 0 && imported === 0 ? "failed" : "completed",
        importedRows: imported,
        skippedRows: skipped,
        mergedRows: merged,
        duplicatesResolved: merged + skipped,
        importErrors: errors,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(csvImportJobs.id, jobId));

    return { imported, skipped, merged, errors };
  }

  /**
   * Update column mappings (user confirmation)
   */
  static async updateColumnMappings(
    jobId: string,
    mappings: ColumnMapping[]
  ): Promise<void> {
    await db
      .update(csvImportJobs)
      .set({
        columnMappings: mappings,
        updatedAt: new Date(),
      })
      .where(eq(csvImportJobs.id, jobId));
  }

  /**
   * Get import job by ID
   */
  static async getImportJob(jobId: string): Promise<CsvImportJob | null> {
    const [job] = await db
      .select()
      .from(csvImportJobs)
      .where(eq(csvImportJobs.id, jobId));
    return job || null;
  }

  /**
   * Get import jobs for a tenant
   */
  static async getImportJobs(
    tenantId: string,
    options?: { entityType?: string; status?: string; limit?: number }
  ): Promise<CsvImportJob[]> {
    const conditions = [eq(csvImportJobs.tenantId, tenantId)];

    if (options?.entityType) {
      conditions.push(eq(csvImportJobs.entityType, options.entityType as any));
    }
    if (options?.status) {
      conditions.push(eq(csvImportJobs.status, options.status as any));
    }

    return await db
      .select()
      .from(csvImportJobs)
      .where(and(...conditions))
      .orderBy(sql`${csvImportJobs.createdAt} DESC`)
      .limit(options?.limit || 50);
  }

  /**
   * Cancel an import job
   */
  static async cancelImport(jobId: string): Promise<void> {
    await db
      .update(csvImportJobs)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(csvImportJobs.id, jobId));
  }

  /**
   * Generate CSV template for an entity type
   */
  static generateTemplate(entityType: string): string {
    const columns = ENTITY_TEMPLATES[entityType];
    if (!columns) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    // Headers
    const headers = columns.map((c) => c.name);

    // Sample row
    const sampleRow = columns.map((c) => c.example);

    // Create CSV content
    const csvLines = [
      headers.map(escapeCSV).join(","),
      sampleRow.map(escapeCSV).join(","),
    ];

    return csvLines.join("\n");
  }

  /**
   * Get template columns for an entity type
   */
  static getTemplateColumns(entityType: string): TemplateColumn[] {
    return ENTITY_TEMPLATES[entityType] || [];
  }
}

// ============= HELPER FUNCTIONS FOR RECORD OPERATIONS =============

async function createNewRecord(
  entityType: string,
  tenantId: string,
  data: Record<string, any>
): Promise<string> {
  switch (entityType) {
    case "business_records":
      const [br] = await db
        .insert(businessRecords)
        .values({
          ...data,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: businessRecords.id });
      return br.id;

    case "contacts":
      const [contact] = await db
        .insert(enhancedContacts)
        .values({
          ...data,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: enhancedContacts.id });
      return contact.id;

    case "equipment":
      const [equip] = await db
        .insert(equipment)
        .values({
          ...data,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: equipment.id });
      return equip.id;

    case "inventory":
      const [inv] = await db
        .insert(inventoryItems)
        .values({
          ...data,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: inventoryItems.id });
      return inv.id;

    default:
      throw new Error(`Unsupported entity type for import: ${entityType}`);
  }
}

async function updateExistingRecord(
  entityType: string,
  recordId: string,
  data: Record<string, any>
): Promise<void> {
  // Remove id and tenantId from update data
  const { id, tenantId, createdAt, ...updateData } = data;

  switch (entityType) {
    case "business_records":
      await db
        .update(businessRecords)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(businessRecords.id, recordId));
      break;

    case "contacts":
      await db
        .update(enhancedContacts)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(enhancedContacts.id, recordId));
      break;

    case "equipment":
      await db
        .update(equipment)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(equipment.id, recordId));
      break;

    case "inventory":
      await db
        .update(inventoryItems)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(inventoryItems.id, recordId));
      break;

    default:
      throw new Error(`Unsupported entity type for update: ${entityType}`);
  }
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default CsvImportService;
