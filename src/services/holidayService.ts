export type HolidayRecord = {
    date: string
    name: string
    country?: string
    year?: number | null
}

export type HolidayCollection = {
    country?: string
    year?: number | null
    holidays: HolidayRecord[]
}

export type HolidayImportRecord = {
    date: string
    name: string
    country?: string
    year?: number | null
}

const coerceArray = (input: unknown): unknown[] => {
    if (Array.isArray(input)) return input
    if (input && typeof input === 'object') {
        const maybeHolidays = (input as Record<string, unknown>).holidays
        if (Array.isArray(maybeHolidays)) return maybeHolidays
        return [input]
    }
    return []
}

const sanitizeRecord = (record: unknown): HolidayImportRecord | null => {
    if (!record || typeof record !== 'object') return null
    const asDict = record as Record<string, unknown>
    const date = typeof asDict.date === 'string' ? asDict.date.trim() : ''
    const name = typeof asDict.name === 'string' ? asDict.name.trim() : ''
    if (!date || !name) return null

    const countryRaw = asDict.country
    const yearRaw = asDict.year
    const year = typeof yearRaw === 'number' && Number.isFinite(yearRaw) ? yearRaw : null

    return {
        date,
        name,
        country: typeof countryRaw === 'string' && countryRaw.trim().length > 0 ? countryRaw.trim() : undefined,
        year,
    }
}

export const parseHolidayImportPayload = (data: unknown): HolidayImportRecord[] =>
    coerceArray(data)
        .map(sanitizeRecord)
        .filter((record): record is HolidayImportRecord => Boolean(record))

const handleResponseError = async (response: Response, fallbackMessage: string) => {
    const body = await response.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : fallbackMessage
    throw new Error(detail)
}

export const getHolidays = async (apiBaseUrl: string): Promise<HolidayCollection> => {
    const response = await fetch(`${apiBaseUrl}/holidays`)
    if (!response.ok) {
        throw new Error('Failed to load holidays')
    }

    const data = (await response.json()) as {
        country?: string
        year?: number
        holidays?: { date: string; name: string }[]
    }

    const holidays: HolidayRecord[] = Array.isArray(data.holidays)
        ? data.holidays.map((holiday) => ({
            date: holiday.date,
            name: holiday.name,
            country: data.country,
            year: data.year,
        }))
        : []

    return {
        country: data.country,
        year: data.year,
        holidays,
    }
}

export const saveHoliday = async (payload: HolidayRecord, apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        await handleResponseError(response, 'Failed to save holiday')
    }

    return (await response.json()) as HolidayCollection
}

export const deleteHoliday = async (date: string, name: string, apiBaseUrl: string) => {
    const params = new URLSearchParams({ date, name })
    const response = await fetch(`${apiBaseUrl}/holidays?${params.toString()}`, {
        method: 'DELETE',
    })

    if (!response.ok) {
        await handleResponseError(response, 'Failed to delete holiday')
    }

    return (await response.json()) as { message: string }
}

export const importHolidaysFromApi = async (
    holidays: HolidayImportRecord[],
    apiBaseUrl: string,
) => {
    const response = await fetch(`${apiBaseUrl}/holidays/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holidays),
    })

    if (!response.ok) {
        await handleResponseError(response, 'Failed to import holidays')
    }

    return (await response.json()) as { message: string }
}

export const clearHolidays = async (apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/clear-holidays`, { method: 'POST' })
    if (!response.ok) {
        await handleResponseError(response, 'Failed to clear holidays')
    }
    return (await response.json()) as { message: string; holidayCount: number }
}
