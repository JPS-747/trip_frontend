import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'

const STORAGE_KEY = 'trippen:api-base-url'
const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

type ApiConfigValue = {
    apiBaseUrl: string
    setApiBaseUrl: (next: string) => void
}

const ApiConfigContext = createContext<ApiConfigValue | undefined>(undefined)

const readInitialValue = () => {
    if (typeof window === 'undefined') return DEFAULT_API_BASE_URL
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_API_BASE_URL
}

export const ApiConfigProvider = ({ children }: PropsWithChildren) => {
    const [apiBaseUrl, setApiBaseUrl] = useState(() => readInitialValue())

    const updateBaseUrl = (next: string) => {
        const normalized = next.trim() || DEFAULT_API_BASE_URL
        setApiBaseUrl(normalized)
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, normalized)
        }
    }

    const value = useMemo<ApiConfigValue>(
        () => ({
            apiBaseUrl,
            setApiBaseUrl: updateBaseUrl,
        }),
        [apiBaseUrl],
    )

    return <ApiConfigContext.Provider value={value}>{children}</ApiConfigContext.Provider>
}

export const useApiConfig = () => {
    const ctx = useContext(ApiConfigContext)
    if (!ctx) {
        throw new Error('useApiConfig must be used within an ApiConfigProvider')
    }
    return ctx
}
