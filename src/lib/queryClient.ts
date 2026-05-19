import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 6_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
