import locks, { convertItemToLock } from '../locks'

describe('lock reducers', () => {
    let initialState

    const lockTypes = {
        events: {
            event: {
                _id: 'e1',
                lock_action: 'edit',
                lock_session: 'sess123',
                lock_user: 'user123',
                lock_time: '2099-10-15T14:30+0000',
            },
            recurring: {
                _id: 'e2',
                recurrence_id: 'r1',
                lock_action: 'postpone',
                lock_session: 'sess123',
                lock_user: 'user123',
                lock_time: '2099-10-15T14:39+0000',
            },
        },
        planning: {
            planning: {
                _id: 'p1',
                lock_action: 'update_time',
                lock_session: 'sess123',
                lock_user: 'user123',
                lock_time: '2099-10-15T14:33+0000',
            },
            event: {
                _id: 'p2',
                event_item: 'e3',
                lock_action: 'reschedule',
                lock_session: 'sess123',
                lock_user: 'user123',
                lock_time: '2099-10-15T14:35+0000',
            },
            recurring: {
                _id: 'p3',
                event_item: 'e7',
                recurrence_id: 'r2',
                lock_action: 'edit',
                lock_session: 'sess123',
                lock_user: 'user123',
                lock_time: '2099-10-15T14:37+0000',
            },
        },
        assignment: {
            _id: 'a1',
            lock_action: 'edit',
            lock_session: 'sess123',
            lock_user: 'user123',
            lock_time: '2099-10-15T14:30+0000',
        },
    }

    const lockItems = {
        events: {
            e1: convertItemToLock(lockTypes.events.event, 'events'),
            e3: convertItemToLock(lockTypes.planning.event, 'planning'),
        },
        planning: { p1: convertItemToLock(lockTypes.planning.planning, 'planning') },
        recurring: {
            r1: convertItemToLock(lockTypes.events.recurring, 'events'),
            r2: convertItemToLock(lockTypes.planning.recurring, 'planning'),
        },
        assignments: { a1: convertItemToLock(lockTypes.assignment, 'assignments') },
    }

    const initialLocks = {
        events: [
            lockTypes.events.event,
            lockTypes.events.recurring,
        ],
        plans: [
            lockTypes.planning.planning,
            lockTypes.planning.event,
            lockTypes.planning.recurring,
        ],
        assignments: [lockTypes.assignment],
    }

    const getInitialLocks = () => (locks(
        initialState,
        {
            type: 'RECEIVE_LOCKS',
            payload: initialLocks,
        }
    ))

    beforeEach(() => {
        initialState = locks(undefined, { type: null })
    })

    it('initialState', () => {
        expect(initialState).toEqual({
            events: {},
            planning: {},
            recurring: {},
            assignments: {},
        })
    })

    it('RESET_STORE and INIT_STORE', () => {
        let result = locks(
            initialState,
            { type: 'RESET_STORE' }
        )
        expect(result).toBe(null)

        result = locks(
            null,
            { type: 'INIT_STORE' }
        )
        expect(result).toEqual(initialState)
    })

    it('convertItemToLock', () => {
        expect(convertItemToLock(lockTypes.events.event, 'events')).toEqual({
            action: 'edit',
            session: 'sess123',
            time: '2099-10-15T14:30+0000',
            user: 'user123',
            item_type: 'events',
            item_id: 'e1',
        })
    })

    it('LOCKS.ACTIONS.RECEIVE', () => {
        const result = getInitialLocks()
        expect(result).toEqual(lockItems)
    })

    it('LOCK_PLANNING', () => {
        // Planning item with direct Planning lock
        let result = locks(
            initialState,
            {
                type: 'LOCK_PLANNING',
                payload: { plan: lockTypes.planning.planning },
            }
        )
        expect(result).toEqual({
            events: {},
            planning: { p1: lockItems.planning.p1 },
            recurring: {},
            assignments: {},
        })

        // Planning item with associated Event lock
        result = locks(
            initialState,
            {
                type: 'LOCK_PLANNING',
                payload: { plan: lockTypes.planning.event },
            }
        )
        expect(result).toEqual({
            events: { e3: lockItems.events.e3 },
            planning: {},
            recurring: {},
            assignments: {},
        })

        // Planning item with associated series of Recurring Events lock
        result = locks(
            initialState,
            {
                type: 'LOCK_PLANNING',
                payload: { plan: lockTypes.planning.recurring },
            }
        )
        expect(result).toEqual({
            events: {},
            planning: {},
            recurring: { r2: lockItems.recurring.r2 },
            assignments: {},
        })
    })

    it('UNLOCK_PLANNING', () => {
        // Planning item with direct Planning lock
        let result = locks(
            getInitialLocks(),
            {
                type: 'UNLOCK_PLANNING',
                payload: { plan: lockTypes.planning.planning },
            }
        )
        expect(result).toEqual({
            events: lockItems.events,
            planning: {},
            recurring: lockItems.recurring,
            assignments: lockItems.assignments,
        })

        // Planning item with associated Event lock
        result = locks(
            getInitialLocks(),
            {
                type: 'UNLOCK_PLANNING',
                payload: { plan: lockTypes.planning.event },
            }
        )
        expect(result).toEqual({
            events: { e1: lockItems.events.e1 },
            planning: lockItems.planning,
            recurring: lockItems.recurring,
            assignments: lockItems.assignments,
        })

        // Planning item with associated series of Recurring Events lock
        result = locks(
            getInitialLocks(),
            {
                type: 'UNLOCK_PLANNING',
                payload: { plan: lockTypes.planning.recurring },
            }
        )
        expect(result).toEqual({
            events: lockItems.events,
            planning: lockItems.planning,
            recurring: { r1: lockItems.recurring.r1 },
            assignments: lockItems.assignments,
        })
    })

    it('LOCK_EVENT', () => {
        // Event item with direct Event lock
        let result = locks(
            initialState,
            {
                type: 'LOCK_EVENT',
                payload: { event: lockTypes.events.event },
            }
        )
        expect(result).toEqual({
            events: { e1: lockItems.events.e1 },
            planning: {},
            recurring: {},
            assignments: {},
        })

        // Event item with series of Recurring Event lock
        result = locks(
            initialState,
            {
                type: 'LOCK_EVENT',
                payload: { event: lockTypes.events.recurring },
            }
        )
        expect(result).toEqual({
            events: {},
            planning: {},
            recurring: { r1: lockItems.recurring.r1 },
            assignments: {},
        })
    })

    it('UNLOCK_EVENT', () => {
        // Event item with direct Event lock
        let result = locks(
            getInitialLocks(),
            {
                type: 'UNLOCK_EVENT',
                payload: { event: lockTypes.events.event },
            }
        )
        expect(result).toEqual({
            events: { e3: lockItems.events.e3 },
            planning: lockItems.planning,
            recurring: lockItems.recurring,
            assignments: lockItems.assignments,
        })

        // Event item with series of Recurring Events lock
        result = locks(
            getInitialLocks(),
            {
                type: 'UNLOCK_EVENT',
                payload: { event: lockTypes.events.recurring },
            }
        )
        expect(result).toEqual({
            events: lockItems.events,
            planning: lockItems.planning,
            recurring: { r2: lockItems.recurring.r2 },
            assignments: lockItems.assignments,
        })
    })

    it('MARK_EVENT_CANCELLED', () => {
        // Event item with direct Event lock
        let result = locks(
            getInitialLocks(),
            {
                type: 'MARK_EVENT_CANCELLED',
                payload: { event: lockTypes.events.event },
            }
        )
        expect(result).toEqual({
            events: { e3: lockItems.events.e3 },
            planning: lockItems.planning,
            recurring: lockItems.recurring,
            assignments: lockItems.assignments,
        })

        // Event item with series of Recurring Events lock
        result = locks(
            getInitialLocks(),
            {
                type: 'MARK_EVENT_CANCELLED',
                payload: { event: lockTypes.events.recurring },
            }
        )
        expect(result).toEqual({
            events: lockItems.events,
            planning: lockItems.planning,
            recurring: { r2: lockItems.recurring.r2 },
            assignments: lockItems.assignments,
        })
    })

    it('MARK_EVENT_POSTPONED', () => {
        // Event item with direct Event lock
        let result = locks(
            getInitialLocks(),
            {
                type: 'MARK_EVENT_POSTPONED',
                payload: { event: lockTypes.events.event },
            }
        )
        expect(result).toEqual({
            events: { e3: lockItems.events.e3 },
            planning: lockItems.planning,
            recurring: lockItems.recurring,
            assignments: lockItems.assignments,
        })

        // Event item with series of Recurring Events lock
        result = locks(
            getInitialLocks(),
            {
                type: 'MARK_EVENT_POSTPONED',
                payload: { event: lockTypes.events.recurring },
            }
        )
        expect(result).toEqual({
            events: lockItems.events,
            planning: lockItems.planning,
            recurring: { r2: lockItems.recurring.r2 },
            assignments: lockItems.assignments,
        })
    })

    it('LOCK_ASSIGNMENT', () => {
        // Planning item with direct Planning lock
        let result = locks(
            initialState,
            {
                type: 'LOCK_ASSIGNMENT',
                payload: { assignment: lockTypes.assignment },
            }
        )
        expect(result).toEqual({
            events: {},
            planning: {},
            recurring: {},
            assignments: { a1: lockItems.assignments.a1 },
        })
    })

    it('UNLOCK_ASSIGNMENT', () => {
        // Planning item with direct Planning lock
        let result = locks(
            initialState,
            {
                type: 'UNLOCK_ASSIGNMENT',
                payload: { assignment: lockTypes.assignment },
            }
        )
        expect(result).toEqual({
            events: {},
            planning: {},
            recurring: {},
            assignments: {},
        })
    })
})
