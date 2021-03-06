import sinon from 'sinon'
import * as actions from '../../actions'
import { EVENTS } from '../../constants'
import { createTestStore, registerNotifications } from '../../utils'
import { range, cloneDeep } from 'lodash'
import * as selectors from '../../selectors'
import moment from 'moment'
import { restoreSinonStub } from '../../utils/testUtils'

import eventsUi from '../events/ui'

describe('events', () => {
    describe('actions', () => {
        let events = [
            {
                _id: 'e1',
                name: 'Event 1',
                dates: {
                    start: '2016-10-15T13:01:11+0000',
                    end: '2016-10-15T14:01:11+0000',
                },
                lock_user: 'user123',
                lock_session: 'session123',
            },
            {
                _id: 'e2',
                name: 'Event 2',
                dates: {
                    start: '2014-10-15T14:01:11+0000',
                    end: '2014-10-15T15:01:11+0000',
                },
            },
            {
                _id: 'e3',
                name: 'Event 3',
                dates: {
                    start: '2015-10-15T14:01:11+0000',
                    end: '2015-10-15T15:01:11+0000',
                },
            },
        ]
        const initialState = {
            events: {
                events: {
                    e1: events[0],
                    e2: events[1],
                    e3: events[2],
                },
                eventsInList: [],
                search: {
                    advancedSearchOpened: false,
                    currentSearch: { fulltext: undefined },
                },
                show: true,
                showEventDetails: null,
                highlightedEvent: null,
                lastRequestParams: { page: 1 },
                eventHistoryItems: [],
            },
            privileges: {
                planning: 1,
                planning_event_management: 1,
                planning_event_spike: 1,
                planning_event_unspike: 1,
            },
            planning: { plannings: {} },
            config: { server: { url: 'http://server.com' } },
            users: [{ _id: 'user123' }],
            session: {
                identity: { _id: 'user123' },
                sessionId: 'session123',
            },
        }
        const getState = () => (initialState)
        let dispatch

        // Special dispatcher for `checkPermission` that executes the first dispatch
        // and mocks the proceeding calls
        const dispatchCheckPermission = sinon.spy((action) =>  {
            if (typeof action === 'function' && dispatch.callCount < 2) {
                return action(dispatch, getState, {
                    notify,
                    api,
                    $timeout,
                })
            }

            return action
        })

        const dispatchRunFunction = sinon.spy((action) =>  {
            if (typeof action === 'function') {
                return action(dispatch, getState, {
                    notify,
                    api,
                    $timeout,
                })
            }

            return action
        })

        const notify = {
            error: sinon.spy(),
            success: sinon.spy(),
            pop: sinon.spy(),
        }
        const $timeout = sinon.spy((func) => func())
        let $location

        const upload = {
            start: sinon.spy((file) => (Promise.resolve({
                data: {
                    _id: file.data.media[0][0],
                    file,
                },
            }))),
        }

        let apiSpy
        const api = () => (apiSpy)

        beforeEach(() => {
            apiSpy = {
                query: sinon.spy(() => (Promise.resolve({ _items: events }))),
                remove: sinon.spy(() => (Promise.resolve())),
                save: sinon.spy((ori, item) => (Promise.resolve({
                    _id: 'e4',
                    ...ori,
                    ...item,
                }))),
            }

            dispatch = sinon.spy(() => (Promise.resolve()))
            $location = { search: sinon.spy(() => (Promise.resolve())) }

            notify.error.reset()
            notify.success.reset()
            dispatchCheckPermission.reset()
            dispatchRunFunction.reset()
            $timeout.reset()

            sinon.stub(eventsUi, 'refetchEvents').callsFake(() => (Promise.resolve()))
        })

        afterEach(() => {
            restoreSinonStub(eventsUi.refetchEvents)
        })

        it('uploadFilesAndSaveEvent', (done) => {
            dispatch = dispatchRunFunction
            initialState.events.highlightedEvent = true
            initialState.events.showEventDetails = true
            const event = {
                name: 'Event 4',
                dates: {
                    start: '2099-10-15T13:01:11',
                    end: '2099-10-15T14:01:11',
                },
            }
            const action = actions.uploadFilesAndSaveEvent(event)
            api.save = sinon.spy(() => (Promise.resolve(event)))
            return action(dispatch, getState)
            .then(() => {
                expect(eventsUi.refetchEvents.callCount).toBe(1)
                done()
            })
            .catch((error) => {
                expect(error).toBe(null)
                expect(error.stack).toBe(null)
                done()
            })
        })

        it('saveFiles', (done) => {
            const event = {
                files: [
                    ['test_file_1'],
                    ['test_file_2'],
                ],
            }

            const action = actions.saveFiles(event)
            return action(dispatch, getState, { upload })
            .then((newEvent) => {
                expect(upload.start.callCount).toBe(2)
                expect(upload.start.args[0]).toEqual([{
                    method: 'POST',
                    url: 'http://server.com/events_files/',
                    headers: { 'Content-Type': 'multipart/form-data' },
                    data: { media: [event.files[0]] },
                    arrayKey: '',
                }])
                expect(upload.start.args[1]).toEqual([{
                    method: 'POST',
                    url: 'http://server.com/events_files/',
                    headers: { 'Content-Type': 'multipart/form-data' },
                    data: { media: [event.files[1]] },
                    arrayKey: '',
                }])

                expect(newEvent.files).toEqual(['test_file_1', 'test_file_2'])

                done()
            })
            .catch((error) => {
                expect(error).toBe(null)
                expect(error.stack).toBe(null)
                done()
            })
        })

        describe('fetchEvents', () => {

            const store = createTestStore({ initialState })

            it('ids', (done) => {
                const action = actions.fetchEvents(
                    { ids: range(1, EVENTS.FETCH_IDS_CHUNK_SIZE + 10).map((i) => (`e${i}`)) }
                )
                store.dispatch(action)
                .then((response) => {
                    expect(response._items).toEqual([])
                    done()
                })
                .catch((error) => {
                    expect(error).toBe(null)
                    expect(error.stack).toBe(null)
                    done()
                })
            })

            it('fulltext', (done) => {
                store.dispatch(actions.fetchEvents({ fulltext: 'search that' }))
                .then(() => done())
                .catch((error) => {
                    expect(error).toBe(null)
                    expect(error.stack).toBe(null)
                    done()
                })
            })
        })

        it('fetchEvents', (done) => {
            dispatch = dispatchRunFunction
            const params = {}
            const action = actions.fetchEvents(params)
            return action(dispatch, getState, {
                $timeout,
                $location,
            })
            .then(() => {
                expect(dispatch.args[0]).toEqual([{
                    type: 'REQUEST_EVENTS',
                    payload: params,
                }])

                // Cannot check dispatch(performFetchQuery()) using a spy on dispatch
                // As performFetchQuery is a thunk function

                expect(dispatch.args[2]).toEqual([jasmine.objectContaining({
                    type: 'ADD_EVENTS',
                    payload: events,
                })])

                expect(dispatch.args[3]).toEqual([{
                    type: 'SET_EVENTS_LIST',
                    payload: ['e1', 'e2', 'e3'],
                }])

                expect($timeout.callCount).toBe(1)

                expect($location.search.args[0]).toEqual([
                    'searchEvent',
                    JSON.stringify(params),
                ])

                expect(dispatch.callCount).toBe(4)

                done()
            })
            .catch((error) => {
                expect(error).toBe(null)
                expect(error.stack).toBe(null)
                done()
            })
        })

        describe('fetchEventById', () => {
            it('calls api.getById and runs dispatches', (done) => {
                apiSpy.getById = sinon.spy(() => Promise.resolve(events[1]))
                const action = actions.fetchEventById('e2')
                return action(dispatch, getState, {
                    api,
                    notify,
                })
                .then((event) => {
                    expect(event).toEqual(events[1])
                    expect(apiSpy.getById.callCount).toBe(1)
                    expect(apiSpy.getById.args[0]).toEqual(['e2'])

                    expect(dispatch.callCount).toBe(2)
                    expect(dispatch.args[0]).toEqual([jasmine.objectContaining({
                        type: 'ADD_EVENTS',
                        payload: [events[1]],
                    })])
                    expect(dispatch.args[1]).toEqual([{
                        type: 'ADD_TO_EVENTS_LIST',
                        payload: ['e2'],
                    }])

                    expect(notify.error.callCount).toBe(0)
                    done()
                })
                .catch((error) => {
                    expect(error).toBe(null)
                    expect(error.stack).toBe(null)
                    done()
                })
            })

            it('notifies end user if an error occurred', (done) => {
                apiSpy.getById = sinon.spy(() => Promise.reject())
                const action = actions.fetchEventById('e2')
                return action(dispatch, getState, {
                    api,
                    notify,
                })
                .then(() => {
                    expect(notify.error.callCount).toBe(1)
                    expect(notify.error.args[0]).toEqual(['Failed to fetch an Event!'])
                    done()
                })
                .catch((error) => {
                    expect(error).toBe(null)
                    expect(error.stack).toBe(null)
                    done()
                })
            })
        })

        it('addToEventsList', () => {
            const ids = ['e4', 'e5', 'e6']
            const action = actions.addToEventsList(ids)
            expect(action).toEqual({
                type: 'ADD_TO_EVENTS_LIST',
                payload: ids,
            })
        })

        it('openAdvancedSearch', () => {
            const action = actions.events.ui.openAdvancedSearch()
            expect(action).toEqual({ type: 'EVENT_OPEN_ADVANCED_SEARCH' })
        })

        it('closeAdvancedSearch', () => {
            const action = actions.events.ui.closeAdvancedSearch()
            expect(action).toEqual({ type: 'EVENT_CLOSE_ADVANCED_SEARCH' })
        })

        it('toggleEventsList', () => {
            const action = actions.toggleEventsList()
            expect(action).toEqual({ type: 'TOGGLE_EVENT_LIST' })
        })

        describe('fetchEventHistory', () => {
            let eventHistoryItems = [
                {
                    _id: 'e2',
                    _created: '2017-06-19T02:21:42+0000',
                    event_id: 'e2',
                    operation: 'create',
                    update: {
                        name: 'Test Event Wollongong',
                        dates: {
                            end: '2017-06-27T07:00:00+0000',
                            start: '2017-06-24T23:00:00+0000',
                            tz: 'Australia/Sydney',
                        },
                    },
                    user_id: '5923ac531d41c81e3290a5ee',
                },
                {
                    _id: 'e2',
                    _created: '2017-06-19T02:21:42+0000',
                    event_id: 'e2',
                    operation: 'update',
                    update: { name: 'Test Event Wollongong.' },
                    user_id: '5923ac531d41c81e3290a5ee',
                },
            ]

            it('calls events_history api and runs dispatch', () => {
                apiSpy.query = sinon.spy(() => (Promise.resolve({ _items: eventHistoryItems })))
                const action = actions.fetchEventHistory('e2')
                return action(dispatch, getState, { api })
                .then((data) => {
                    expect(data._items).toEqual(eventHistoryItems)
                    expect(apiSpy.query.callCount).toBe(1)
                    expect(dispatch.callCount).toBe(1)

                    expect(apiSpy.query.args[0]).toEqual([{
                        where: { event_id: 'e2' },
                        max_results: 200,
                        sort: '[(\'_created\', 1)]',
                    }])

                    expect(dispatch.args[0]).toEqual([{
                        type: 'RECEIVE_EVENT_HISTORY',
                        payload: eventHistoryItems,
                    }])
                })
            })
        })
    })

    describe('websocket', () => {
        const initialState = {
            events: {
                events: {
                    e1: {
                        _id: 'e1',
                        name: 'Event1',
                        dates: {
                            start: '2017-05-31T16:37:11+0000',
                            end: '2017-05-31T17:37:11+0000',
                        },
                    },
                },
                lastRequestParams: { page: 1 },
            },
        }
        const newEvent = {
            _id: 'e2',
            name: 'Event2',
            dates: {
                start: '2017-06-30T12:37:11+0000',
                end: '2017-06-30T13:37:11+0000',
            },
        }

        let store
        let spyGetById
        let spyQuery
        let $rootScope
        let spyQueryResult
        const delay = 0

        // Store the window.setTimeout so we can restore it after our tests
        let originalSetTimeout = window.setTimeout

        beforeEach(inject((_$rootScope_) => {
            // Mock window.setTimeout
            jasmine.getGlobal().setTimeout = func => func()

            $rootScope = _$rootScope_

            spyGetById = sinon.spy(() => newEvent)
            spyQuery = sinon.spy(() => spyQueryResult)

            store = createTestStore({
                initialState: cloneDeep(initialState),
                extraArguments: {
                    apiGetById: spyGetById,
                    apiQuery: spyQuery,
                },
            })

            registerNotifications($rootScope, store)
            $rootScope.$digest()

            spyQueryResult = {
                _items: [
                    {
                        _id: 'e3',
                        name: 'Event3',
                        recurrence_id: 'r1',
                        dates: {
                            start: '2017-06-30T12:37:11+0000',
                            end: '2017-06-30T13:37:11+0000',
                        },
                    },
                    {
                        _id: 'e4',
                        name: 'Event4',
                        recurrence_id: 'r1',
                        dates: {
                            start: '2017-06-30T12:37:11+0000',
                            end: '2017-06-30T13:37:11+0000',
                        },
                    },
                ],
            }
        }))

        afterEach(() => {
            // Restore window.setTimeout
            jasmine.getGlobal().setTimeout = originalSetTimeout
        })

        describe('`events:created`', () => {
            it('Adds the Event item to the store', (done) => {
                $rootScope.$broadcast('events:created', { item: 'e2' })

                // Expects run in setTimeout to give the event listener a chance to execute
                originalSetTimeout(() => {
                    expect(spyGetById.callCount).toBe(1)
                    expect(spyGetById.args[0]).toEqual([
                        'events',
                        'e2',
                    ])

                    expect(selectors.getEvents(store.getState())).toEqual({
                        e1: {
                            _id: 'e1',
                            name: 'Event1',
                            dates: {
                                start: moment('2017-05-31T16:37:11+0000'),
                                end: moment('2017-05-31T17:37:11+0000'),
                            },
                        },
                        e2: {
                            _id: 'e2',
                            name: 'Event2',
                            dates: {
                                start: moment('2017-06-30T12:37:11+0000'),
                                end: moment('2017-06-30T13:37:11+0000'),
                            },
                        },
                    })
                    done()
                }, delay)
            })

            it('Silently returns if no event provided', (done) => {
                $rootScope.$broadcast('events:created', {})

                // Expects run in setTimeout to give the event listener a chance to execute
                originalSetTimeout(() => {
                    expect(spyGetById.callCount).toBe(0)
                    expect(selectors.getEvents(store.getState())).toEqual({
                        e1: {
                            _id: 'e1',
                            name: 'Event1',
                            dates: {
                                start: moment('2017-05-31T16:37:11+0000'),
                                end: moment('2017-05-31T17:37:11+0000'),
                            },
                        },
                    })
                    done()
                }, delay)
            })
        })

        describe('`events:created:recurring`', () => {
            it('Adds the Events to the store', (done) => {
                $rootScope.$broadcast('events:created:recurring', { item: 'r1' })
                $rootScope.$digest()

                // Expects run in setTimeout to give the event listener a change to execute
                originalSetTimeout(() => {
                    expect(spyQuery.callCount).toBe(2)
                    expect(spyQuery.args[0]).toEqual([
                        'events',
                        {
                            page: 1,
                            max_results: 25,
                            sort: '[("dates.start",1)]',
                            embedded: { files: 1 },
                            source: JSON.stringify({
                                query: {
                                    bool: {
                                        must: [
                                            { term: { recurrence_id: 'r1' } },
                                        ],
                                        must_not: [
                                            { term: { state: 'spiked' } },
                                        ],
                                    },
                                },
                                filter: {},
                            }),
                        },
                    ])

                    expect(selectors.getEvents(store.getState())).toEqual({
                        e1: {
                            _id: 'e1',
                            name: 'Event1',
                            dates: {
                                start: moment('2017-05-31T16:37:11+0000'),
                                end: moment('2017-05-31T17:37:11+0000'),
                            },
                        },
                        e3: {
                            _id: 'e3',
                            name: 'Event3',
                            recurrence_id: 'r1',
                            dates: {
                                start: moment('2017-06-30T12:37:11+0000'),
                                end: moment('2017-06-30T13:37:11+0000'),
                            },
                        },
                        e4: {
                            _id: 'e4',
                            name: 'Event4',
                            recurrence_id: 'r1',
                            dates: {
                                start: moment('2017-06-30T12:37:11+0000'),
                                end: moment('2017-06-30T13:37:11+0000'),
                            },
                        },
                    })

                    done()
                }, delay)
            })

            it('Silently returns if no recurring event provided', (done) => {
                $rootScope.$broadcast('events:created:recurring', {})

                // Expects run in setTimeout to give the event listener a chance to execute
                originalSetTimeout(() => {
                    expect(spyGetById.callCount).toBe(0)
                    expect(selectors.getEvents(store.getState())).toEqual({
                        e1: {
                            _id: 'e1',
                            name: 'Event1',
                            dates: {
                                start: moment('2017-05-31T16:37:11+0000'),
                                end: moment('2017-05-31T17:37:11+0000'),
                            },
                        },
                    })
                    done()
                }, delay)
            })
        })

        describe('`events:updated`', () => {
            it('Refetches the current list of events', (done) => {
                spyQueryResult = {
                    _items: [{
                        _id: 'e1',
                        name: 'Event1 Updated',
                        dates: {
                            start: '2017-05-31T17:00:00+0000',
                            end: '2017-05-31T18:00:00+0000',
                        },
                    }],
                }

                $rootScope.$broadcast('events:updated', { item: 'e1' })

                originalSetTimeout(() => {
                    expect(spyQuery.callCount).toBe(1)
                    expect(selectors.getEvents(store.getState())).toEqual({
                        e1: {
                            _id: 'e1',
                            name: 'Event1 Updated',
                            dates: {
                                start: moment('2017-05-31T17:00:00+0000'),
                                end: moment('2017-05-31T18:00:00+0000'),
                            },
                        },
                    })
                    done()
                }, delay)
            })

            it('Event silently returns if no event provided', (done) => {
                $rootScope.$broadcast('events:updated', {})

                originalSetTimeout(() => {
                    expect(spyQuery.callCount).toBe(0)
                    expect(selectors.getEvents(store.getState())).toEqual({
                        e1: {
                            _id: 'e1',
                            name: 'Event1',
                            dates: {
                                start: moment('2017-05-31T16:37:11+0000'),
                                end: moment('2017-05-31T17:37:11+0000'),
                            },
                        },
                    })
                    done()
                }, delay)
            })
        })
    })
})
