import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TeamMember {
  userId: string;
  userName: string;
  pipelineValue: number;
  dealsInProgress: number;
  winRate: number;
  averageDealSize: number;
  activitiesThisWeek: number;
  quotaAttainment: number;
}

interface TeamPerformanceTableProps {
  comparison: TeamMember[];
  summary?: any;
}

export default function TeamPerformanceTable({ comparison, summary }: TeamPerformanceTableProps) {
  const [sortBy, setSortBy] = useState<keyof TeamMember>('pipelineValue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedData = useMemo(() => {
    return [...comparison].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [comparison, sortBy, sortOrder]);

  const handleSort = (key: keyof TeamMember) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (comparison.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No team data available</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rep Name</TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('pipelineValue')}>
                Pipeline Value {sortBy === 'pipelineValue' && (sortOrder === 'desc' ? '↓' : '↑')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('dealsInProgress')}>
                Active Deals {sortBy === 'dealsInProgress' && (sortOrder === 'desc' ? '↓' : '↑')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('winRate')}>
                Win Rate {sortBy === 'winRate' && (sortOrder === 'desc' ? '↓' : '↑')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('averageDealSize')}>
                Avg Deal {sortBy === 'averageDealSize' && (sortOrder === 'desc' ? '↓' : '↑')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('activitiesThisWeek')}>
                Activities {sortBy === 'activitiesThisWeek' && (sortOrder === 'desc' ? '↓' : '↑')}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('quotaAttainment')}>
                Quota {sortBy === 'quotaAttainment' && (sortOrder === 'desc' ? '↓' : '↑')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((member) => (
              <TableRow key={member.userId}>
                <TableCell className="font-medium">{member.userName}</TableCell>
                <TableCell>{formatCurrency(member.pipelineValue)}</TableCell>
                <TableCell>{member.dealsInProgress}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span>{member.winRate.toFixed(0)}%</span>
                    {member.winRate >= 50 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(member.averageDealSize)}</TableCell>
                <TableCell>{member.activitiesThisWeek}</TableCell>
                <TableCell>
                  <Badge variant={member.quotaAttainment >= 100 ? 'success' : member.quotaAttainment >= 80 ? 'default' : 'destructive' as any}>
                    {member.quotaAttainment.toFixed(0)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {summary && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Pipeline</div>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalPipeline || 0)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Total Deals</div>
            <div className="text-2xl font-bold">{summary.totalDeals || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Avg Quota</div>
            <div className="text-2xl font-bold">{(summary.avgQuota || 0).toFixed(0)}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
