export type ClientRecord = {
    client: string
    distanceFromOffice: number
    fullAddress?: string | null
    isDisabled?: boolean
    phoneNumber?: string | null
    email?: string | null
    contactPerson?: string | null
    city?: string | null
}

export type ClientListResponse = {
    items: ClientRecord[]
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
}

export type ClientUpsertPayload = {
    client: string
    distanceFromOffice: number
    fullAddress?: string | null
    isDisabled?: boolean
    phoneNumber?: string | null
    email?: string | null
    contactPerson?: string | null
    city?: string | null
}

export type ClientImportRecord = {
    client: string
    distanceFromOffice?: number
    fullAddress?: string | null
    phoneNumber?: string | null
    email?: string | null
    contactPerson?: string | null
    city?: string | null
}

const coerceArray = (data: unknown): unknown[] => {
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object') {
        const maybeClients = (data as Record<string, unknown>).clients
        if (Array.isArray(maybeClients)) return maybeClients
        return [data]
    }
    return []
}

const sanitizeRecord = (record: unknown): ClientImportRecord | null => {
    if (!record || typeof record !== 'object') return null
    const asDict = record as Record<string, unknown>
    const client = String(asDict.client ?? '').trim()
    if (!client) return null
    const distanceValue = Number(asDict.distanceFromOffice ?? 0)
    const fullAddressRaw = asDict.fullAddress
    const phoneNumberRaw = asDict.phoneNumber
    const emailRaw = asDict.email
    const contactPersonRaw = asDict.contactPerson
    const cityRaw = asDict.city

    return {
        client,
        distanceFromOffice: Number.isFinite(distanceValue) ? distanceValue : 0,
        fullAddress:
            typeof fullAddressRaw === 'string' && fullAddressRaw.trim().length > 0
                ? fullAddressRaw.trim()
                : null,
        phoneNumber:
            typeof phoneNumberRaw === 'string' && phoneNumberRaw.trim().length > 0
                ? phoneNumberRaw.trim()
                : null,
        email:
            typeof emailRaw === 'string' && emailRaw.trim().length > 0
                ? emailRaw.trim()
                : null,
        contactPerson:
            typeof contactPersonRaw === 'string' && contactPersonRaw.trim().length > 0
                ? contactPersonRaw.trim()
                : null,
        city:
            typeof cityRaw === 'string' && cityRaw.trim().length > 0
                ? cityRaw.trim()
                : null,
    }
}

export const parseClientImportPayload = (data: unknown): ClientImportRecord[] =>
    coerceArray(data)
        .map(sanitizeRecord)
        .filter((record): record is ClientImportRecord => Boolean(record))

export const importClientsFromApi = async (
    records: ClientImportRecord[],
    apiBaseUrl: string,
) => {
    const response = await fetch(`${apiBaseUrl}/clients/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const detail = typeof body.detail === 'string' ? body.detail : 'Import failed'
        throw new Error(detail)
    }

    return response.json() as Promise<{ message: string }>
}

export const getClients = async (apiBaseUrl: string, page: number = 1, pageSize: number = 10, sortBy: string = 'client', sortOrder: string = 'asc') => {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
    })
    const response = await fetch(`${apiBaseUrl}/clients?${params}`)
    if (!response.ok) {
        throw new Error('Failed to load clients')
    }
    return (await response.json()) as ClientListResponse
}

export const saveClient = async (payload: ClientUpsertPayload, apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || 'Failed to save client')
    }

    return (await response.json()) as ClientRecord[]
}

export const deleteClient = async (clientName: string, apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/clients/${encodeURIComponent(clientName)}`, {
        method: 'DELETE',
    })
    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || 'Failed to delete client')
    }
    return response.json() as Promise<{ message: string }>
}

export const updateClientStatus = async (
    clientName: string,
    isDisabled: boolean,
    apiBaseUrl: string,
) => {
    const response = await fetch(`${apiBaseUrl}/clients/${encodeURIComponent(clientName)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDisabled }),
    })

    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || 'Failed to update client status')
    }

    return response.json() as Promise<{ client: string; isDisabled: boolean }>
}

export const clearClients = async (apiBaseUrl: string) => {
    const response = await fetch(`${apiBaseUrl}/clear-clients`, { method: 'POST' })
    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const detail = typeof body.detail === 'string' ? body.detail : 'Failed to clear clients'
        throw new Error(detail)
    }
    return (await response.json()) as { message: string; clientCount: number }
}
