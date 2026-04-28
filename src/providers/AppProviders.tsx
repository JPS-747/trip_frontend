import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiConfigProvider } from '@/contexts/ApiConfigContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            retry: 1,
        },
    },
})

export const AppProviders = ({ children }: PropsWithChildren) => (
    <ThemeProvider>
        <QueryClientProvider client={queryClient}>
            <ApiConfigProvider>{children}</ApiConfigProvider>
        </QueryClientProvider>
    </ThemeProvider>
)
