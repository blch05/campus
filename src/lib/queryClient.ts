import { QueryClient } from '@tanstack/react-query';
import { GitHubApiError } from './github';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof GitHubApiError && (error.status === 403 || error.status === 404)) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
