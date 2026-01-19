/**
 * Column Mapping Interface Component
 * Visual UI for mapping CSV columns to Printyx fields
 * Supports auto-detection and manual override
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Info,
  Zap,
} from 'lucide-react';
import {
  autoMapSalesforceColumns,
  calculateMappingConfidence,
  getPrintyxFields,
  SALESFORCE_MAPPINGS,
  type FieldMapping,
} from '@/lib/import-mappings/salesforce-mapping';

interface ColumnMappingInterfaceProps {
  csvHeaders: string[];
  csvSampleData?: string[][];
  onMappingComplete: (mappings: Map<string, string>) => void;
  entityType?: string;
}

export function ColumnMappingInterface({
  csvHeaders,
  csvSampleData = [],
  onMappingComplete,
  entityType = 'business_records',
}: ColumnMappingInterfaceProps) {
  const [mappings, setMappings] = useState<Map<string, string>>(new Map());
  const [confidence, setConfidence] = useState(0);
  const [autoMapped, setAutoMapped] = useState(false);

  const printyxFields = getPrintyxFields();

  // Auto-detect on mount
  useEffect(() => {
    if (csvHeaders.length > 0 && !autoMapped) {
      handleAutoMap();
    }
  }, [csvHeaders]);

  const handleAutoMap = () => {
    const detected = autoMapSalesforceColumns(csvHeaders);
    setMappings(detected);
    setConfidence(calculateMappingConfidence(csvHeaders));
    setAutoMapped(true);
  };

  const handleManualMap = (csvColumn: string, printyxField: string) => {
    const newMappings = new Map(mappings);
    if (printyxField === 'skip') {
      newMappings.delete(csvColumn);
    } else {
      newMappings.set(csvColumn, printyxField);
    }
    setMappings(newMappings);
    setConfidence(calculateMappingConfidence(csvHeaders));
  };

  const handleReset = () => {
    setMappings(new Map());
    setAutoMapped(false);
    setConfidence(0);
  };

  const handleComplete = () => {
    onMappingComplete(mappings);
  };

  const getMappedPrintyxField = (csvColumn: string): string | undefined => {
    return mappings.get(csvColumn);
  };

  const getFieldInfo = (printyxField: string): FieldMapping | undefined => {
    return SALESFORCE_MAPPINGS.find((m) => m.printyxField === printyxField);
  };

  const getConfidenceColor = () => {
    if (confidence >= 80) return 'text-green-600 bg-green-50';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const requiredFieldsMapped = SALESFORCE_MAPPINGS.filter((m) => m.required).every((field) =>
    Array.from(mappings.values()).includes(field.printyxField),
  );

  return (
    <div className="space-y-6">
      {/* Header with Auto-Map & Confidence */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Column Mapping
              </CardTitle>
              <CardDescription>Map your CSV columns to Printyx fields</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Confidence Score */}
              {autoMapped && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getConfidenceColor()}`}
                >
                  <Zap className="h-4 w-4" />
                  <span className="font-semibold">{confidence}% Match</span>
                </div>
              )}

              {/* Auto-Map Button */}
              {!autoMapped && (
                <Button onClick={handleAutoMap} variant="default" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Auto-Detect Fields
                </Button>
              )}

              {/* Reset Button */}
              {autoMapped && (
                <Button onClick={handleReset} variant="outline" size="sm" className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {autoMapped && (
          <CardContent>
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                {confidence >= 80 && (
                  <>
                    <strong>Excellent match!</strong> Automatically mapped {mappings.size} of{' '}
                    {csvHeaders.length} columns.
                  </>
                )}
                {confidence >= 60 && confidence < 80 && (
                  <>
                    <strong>Good match!</strong> Mapped {mappings.size} columns. Review and adjust
                    as needed.
                  </>
                )}
                {confidence < 60 && (
                  <>
                    <strong>Partial match.</strong> Please review and manually map the remaining
                    fields.
                  </>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Mapping Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Field Mappings</CardTitle>
          <CardDescription>
            {mappings.size} of {csvHeaders.length} columns mapped
            {!requiredFieldsMapped && ' • Required fields missing!'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {csvHeaders.map((csvColumn, index) => {
            const mappedField = getMappedPrintyxField(csvColumn);
            const fieldInfo = mappedField ? getFieldInfo(mappedField) : undefined;
            const sampleValue = csvSampleData[0]?.[index];

            return (
              <div
                key={csvColumn}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* CSV Column (Left Side) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{csvColumn}</span>
                    {sampleValue && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Sample: {sampleValue}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {sampleValue && (
                    <p className="text-xs text-gray-500 truncate mt-1">{sampleValue}</p>
                  )}
                </div>

                {/* Arrow Icon */}
                <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />

                {/* Printyx Field Selector (Right Side) */}
                <div className="flex-1 min-w-0">
                  <Select
                    value={mappedField || 'skip'}
                    onValueChange={(value) => handleManualMap(csvColumn, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">
                        <span className="text-gray-500">Skip this column</span>
                      </SelectItem>
                      {printyxFields.map((field) => {
                        const isAlreadyMapped =
                          Array.from(mappings.values()).includes(field.value) &&
                          mappedField !== field.value;

                        return (
                          <SelectItem
                            key={field.value}
                            value={field.value}
                            disabled={isAlreadyMapped}
                          >
                            <div className="flex items-center gap-2">
                              <span>{field.label}</span>
                              {isAlreadyMapped && (
                                <Badge variant="outline" className="text-xs">
                                  Already mapped
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {fieldInfo && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{fieldInfo.description}</p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {mappedField ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Required Fields Warning */}
      {!requiredFieldsMapped && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Required fields missing!</strong> Please map these required fields:
            <ul className="list-disc list-inside mt-2">
              {SALESFORCE_MAPPINGS.filter((m) => m.required).map((field) => {
                const isMapped = Array.from(mappings.values()).includes(field.printyxField);
                return !isMapped ? <li key={field.printyxField}>{field.description}</li> : null;
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {mappings.size} columns mapped • {csvHeaders.length - mappings.size} skipped
        </p>
        <Button
          onClick={handleComplete}
          disabled={!requiredFieldsMapped || mappings.size === 0}
          size="lg"
          className="gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Continue with Mapping
        </Button>
      </div>
    </div>
  );
}
