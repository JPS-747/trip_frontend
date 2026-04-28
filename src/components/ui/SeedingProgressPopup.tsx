import { useState, useEffect, useRef, useCallback } from 'react'
import Modal from './Modal'

export interface SeedingProgressMessage {
    type: string
    data: Record<string, unknown>
}

interface SeedingProgressPopupProps {
    isOpen: boolean
    onClose: () => void
    apiBaseUrl: string
}

const SeedingProgressPopup = ({ isOpen, onClose, apiBaseUrl }: SeedingProgressPopupProps) => {
    const [messages, setMessages] = useState<SeedingProgressMessage[]>([])
    const [isConnecting, setIsConnecting] = useState(false)
    const [isError, setIsError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const wsRef = useRef<WebSocket | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const addMessage = useCallback((message: SeedingProgressMessage) => {
        setMessages((prev) => [...prev, message])
    }, [])

    const handleClose = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close()
        }
        setMessages([])
        onClose()
    }, [onClose])

    // Connect to WebSocket
    useEffect(() => {
        if (!isOpen) {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
            return
        }

        setIsConnecting(true)
        setIsError(false)
        setErrorMessage('')
        setMessages([])

        // Small delay to ensure seed request has been sent to backend
        const connectionTimer = setTimeout(() => {
            // Construct WebSocket URL from API base URL
            const wsProtocol = apiBaseUrl.includes('https') ? 'wss' : 'ws'
            // Remove protocol and trailing slashes from apiBaseUrl
            const baseUrl = apiBaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
            const wsUrl = `${wsProtocol}://${baseUrl}/ws/seed-progress`

            console.log('[SeedingProgressPopup] API Base URL:', apiBaseUrl)
            console.log('[SeedingProgressPopup] Connecting to WebSocket:', wsUrl)

            const ws = new WebSocket(wsUrl)

            ws.onopen = () => {
                console.log('[SeedingProgressPopup] WebSocket connected')
                setIsConnecting(false)
                addMessage({
                    type: 'system',
                    data: { message: 'Connected to seeding service' },
                })
            }

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as SeedingProgressMessage
                    console.log('[SeedingProgressPopup] Received message:', message)
                    addMessage(message)

                    // Close popup on completion
                    if (message.type === 'completed') {
                        setTimeout(() => {
                            handleClose()
                        }, 2000)
                    }
                } catch (error) {
                    console.error('[SeedingProgressPopup] Error parsing message:', error)
                    setIsError(true)
                    setErrorMessage('Failed to parse progress message')
                }
            }

            ws.onerror = (event) => {
                console.error('[SeedingProgressPopup] WebSocket error:', event)
                console.error('[SeedingProgressPopup] WebSocket readyState:', ws.readyState)
                console.error('[SeedingProgressPopup] Error details:', {
                    url: wsUrl,
                    apiBaseUrl,
                    event: event instanceof Event ? event.type : event,
                })
                setIsError(true)
                setErrorMessage(`WebSocket connection error. Check console logs. URL: ${wsUrl}`)
                setIsConnecting(false)
            }

            ws.onclose = () => {
                console.log('[SeedingProgressPopup] WebSocket closed')
                setIsConnecting(false)
                wsRef.current = null
            }

            wsRef.current = ws
        }, 500) // 500ms delay to ensure seed request is sent to backend

        return () => {
            clearTimeout(connectionTimer)
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [isOpen, apiBaseUrl, addMessage, handleClose])

    const getMessageDisplay = (message: SeedingProgressMessage): string => {
        const { type, data } = message

        if (type === 'system') {
            return data.message as string
        }

        if (type === 'initialized') {
            return `🚀 Seeding initialized for ${data.startDate} to ${data.endDate}`
        }

        if (type === 'generating_weekday_trips') {
            return `📅 Generating weekday trips: ${data.daysInRange} days, avg ${data.avgTripsPerDay} trips/day`
        }

        if (type === 'weekday_trips_generated') {
            return `✓ Weekday trips generated: ${data.totalTrips} trips`
        }

        if (type === 'generating_saturday_trips') {
            return `📅 Generating Saturday trips: ${data.daysInRange} days, avg ${data.avgTripsPerDay} trips/day`
        }

        if (type === 'saturday_trips_generated') {
            return `✓ Saturday trips generated: ${data.totalTrips} trips`
        }

        if (type === 'generating_sunday_trips') {
            return `📅 Generating Sunday trips: ${data.daysInRange} days, avg ${data.avgTripsPerDay} trips/day`
        }

        if (type === 'sunday_trips_generated') {
            return `✓ Sunday trips generated: ${data.totalTrips} trips`
        }

        if (type === 'generating_holiday_trips') {
            return `🎉 Generating holiday trips: ${data.holidayCount} holidays, avg ${data.avgTripsPerHoliday} trips/holiday`
        }

        if (type === 'holiday_trips_generated') {
            return `✓ Holiday trips generated: ${data.totalTrips} trips`
        }

        if (type === 'adjusting_weekday_distance') {
            return `⚖️ Adjusting weekday distance for ${data.month}: ${data.current}km (target: ${data.target}km)`
        }

        if (type === 'adjusting_saturday_distance') {
            return `⚖️ Adjusting Saturday distance for ${data.month}: ${data.current}km (target: ${data.target}km)`
        }

        if (type === 'adjusting_sunday_distance') {
            return `⚖️ Adjusting Sunday distance for ${data.month}: ${data.current}km (target: ${data.target}km)`
        }

        if (type === 'adjusting_holiday_distance') {
            return `⚖️ Adjusting holiday distance for ${data.month}: ${data.current}km (target: ${data.target}km)`
        }

        if (type === 'applying_odometer_readings') {
            return `⏱️ Applying odometer readings to ${data.totalTrips} trips`
        }

        if (type === 'completed') {
            return `✅ Seeding completed! ${data.totalTrips} trips created successfully`
        }

        return `${type}: ${JSON.stringify(data)}`
    }

    const getMessageStyle = (message: SeedingProgressMessage) => {
        const baseStyle = {
            padding: '0.75rem',
            marginBottom: '0.5rem',
            borderRadius: '0.25rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: '1.5',
        }

        if (message.type === 'completed') {
            return { ...baseStyle, backgroundColor: '#d4edda', color: '#155724', borderLeft: '4px solid #28a745' }
        }

        if (message.type === 'system') {
            return { ...baseStyle, backgroundColor: '#e2e3e5', color: '#383d41', borderLeft: '4px solid #383d41' }
        }

        if (message.type.includes('generated')) {
            return { ...baseStyle, backgroundColor: '#cfe2ff', color: '#084298', borderLeft: '4px solid #0d6efd' }
        }

        if (message.type.includes('adjusting')) {
            return { ...baseStyle, backgroundColor: '#fff3cd', color: '#997404', borderLeft: '4px solid #ffc107' }
        }

        return { ...baseStyle, backgroundColor: '#f8f9fa', color: '#383d41', borderLeft: '4px solid #6c757d' }
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Seeding Progress">
            <div
                style={{
                    display: 'grid',
                    gap: '1rem',
                    maxHeight: '500px',
                    minHeight: '300px',
                    overflow: 'hidden',
                    flexDirection: 'column',
                }}
            >
                {isConnecting && (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Connecting to seeding service...</p>
                        <div
                            style={{
                                display: 'inline-block',
                                width: '30px',
                                height: '30px',
                                border: '3px solid var(--border)',
                                borderTopColor: 'var(--text-primary)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                            }}
                        />
                    </div>
                )}

                {isError && (
                    <div
                        style={{
                            padding: '1rem',
                            backgroundColor: '#f8d7da',
                            color: '#721c24',
                            borderRadius: '0.25rem',
                            border: '1px solid #f5c6cb',
                        }}
                    >
                        <strong>Error:</strong> {errorMessage}
                    </div>
                )}

                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '1rem',
                        borderRadius: '0.25rem',
                        border: '1px solid var(--border)',
                    }}
                >
                    {messages.length === 0 && !isConnecting && (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Waiting for progress updates...</p>
                    )}

                    {messages.map((message, index) => (
                        <div key={index} style={getMessageStyle(message)}>
                            {getMessageDisplay(message)}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="button secondary" onClick={handleClose} disabled={isConnecting}>
                        {isConnecting ? 'Connecting...' : 'Close'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </Modal>
    )
}

export default SeedingProgressPopup
