import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiConfig } from '@/contexts/ApiConfigContext'
import Modal from '@/components/ui/Modal'
import {
    deleteHoliday,
    getHolidays,
    importHolidaysFromApi,
    parseHolidayImportPayload,
    saveHoliday,
} from '@/services/holidayService'
import type { HolidayRecord } from '@/services/holidayService'

type StatusTone = 'default' | 'success' | 'error'

type FormState = {
    date: string
    name: string
    country: string
    year: string
}

const emptyFormState: FormState = {
    date: '',
    name: '',
    country: 'South Africa',
    year: '',
}

const HolidaySetupPage = () => {
    const queryClient = useQueryClient()
    const { apiBaseUrl } = useApiConfig()
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [formState, setFormState] = useState<FormState>(emptyFormState)
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [status, setStatus] = useState('Ready to manage holidays.')
    const [statusTone, setStatusTone] = useState<StatusTone>('default')
    const [isSaving, setIsSaving] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [busyDeleteKey, setBusyDeleteKey] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const {
        data: holidaysData,
        isLoading: isHolidaysLoading,
        isError: isHolidaysError,
        error: holidaysError,
    } = useQuery({
        queryKey: ['holidays', apiBaseUrl],
        queryFn: () => getHolidays(apiBaseUrl),
    })

    const holidays = holidaysData?.holidays ?? []

    const updateStatus = (message: string, tone: StatusTone = 'default') => {
        setStatus(message)
        setStatusTone(tone)
    }

    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target
        setFormState((prev) => ({ ...prev, [name]: value }))
    }

    const resetForm = () => {
        setFormState((prev) => ({ ...emptyFormState, country: prev.country || emptyFormState.country }))
        setEditingKey(null)
    }

    const handleCloseModal = () => {
        resetForm()
        setIsModalOpen(false)
    }

    const handleOpenCreateModal = () => {
        resetForm()
        setIsModalOpen(true)
        updateStatus('Adding a new holiday.')
        setStatusTone('default')
    }

    const handleEditHoliday = (holiday: HolidayRecord) => {
        setFormState({
            date: holiday.date,
            name: holiday.name,
            country: holiday.country || formState.country || 'South Africa',
            year: holiday.year ? String(holiday.year) : '',
        })
        setEditingKey(`${holiday.date}::${holiday.name}`)
        updateStatus(`Editing “${holiday.name}” on ${holiday.date}.`)
        setStatusTone('default')
        setIsModalOpen(true)
    }

    const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!formState.date || !formState.name) {
            updateStatus('Date and name are required.', 'error')
            return
        }

        const parsedYear = formState.year.trim()
        const numericYear = parsedYear ? Number.parseInt(parsedYear, 10) : undefined

        if (parsedYear && !Number.isFinite(numericYear)) {
            updateStatus('Year must be a valid number.', 'error')
            return
        }

        try {
            setIsSaving(true)
            updateStatus(`Saving “${formState.name}”…`)
            await saveHoliday(
                {
                    date: formState.date,
                    name: formState.name,
                    country: formState.country,
                    year: numericYear ?? undefined,
                },
                apiBaseUrl,
            )
            updateStatus(`Saved “${formState.name}”.`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['holidays', apiBaseUrl] })
            handleCloseModal()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save holiday.'
            updateStatus(message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteHoliday = async (holiday: HolidayRecord) => {
        const key = `${holiday.date}::${holiday.name}`
        const confirmed = window.confirm(
            `Delete “${holiday.name}” on ${holiday.date}? This cannot be undone.`,
        )
        if (!confirmed) return

        try {
            setBusyDeleteKey(key)
            updateStatus(`Deleting “${holiday.name}”…`)
            await deleteHoliday(holiday.date, holiday.name, apiBaseUrl)
            updateStatus(`Deleted “${holiday.name}”.`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['holidays', apiBaseUrl] })
            if (editingKey === key) {
                handleCloseModal()
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete holiday.'
            updateStatus(message, 'error')
        } finally {
            setBusyDeleteKey(null)
        }
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
            const records = parseHolidayImportPayload(json)
            if (!records.length) {
                throw new Error('No holidays found in the selected file.')
            }
            await importHolidaysFromApi(records, apiBaseUrl)
            updateStatus(`Imported ${records.length} holiday(s).`, 'success')
            await queryClient.invalidateQueries({ queryKey: ['holidays', apiBaseUrl] })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to import holidays.'
            updateStatus(message, 'error')
        } finally {
            setIsImporting(false)
            event.target.value = ''
        }
    }

    return (
        <div className="page-content">
            <section className="panel">
                <h2>Holiday actions</h2>
                <p className="subtitle">Manage the public-holiday store directly via the API.</p>
                <div className="action-row" style={{ gap: 12 }}>
                    <button className="button" type="button" onClick={handleOpenCreateModal}>
                        Add holiday
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
                <h2>Public holidays</h2>
                <p className="subtitle">
                    {isHolidaysLoading && 'Loading holidays from the API…'}
                    {isHolidaysError && `Failed to load holidays: ${(holidaysError as Error)?.message ?? 'Unknown error'}`}
                    {!isHolidaysLoading && !isHolidaysError &&
                        `Showing ${holidays.length} holiday(s). Country: ${holidaysData?.country ?? '—'}`}
                </p>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Name</th>
                                <th>Country</th>
                                <th>Year</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isHolidaysLoading && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0' }}>
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {isHolidaysError && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--danger)' }}>
                                        Unable to load holidays.
                                    </td>
                                </tr>
                            )}
                            {!isHolidaysLoading && !isHolidaysError && holidays.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0' }}>
                                        No public holidays yet. Add or import a few to get started.
                                    </td>
                                </tr>
                            )}
                            {!isHolidaysLoading && !isHolidaysError &&
                                holidays.map((holiday) => {
                                    const key = `${holiday.date}::${holiday.name}`
                                    return (
                                        <tr key={key}>
                                            <td>{holiday.date}</td>
                                            <td>{holiday.name}</td>
                                            <td>{holiday.country || holidaysData?.country || '—'}</td>
                                            <td>{holiday.year ?? holidaysData?.year ?? '—'}</td>
                                            <td className="action-row" style={{ gap: 8 }}>
                                                <button
                                                    className="button secondary"
                                                    type="button"
                                                    onClick={() => handleEditHoliday(holiday)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="button secondary"
                                                    type="button"
                                                    onClick={() => handleDeleteHoliday(holiday)}
                                                    disabled={busyDeleteKey === key}
                                                >
                                                    {busyDeleteKey === key ? 'Deleting…' : 'Delete'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                        </tbody>
                    </table>
                </div>
            </section>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingKey ? 'Edit holiday' : 'Add holiday'}
            >
                <form className="form-grid" onSubmit={handleFormSubmit}>
                    <label>
                        Date
                        <input
                            type="date"
                            name="date"
                            value={formState.date}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Holiday name
                        <input
                            name="name"
                            placeholder="e.g. Human Rights Day"
                            value={formState.name}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Country
                        <input
                            name="country"
                            value={formState.country}
                            onChange={handleInputChange}
                            required
                        />
                    </label>
                    <label>
                        Year
                        <input
                            name="year"
                            type="number"
                            min={1900}
                            max={2100}
                            value={formState.year}
                            onChange={handleInputChange}
                            placeholder="Optional"
                        />
                    </label>
                    <div className="action-row" style={{ gridColumn: '1 / -1', gap: 12 }}>
                        <button className="button" type="submit" disabled={isSaving}>
                            {isSaving ? 'Saving…' : editingKey ? 'Update holiday' : 'Save holiday'}
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

export default HolidaySetupPage
