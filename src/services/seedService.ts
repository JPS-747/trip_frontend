export type SeedRequest = {
    startDate: string | null
    endDate: string | null
    weekdayMinTripsPerDay: number
    weekdayMaxTripsPerDay: number
    weekdayAvgDistancePerMonth: number | null
    saturdayMinTripsPerDay: number
    saturdayMaxTripsPerDay: number
    saturdayAvgDistancePerMonth: number | null
    sundayMinTripsPerDay: number
    sundayMaxTripsPerDay: number
    sundayAvgDistancePerMonth: number | null
    holidayMinTripsPerDay: number
    holidayMaxTripsPerDay: number
    holidayAvgDistancePerMonth: number | null
    useSeasonalMultiplier: boolean
    seasonalPeakMonth: number
    seasonalSpread: number
    selectedVehicles?: string[] | null
}

export type SeedResponse = {
    message: string
    tripCount: number
}

export const seedSampleData = async (
    payload: SeedRequest,
    apiBaseUrl: string,
): Promise<SeedResponse> => {
    const response = await fetch(`${apiBaseUrl}/seed-sample-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const detail = typeof body.detail === 'string' ? body.detail : 'Failed to seed data'
        throw new Error(detail)
    }

    return response.json() as Promise<SeedResponse>
}
