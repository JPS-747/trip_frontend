export type TripRecord = {
    id: number
    date: string
    client: string
    city: string
    distanceKm: number
    tripType: number
    totalDistanceKm: number
    isPublicHoliday: boolean
    publicHolidayName?: string | null
    isWeekday: boolean
    isSaturday: boolean
    isSunday: boolean
    rateType: string
    ratePerKm: number
    totalAmount: number
    isPrivateTrip?: boolean
    vehicleRegNumber?: string | null
    odometerStart?: number
    odometerEnd?: number
}

export type TripListResponse = {
    items: TripRecord[]
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    totalDistanceKm?: number
}

export type TripQueryState = {
    page: number
    pageSize: number
    client: string
    dayType: string
    sortBy: string
    sortOrder: 'asc' | 'desc'
}

export const defaultTripQueryState: TripQueryState = {
    page: 1,
    pageSize: 10,
    client: '',
    dayType: '',
    sortBy: 'date',
    sortOrder: 'asc',
}

export type TripCreatePayload = {
    date: string
    client?: string
    city: string
    distanceKm: number
    tripType: number
    isPrivateTrip?: boolean
    vehicleRegNumber?: string
}

export type TripUpdatePayload = TripCreatePayload

export type TripActionResponse = {
    message: string
    tripCount: number
}

const handleResponseError = async (response: Response, fallbackMessage: string) => {
    const body = await response.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : fallbackMessage
    throw new Error(detail)
}

export const getTrips = async (
    filters: TripQueryState,
    apiBaseUrl: string,
): Promise<TripListResponse> => {
    const params = new URLSearchParams()
    params.set('page', String(filters.page))
    params.set('pageSize', String(filters.pageSize))
    if (filters.client.trim()) {
        params.set('client', filters.client.trim())
    }
    if (filters.dayType.trim()) {
        params.set('dayType', filters.dayType.trim())
    }
    if (filters.sortBy.trim()) {
        params.set('sortBy', filters.sortBy.trim())
    }
    if (filters.sortOrder.trim()) {
        params.set('sortOrder', filters.sortOrder.trim())
    }

    const query = params.toString()
    const response = await fetch(`${apiBaseUrl}/trips${query ? `?${query}` : ''}`)

    if (!response.ok) {
        await handleResponseError(response, 'Failed to load trips')
    }

    return (await response.json()) as TripListResponse
}

export const createTrip = async (payload: TripCreatePayload, apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        await handleResponseError(response, 'Failed to create trip')
    }

    return (await response.json()) as TripRecord
}

export const updateTrip = async (
    tripId: number,
    payload: TripUpdatePayload,
    apiBaseUrl: string,
) => {
    const response = await fetch(`${apiBaseUrl}/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        await handleResponseError(response, 'Failed to update trip')
    }

    return (await response.json()) as TripRecord
}

export const deleteTrip = async (tripId: number, apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/trips/${tripId}`, {
        method: 'DELETE',
    })

    if (!response.ok) {
        await handleResponseError(response, 'Failed to delete trip')
    }

    return (await response.json()) as { message: string }
}


export const clearTrips = async (
    apiBaseUrl: string,
    startDate?: string,
    endDate?: string,
) => {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    const query = params.toString()
    const url = `${apiBaseUrl}/clear-trips${query ? `?${query}` : ''}`

    const response = await fetch(url, { method: 'POST' })
    if (!response.ok) {
        await handleResponseError(response, 'Failed to clear trips')
    }
    return (await response.json()) as TripActionResponse
}
