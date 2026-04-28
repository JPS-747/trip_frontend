import { useState, useRef } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiConfig } from '@/contexts/ApiConfigContext'
import Modal from '@/components/ui/Modal'
import {
    deleteClient,
    getClients,
    importClientsFromApi,
    parseClientImportPayload,
    saveClient,
    updateClientStatus,
} from '@/services/clientService'
import type { ClientRecord } from '@/services/clientService'

type StatusTone = 'default' | 'success' | 'error'

type FormState = {
    client: string
    distanceFromOffice: string
    fullAddress: string
    isDisabled: boolean
    phoneNumber: string
    email: string
    contactPerson: string
    city: string
}

const emptyFormState: FormState = {
    client: '',
    distanceFromOffice: '',
    fullAddress: '',
    isDisabled: false,
    phoneNumber: '',
    email: '',
    contactPerson: '',
    city: '',
}

const ClientSetupPage = () => {
    const queryClient = useQueryClient()
    const { apiBaseUrl } = useApiConfig()
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [status, setStatus] = useState<string>('Ready to import JSON data when you are.')
    const [statusTone, setStatusTone] = useState<StatusTone>('default')
    const [isImporting, setIsImporting] = useState(false)
    const [formState, setFormState] = useState<FormState>(emptyFormState)
    const [editingClientName, setEditingClientName] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [busyDeletingClient, setBusyDeletingClient] = useState<string | null>(null)
    const [busyTogglingClient, setBusyTogglingClient] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [clientsPage, setClientsPage] = useState(1)
    const [clientsSortBy, setClientsSortBy] = useState<string>('client')
    const [clientsSortOrder, setClientsSortOrder] = useState<'asc' | 'desc'>('asc')
    const clientsPageSize = 10

    const {
        data: clientsResponse,
        isLoading: isClientsLoading,
        isError: isClientsError,
        error: clientsError,
        isFetching: isClientsFetching,
    } = useQuery({
        queryKey: ['clients', apiBaseUrl, clientsPage, clientsPageSize, clientsSortBy, clientsSortOrder],
        queryFn: () => getClients(apiBaseUrl, clientsPage, clientsPageSize, clientsSortBy, clientsSortOrder),
    })

    const clients = clientsResponse?.items ?? []
    const totalItems = clientsResponse?.totalItems ?? 0
    const totalPages = clientsResponse?.totalPages ?? 1

    const updateStatus = (message: string, tone: StatusTone = 'default') => {
        setStatus(message)
        setStatusTone(tone)
    }

    const handleSortByColumn = (columnName: string) => {
        // Reset to page 1 when sorting changes
        setClientsPage(1)

        if (clientsSortBy === columnName) {
            // Toggle order if same column clicked
            setClientsSortOrder(clientsSortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            // Set new column, default to ascending
            setClientsSortBy(columnName)
            setClientsSortOrder('asc')
        }
    }

    const getSortIndicator = (columnName: string) => {
        if (clientsSortBy !== columnName) return ''
        return clientsSortOrder === 'asc' ? ' ↑' : ' ↓'
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            setIsImporting(true)
            updateStatus(`Importing “${file.name}”…`)
            const text = await file.text()
            const json = JSON.parse(text)
            const payload = parseClientImportPayload(json)
            if (!payload.length) {
                throw new Error('No clients found in the selected file.')
            }
            const result = await importClientsFromApi(payload, apiBaseUrl)
            updateStatus(result.message ?? `Imported ${payload.length} client(s).`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['clients', apiBaseUrl] })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to import clients.'
            updateStatus(message, 'error')
        } finally {
            setIsImporting(false)
            event.target.value = ''
        }
    }

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = event.target
        setFormState((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))
    }

    const resetForm = () => {
        setFormState(emptyFormState)
        setEditingClientName(null)
    }

    const handleCloseModal = () => {
        resetForm()
        setIsModalOpen(false)
    }

    const handleOpenCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
        updateStatus('Adding a new client.')
        setStatusTone('default')
    }

    const handleEditClient = (clientRecord: ClientRecord) => {
        setFormState({
            client: clientRecord.client,
            distanceFromOffice:
                typeof clientRecord.distanceFromOffice === 'number'
                    ? clientRecord.distanceFromOffice.toString()
                    : '',
            fullAddress: clientRecord.fullAddress ?? '',
            isDisabled: Boolean(clientRecord.isDisabled),
            phoneNumber: clientRecord.phoneNumber ?? '',
            email: clientRecord.email ?? '',
            contactPerson: clientRecord.contactPerson ?? '',
            city: clientRecord.city ?? '',
        })
        setEditingClientName(clientRecord.client)
        updateStatus(`Editing "${clientRecord.client}".`)
        setStatusTone('default')
        setIsModalOpen(true)
    }

    const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const clientName = formState.client.trim()
        const distanceValue = Number.parseFloat(formState.distanceFromOffice)
        const fullAddress = formState.fullAddress.trim()

        if (!clientName || !Number.isFinite(distanceValue)) {
            updateStatus('Please provide client and a valid distance.', 'error')
            return
        }

        try {
            setIsSaving(true)
            updateStatus(`Saving "${clientName}"…`)
            await saveClient(
                {
                    client: clientName,
                    distanceFromOffice: distanceValue,
                    fullAddress: fullAddress || undefined,
                    isDisabled: formState.isDisabled,
                    phoneNumber: formState.phoneNumber || undefined,
                    email: formState.email || undefined,
                    contactPerson: formState.contactPerson || undefined,
                    city: formState.city || undefined,
                },
                apiBaseUrl,
            )
            updateStatus(`Saved “${clientName}”.`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['clients', apiBaseUrl] })
            handleCloseModal()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save client.'
            updateStatus(message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteClient = async (clientRecord: ClientRecord) => {
        const clientName = clientRecord.client
        const shouldDelete = window.confirm(
            `Delete “${clientName}”? This action cannot be undone.`,
        )
        if (!shouldDelete) return

        try {
            setBusyDeletingClient(clientName)
            updateStatus(`Deleting “${clientName}”…`)
            await deleteClient(clientName, apiBaseUrl)
            updateStatus(`Deleted “${clientName}”.`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['clients', apiBaseUrl] })
            if (editingClientName === clientName) {
                handleCloseModal()
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete client.'
            updateStatus(message, 'error')
        } finally {
            setBusyDeletingClient(null)
        }
    }

    const handleToggleClientStatus = async (clientRecord: ClientRecord) => {
        const clientName = clientRecord.client
        const nextDisabledState = !clientRecord.isDisabled
        try {
            setBusyTogglingClient(clientName)
            updateStatus(
                `${nextDisabledState ? 'Disabling' : 'Enabling'} “${clientName}”…`,
            )
            await updateClientStatus(clientName, nextDisabledState, apiBaseUrl)
            updateStatus(
                `${nextDisabledState ? 'Disabled' : 'Enabled'} “${clientName}”.`,
                'success',
            )
            await queryClient.invalidateQueries({ queryKey: ['clients', apiBaseUrl] })
            if (editingClientName === clientName) {
                setFormState((prev) => ({ ...prev, isDisabled: nextDisabledState }))
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to update client status.'
            updateStatus(message, 'error')
        } finally {
            setBusyTogglingClient(null)
        }
    }

    return (
        <div className="page-content">
            <section className="panel">
                <h2>Client actions</h2>
                <p className="subtitle">Add new clients or import existing JSON data.</p>
                <div className="action-row">
                    <button className="button" type="button" onClick={handleOpenCreateModal}>
                        Add client
                    </button>
                    <button
                        className="button secondary"
                        type="button"
                        onClick={handleImportClick}
                        disabled={isImporting}
                    >
                        {isImporting ? 'Importing…' : 'Import JSON'}
                    </button>
                </div>
                <p
                    className="status-text"
                    style={{
                        marginTop: 16,
                        color:
                            statusTone === 'error'
                                ? 'var(--danger)'
                                : statusTone === 'success'
                                    ? 'var(--accent)'
                                    : 'var(--text-muted)',
                    }}
                >
                    {status}
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </section>

            <section className="panel">
                <h2>Clients</h2>
                <p className="subtitle">
                    {isClientsLoading && 'Loading clients from the API…'}
                    {isClientsError && `Failed to load clients: ${(clientsError as Error)?.message ?? 'Unknown error'}`}
                    {!isClientsLoading && !isClientsError && `Showing ${clients.length} of ${totalItems} client(s).`}
                </p>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('client')}>
                                    Client{getSortIndicator('client')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('distanceFromOffice')}>
                                    Distance{getSortIndicator('distanceFromOffice')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('contactPerson')}>
                                    Contact{getSortIndicator('contactPerson')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('email')}>
                                    Email{getSortIndicator('email')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('city')}>
                                    City{getSortIndicator('city')}
                                </th>
                                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortByColumn('isDisabled')}>
                                    Status{getSortIndicator('isDisabled')}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isClientsLoading && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0' }}>
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {isClientsError && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--danger)' }}>
                                        Unable to load clients.
                                    </td>
                                </tr>
                            )}
                            {!isClientsLoading && !isClientsError && clients.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0' }}>
                                        No clients yet. Import or add a record to get started.
                                    </td>
                                </tr>
                            )}
                            {!isClientsLoading && !isClientsError &&
                                clients.map((client) => {
                                    const distanceText =
                                        typeof client.distanceFromOffice === 'number'
                                            ? `${client.distanceFromOffice.toFixed(1)} km`
                                            : '—'
                                    const contactText = client.contactPerson || client.phoneNumber || '—'
                                    return (
                                        <tr key={client.client} style={client.isDisabled ? { opacity: 0.7 } : undefined}>
                                            <td>{client.client}</td>
                                            <td>{distanceText}</td>
                                            <td>{contactText}</td>
                                            <td>{client.email || '—'}</td>
                                            <td>{client.city || '—'}</td>
                                            <td>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        padding: '2px 8px',
                                                        borderRadius: 999,
                                                        background: client.isDisabled
                                                            ? 'var(--danger-muted, rgba(220, 38, 38, 0.12))'
                                                            : 'var(--accent-muted, rgba(34, 197, 94, 0.15))',
                                                        color: client.isDisabled ? 'var(--danger)' : 'var(--accent)',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {client.isDisabled ? 'Disabled' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="action-row" style={{ gap: 8 }}>
                                                <button
                                                    className="button secondary"
                                                    type="button"
                                                    onClick={() => handleEditClient(client)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="button secondary"
                                                    type="button"
                                                    onClick={() => handleDeleteClient(client)}
                                                    disabled={busyDeletingClient === client.client}
                                                >
                                                    {busyDeletingClient === client.client ? 'Deleting…' : 'Delete'}
                                                </button>
                                                <button
                                                    className="button secondary"
                                                    type="button"
                                                    onClick={() => handleToggleClientStatus(client)}
                                                    disabled={busyTogglingClient === client.client}
                                                >
                                                    {busyTogglingClient === client.client
                                                        ? client.isDisabled
                                                            ? 'Enabling…'
                                                            : 'Disabling…'
                                                        : client.isDisabled
                                                            ? 'Enable'
                                                            : 'Disable'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </div>

                {!isClientsLoading && !isClientsError && (
                    <div className="action-row" style={{ justifyContent: 'center', gap: '0.5rem', marginTop: 24, flexWrap: 'wrap' }}>
                        {/* Go to first page button */}
                        <button
                            className="button secondary"
                            type="button"
                            onClick={() => setClientsPage(1)}
                            disabled={clientsPage <= 1 || isClientsFetching}
                            title="Go to first page"
                            style={{ minWidth: '44px' }}
                        >
                            {'⏮'}
                        </button>

                        {/* Jump back 10 pages button */}
                        <button
                            className="button secondary"
                            type="button"
                            onClick={() => setClientsPage(Math.max(1, clientsPage - 10))}
                            disabled={clientsPage <= 1 || isClientsFetching}
                            title="Jump back 10 pages"
                            style={{ minWidth: '44px' }}
                        >
                            {'<<'}
                        </button>

                        {/* Previous page button */}
                        <button
                            className="button secondary"
                            type="button"
                            onClick={() => setClientsPage(Math.max(1, clientsPage - 1))}
                            disabled={clientsPage <= 1 || isClientsFetching}
                            title="Previous page"
                            style={{ minWidth: '44px' }}
                        >
                            {'<'}
                        </button>

                        {/* Page number buttons */}
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {totalPages > 0 && Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                                // Calculate which 10 pages to show (centered around current page)
                                let startPage = Math.max(1, clientsPage - 4)
                                let endPage = Math.min(totalPages, startPage + 9)

                                // Adjust start if we're near the end
                                if (endPage - startPage < 9) {
                                    startPage = Math.max(1, endPage - 9)
                                }

                                return startPage + i
                            }).map((pageNum) => (
                                <button
                                    key={pageNum}
                                    className={pageNum === clientsPage ? 'button' : 'button secondary'}
                                    type="button"
                                    onClick={() => setClientsPage(pageNum)}
                                    disabled={isClientsFetching}
                                    style={{
                                        minWidth: '44px',
                                        fontWeight: pageNum === clientsPage ? 'bold' : 'normal',
                                    }}
                                >
                                    {pageNum}
                                </button>
                            ))}
                        </div>

                        {/* Next page button */}
                        <button
                            className="button secondary"
                            type="button"
                            onClick={() => setClientsPage(Math.min(totalPages, clientsPage + 1))}
                            disabled={clientsPage >= totalPages || isClientsFetching}
                            title="Next page"
                            style={{ minWidth: '44px' }}
                        >
                            {'>'}
                        </button>

                        {/* Jump forward 10 pages button */}
                        <button
                            className="button secondary"
                            type="button"
                            onClick={() => setClientsPage(Math.min(totalPages, clientsPage + 10))}
                            disabled={clientsPage >= totalPages || isClientsFetching}
                            title="Jump forward 10 pages"
                            style={{ minWidth: '44px' }}
                        >
                            {'>>'}
                        </button>

                        {/* Go to last page button */}
                        <button
                            className="button secondary"
                            type="button"
                            onClick={() => setClientsPage(totalPages)}
                            disabled={clientsPage >= totalPages || isClientsFetching}
                            title="Go to last page"
                            style={{ minWidth: '44px' }}
                        >
                            {'⏭'}
                        </button>

                        {/* Page info */}
                        <span style={{ fontSize: 14, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                            Page {clientsPage} of {totalPages}
                        </span>
                    </div>
                )}
            </section>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingClientName ? `Edit ${editingClientName}` : 'Add client'}
            >
                <form className="form-grid" onSubmit={handleFormSubmit}>
                    <label>
                        Client name
                        <input
                            name="client"
                            value={formState.client}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Distance from office (km)
                        <input
                            name="distanceFromOffice"
                            type="number"
                            min={0}
                            step={0.1}
                            value={formState.distanceFromOffice}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Full address
                        <input
                            name="fullAddress"
                            placeholder="Street, suburb, city, province, country"
                            value={formState.fullAddress}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Phone number
                        <input
                            name="phoneNumber"
                            type="tel"
                            placeholder="+27 11 555 1234"
                            value={formState.phoneNumber}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Email
                        <input
                            name="email"
                            type="email"
                            placeholder="contact@company.com"
                            value={formState.email}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        Contact person
                        <input
                            name="contactPerson"
                            placeholder="John Smith"
                            value={formState.contactPerson}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label>
                        City
                        <input
                            name="city"
                            placeholder="Johannesburg"
                            value={formState.city}
                            onChange={handleInputChange}
                        />
                    </label>
                    <label className="checkbox" style={{ alignSelf: 'end' }}>
                        <input
                            type="checkbox"
                            name="isDisabled"
                            checked={formState.isDisabled}
                            onChange={handleInputChange}
                        />{' '}
                        Disabled
                    </label>
                    <div className="action-row" style={{ gridColumn: '1 / -1' }}>
                        <button className="button" type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving…' : editingClientName ? 'Update client' : 'Save client'}
                        </button>
                        <button
                            className="button secondary"
                            type="button"
                            onClick={handleCloseModal}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default ClientSetupPage
