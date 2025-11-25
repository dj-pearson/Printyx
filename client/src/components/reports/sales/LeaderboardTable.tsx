import { useMemo, useState } from 'react';
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface LeaderboardEntry {
  userId: string;
  userName: string;
  userInitials: string;
  rank: number;
  metricValue: number;
  metricLabel: string;
  dealsClosed?: number;
  pipelineValue?: number;
  quotaAttainment?: number;
  trend?: 'up' | 'down' | 'stable';
  rankChange?: number;
}

interface LeaderboardTableProps {
  leaderboard: LeaderboardEntry[];
  currentUserId?: string;
  showTrend?: boolean;
}

export default function LeaderboardTable({
  leaderboard,
  currentUserId,
  showTrend = false,
}: LeaderboardTableProps) {
  const [sortBy, setSortBy] = useState<'rank' | 'metricValue' | 'quotaAttainment'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Sort data
  const sortedLeaderboard = useMemo(() => {
    const sorted = [...leaderboard].sort((a, b) => {
      let compareValue = 0;

      switch (sortBy) {
        case 'rank':
          compareValue = a.rank - b.rank;
          break;
        case 'metricValue':
          compareValue = b.metricValue - a.metricValue; // Higher is better
          break;
        case 'quotaAttainment':
          compareValue = (b.quotaAttainment || 0) - (a.quotaAttainment || 0);
          break;
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [leaderboard, sortBy, sortOrder]);

  // Handle sort
  const handleSort = (column: 'rank' | 'metricValue' | 'quotaAttainment') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'rank' ? 'asc' : 'desc');
    }
  };

  // Get rank icon
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  // Get trend icon
  const getTrendIcon = (trend?: 'up' | 'down' | 'stable', rankChange?: number) => {
    if (!trend || !showTrend) return null;

    switch (trend) {
      case 'up':
        return (
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="h-3 w-3" />
            {rankChange && <span className="text-xs">+{rankChange}</span>}
          </div>
        );
      case 'down':
        return (
          <div className="flex items-center gap-1 text-red-600">
            <TrendingDown className="h-3 w-3" />
            {rankChange && <span className="text-xs">-{rankChange}</span>}
          </div>
        );
      case 'stable':
        return (
          <div className="flex items-center gap-1 text-gray-400">
            <Minus className="h-3 w-3" />
          </div>
        );
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  if (leaderboard.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
        <Trophy className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No Leaderboard Data</p>
        <p className="text-sm">Close deals to appear on the leaderboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 3 Podium (optional visual) */}
      {leaderboard.length >= 3 && (
        <div className="flex items-end justify-center gap-4 pb-6 border-b">
          {/* 2nd Place */}
          <div className="flex flex-col items-center">
            <Medal className="h-8 w-8 text-gray-400 mb-2" />
            <Avatar className="h-12 w-12 border-2 border-gray-400">
              <AvatarFallback className="bg-gray-100 text-gray-700">
                {leaderboard[1]?.userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm font-semibold mt-2">{leaderboard[1]?.userName}</div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(leaderboard[1]?.metricValue)}
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center -mt-4">
            <Trophy className="h-10 w-10 text-yellow-500 mb-2" />
            <Avatar className="h-16 w-16 border-4 border-yellow-500">
              <AvatarFallback className="bg-yellow-100 text-yellow-700 text-lg">
                {leaderboard[0]?.userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="text-base font-bold mt-2">{leaderboard[0]?.userName}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(leaderboard[0]?.metricValue)}
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center">
            <Award className="h-8 w-8 text-amber-600 mb-2" />
            <Avatar className="h-12 w-12 border-2 border-amber-600">
              <AvatarFallback className="bg-amber-100 text-amber-700">
                {leaderboard[2]?.userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm font-semibold mt-2">{leaderboard[2]?.userName}</div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(leaderboard[2]?.metricValue)}
            </div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">
                <button
                  onClick={() => handleSort('rank')}
                  className="font-semibold hover:text-foreground"
                >
                  Rank
                </button>
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort('metricValue')}
                  className="font-semibold hover:text-foreground"
                >
                  Revenue
                </button>
              </TableHead>
              <TableHead className="text-right">Deals</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
              {leaderboard.some(e => e.quotaAttainment !== undefined) && (
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('quotaAttainment')}
                    className="font-semibold hover:text-foreground"
                  >
                    Quota
                  </button>
                </TableHead>
              )}
              {showTrend && <TableHead className="text-center w-[80px]">Trend</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeaderboard.map((entry) => {
              const isCurrentUser = entry.userId === currentUserId;

              return (
                <TableRow
                  key={entry.userId}
                  className={isCurrentUser ? 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500' : ''}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getRankIcon(entry.rank)}
                      <span className={entry.rank <= 3 ? 'font-bold text-lg' : ''}>
                        #{entry.rank}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={isCurrentUser ? 'bg-blue-600 text-white' : ''}>
                          {entry.userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className={`font-medium ${isCurrentUser ? 'text-blue-600' : ''}`}>
                          {entry.userName}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(entry.metricValue)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {entry.dealsClosed || 0}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {entry.pipelineValue ? formatCurrency(entry.pipelineValue) : '-'}
                  </TableCell>
                  {leaderboard.some(e => e.quotaAttainment !== undefined) && (
                    <TableCell className="text-right">
                      {entry.quotaAttainment !== undefined ? (
                        <span
                          className={`font-medium ${
                            entry.quotaAttainment >= 100
                              ? 'text-green-600'
                              : entry.quotaAttainment >= 80
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {entry.quotaAttainment.toFixed(0)}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  )}
                  {showTrend && (
                    <TableCell className="text-center">
                      {getTrendIcon(entry.trend, entry.rankChange)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
        <div>
          Showing {sortedLeaderboard.length} {sortedLeaderboard.length === 1 ? 'rep' : 'reps'}
        </div>
        <div>
          Total Revenue: <span className="font-semibold text-foreground">
            {formatCurrency(sortedLeaderboard.reduce((sum, entry) => sum + entry.metricValue, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
