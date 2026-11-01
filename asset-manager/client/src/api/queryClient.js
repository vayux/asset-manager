import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = (options = {}) => new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000, refetchOnWindowFocus: false, retry: 1, ...options },
  },
});
