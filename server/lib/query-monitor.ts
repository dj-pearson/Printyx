import { createModuleLogger } from './logger';

const log = createModuleLogger('query-monitor');

let queryCountPerRequest = 0;
const QUERY_THRESHOLD = 10;

export function resetQueryCount(): void {
  queryCountPerRequest = 0;
}

export function incrementQueryCount(queryInfo?: string): void {
  queryCountPerRequest++;
  if (process.env.NODE_ENV === 'development' && queryCountPerRequest > QUERY_THRESHOLD) {
    log.warn(
      `[N+1 Warning] ${queryCountPerRequest} queries in current request. Last query: ${queryInfo || 'unknown'}`,
    );
  }
}

export function getQueryCount(): number {
  return queryCountPerRequest;
}
