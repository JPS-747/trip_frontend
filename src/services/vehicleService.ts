export type VehicleRecord = {
    regNumber: string
    make: string
    model: string
    year?: number | null
    kmPerLiter: number
    currentOdometer?: number | null
    ratePerKm?: number | null
    isDisabled?: boolean
}

export type VehicleUpsertPayload = {
    regNumber: string
    make: string
    model: string
    year?: number | null
    kmPerLiter: number
    currentOdometer?: number | null
    ratePerKm?: number | null
    isDisabled?: boolean
}

const handleResponseError = async (response: Response, fallbackMessage: string) => {
    const body = await response.json().catch(() => ({}))
    const detail = typeof body.detail === 'string' ? body.detail : fallbackMessage
    throw new Error(detail)
}

export const getVehicles = async (apiBaseUrl: string): Promise<VehicleRecord[]> => {
    const response = await fetch(`${apiBaseUrl}/vehicles`)

    if (!response.ok) {
        await handleResponseError(response, 'Failed to load vehicles')
    }

    return (await response.json()) as VehicleRecord[]
}

export const saveVehicle = async (payload: VehicleUpsertPayload, apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || 'Failed to save vehicle')
    }

    return (await response.json()) as VehicleRecord[]
}

export const deleteVehicle = async (regNumber: string, apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/vehicles/${encodeURIComponent(regNumber)}`, {
        method: 'DELETE',
    })
    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || 'Failed to delete vehicle')
    }
    return response.json() as Promise<{ message: string }>
}

export const updateVehicleStatus = async (
    regNumber: string,
    isDisabled: boolean,
    apiBaseUrl: string,
) => {
    const response = await fetch(`${apiBaseUrl}/vehicles/${encodeURIComponent(regNumber)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDisabled }),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || 'Failed to update vehicle status')
    }

    return response.json() as Promise<{ regNumber: string; isDisabled: boolean }>
}
