import { get, cloneDeep, pickBy, isEqual, has } from 'lodash'
import * as actions from '../../actions'
import * as selectors from '../../selectors'
import {
    getTimeZoneOffset,
    sanitizeTextForQuery,
    isItemLockedInThisSession,
} from '../../utils'
import planningUtils from '../../utils/planning'
import {
    PLANNING,
    PUBLISHED_STATE,
    SPIKED_STATE,
    WORKFLOW_STATE,
    MODALS,
} from '../../constants'

/**
 * Action dispatcher that marks a Planning item as spiked
 * @param {object} item - The planning item to spike
 * @return Promise
 */
const spike = (item) => (
    (dispatch, getState, { api }) => (
        api.update('planning_spike', { ...item }, {})
        .then(
            () => Promise.resolve(item),
            (error) => Promise.reject(error)
        )
    )
)

/**
 * Action dispatcher that marks a Planning item as active
 * @param {object} item - The Planning item to unspike
 * @return Promise
 */
const unspike = (item) => (
    (dispatch, getState, { api }) => (
        api.update('planning_unspike', { ...item }, {})
        .then(
            () => Promise.resolve(item),
            (error) => Promise.reject(error)
        )
    )
)

const cancel = (item) => (
    (dispatch, getState, { api }) => (
        api.update(
            'planning_cancel',
            item,
            { reason: get(item, 'reason', undefined) }
        )
    )
)

const cancelAllCoverage = (item) => (
    (dispatch, getState, { api }) => (
        api.update(
            'planning_cancel',
            item,
            {
                reason: get(item, 'reason', undefined),
                cancel_all_coverage: true,
            }
        )
    )
)

/**
 * Action dispatcher to perform fetch the list of planning items from the server.
 * @param {string} eventIds - An event ID to fetch Planning items for that event
 * @param {string} spikeState - Planning item's spiked state (SPIKED, NOT_SPIKED or BOTH)
 * @param {agendas} list of agenda ids
 * @param {int} page - The page number to query for
 * @return Promise
 */
const query = ({
    eventIds,
    spikeState=SPIKED_STATE.BOTH,
    agendas,
    noAgendaAssigned=false,
    page=1,
    advancedSearch={},
    onlyFuture,
    fulltext,
}) => (
    (dispatch, getState, { api }) => {
        let query = {}
        let mustNot = []
        let must = []

        if (eventIds) {
            if (Array.isArray(eventIds)) {
                const chunkSize = PLANNING.FETCH_IDS_CHUNK_SIZE
                if (eventIds.length <= chunkSize) {
                    must.push({ terms: { event_item: eventIds } })
                } else {
                    const requests = []
                    for (let i = 0; i < Math.ceil(eventIds.length / chunkSize); i++) {
                        const args = {
                            ...arguments[0],
                            eventIds: eventIds.slice(i * chunkSize, (i + 1) * chunkSize),
                        }
                        requests.push(dispatch(self.query(args)))
                    }

                    // Flatten responses and return a response-like object
                    return Promise.all(requests).then((responses) => (
                        Array.prototype.concat(...responses)
                    ))
                }

            } else {
                must.push({ term: { event_item: eventIds } })
            }
        }

        [
            {
                condition: () => (true),
                do: () => {
                    if (agendas) {
                        must.push({ terms: { agendas: agendas } })
                    } else if (noAgendaAssigned) {
                        let field = { field: 'agendas' }
                        mustNot.push({ constant_score: { filter: { exists: field } } })
                    }
                },
            },
            {
                condition: () => (spikeState === SPIKED_STATE.SPIKED),
                do: () => {
                    must.push({ term: { state: WORKFLOW_STATE.SPIKED } })
                },
            },
            {
                condition: () => (spikeState === SPIKED_STATE.NOT_SPIKED || !spikeState),
                do: () => {
                    mustNot.push({ term: { state: WORKFLOW_STATE.SPIKED } })
                },
            },
            {
                condition: () => (fulltext),
                do: () => {
                    let queryString = {
                        query_string: {
                            query: '(' + sanitizeTextForQuery(fulltext) + ')',
                            lenient: false,
                            default_operator: 'AND',
                        },
                    }
                    must.push(queryString)
                },
            },
            {
                condition: () => (!get(advancedSearch, 'dates') && onlyFuture),
                do: () => {
                    must.push({
                        nested: {
                            path: '_planning_schedule',
                            query: {
                                bool: {
                                    must: [
                                        {
                                            range: {
                                                '_planning_schedule.scheduled': {
                                                    gte: 'now/d',
                                                    time_zone: getTimeZoneOffset(),
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    })
                },
            },
            {
                condition: () => (!get(advancedSearch, 'dates') && !onlyFuture),
                do: () => {
                    must.push({
                        nested: {
                            path: '_planning_schedule',
                            query: {
                                bool: {
                                    must: [
                                        {
                                            range: {
                                                '_planning_schedule.scheduled': {
                                                    lt: 'now/d',
                                                    time_zone: getTimeZoneOffset(),
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    })
                },
            },
            {
                condition: () => (get(advancedSearch, 'dates')),
                do: () => {
                    let fieldName = '_planning_schedule.scheduled'
                    let range = {}
                    range[fieldName] = { time_zone: getTimeZoneOffset() }
                    let rangeType = get(advancedSearch, 'dates.range')

                    if (rangeType === 'today') {
                        range[fieldName].gte = 'now/d'
                        range[fieldName].lt = 'now+24h/d'
                    } else if (rangeType === 'last24') {
                        range[fieldName].gte = 'now-24h'
                        range[fieldName].lt = 'now'
                    } else if (rangeType === 'week') {
                        range[fieldName].gte = 'now/w'
                        range[fieldName].lt = 'now+1w/w'
                    } else {
                        if (get(advancedSearch, 'dates.start')) {
                            range[fieldName].gte = get(advancedSearch, 'dates.start')
                        }

                        if (get(advancedSearch, 'dates.end')) {
                            range[fieldName].lte = get(advancedSearch, 'dates.end')
                        }
                    }

                    must.push({
                        nested: {
                            path: '_planning_schedule',
                            query: { bool: { must: [{ range: range }] } },
                        },
                    })
                },
            },
            {
                condition: () => (advancedSearch.slugline),
                do: () => {
                    let query = { bool: { should: [] } }
                    let queryText = sanitizeTextForQuery(advancedSearch.slugline)
                    let queryString = {
                        query_string: {
                            query: 'slugline:(' + queryText + ')',
                            lenient: false,
                            default_operator: 'AND',
                        },
                    }
                    query.bool.should.push(queryString)
                    queryString = cloneDeep(queryString)
                    queryString.query_string.query = 'coverages.planning.slugline:(' + queryText + ')' // jscs: disable

                    if (!advancedSearch.noCoverage) {
                        query.bool.should.push({
                            nested: {
                                path: 'coverages',
                                query: { bool: { must: [queryString] } },
                            },
                        })
                    }

                    must.push(query)
                },
            },
            {
                condition: () => (Array.isArray(advancedSearch.anpa_category) &&
                advancedSearch.anpa_category.length > 0),
                do: () => {
                    const codes = advancedSearch.anpa_category.map((cat) => cat.qcode)
                    must.push({ terms: { 'anpa_category.qcode': codes } })
                },
            },
            {
                condition: () => (Array.isArray(advancedSearch.subject) &&
                advancedSearch.subject.length > 0),
                do: () => {
                    const codes = advancedSearch.subject.map((subject) => subject.qcode)
                    must.push({ terms: { 'subject.qcode': codes } })
                },
            },
            {
                condition: () => (advancedSearch.urgency),
                do: () => {
                    must.push({ term: { urgency: advancedSearch.urgency } })
                },
            },
            {
                condition: () => (advancedSearch.g2_content_type),
                do: () => {
                    let term = { 'coverages.planning.g2_content_type': advancedSearch.g2_content_type } // jscs:ignore maximumLineLength
                    must.push({
                        nested: {
                            path: 'coverages',
                            query: { bool: { must: [{ term: term }] } },
                        },
                    })
                },
            },
            {
                condition: () => (advancedSearch.noCoverage),
                do: () => {
                    /* eslint-disable */
                    let noCoverageTerm = {
                        constant_score: { filter: { exists: { field: 'coverages.coverage_id' } } },
                    }
                    /* eslint-enable */
                    mustNot.push({
                        nested: {
                            path: 'coverages',
                            query: { bool: { must: [noCoverageTerm] } },
                        },
                    })
                },
            },
        ].forEach((action) => {
            if (!eventIds && action.condition()) {
                action.do()
            }
        })

        query.bool = {
            must,
            must_not: mustNot,
        }

        let sort = [
            {
                '_planning_schedule.scheduled': {
                    order: onlyFuture ? 'asc' : 'desc',
                    nested_path: '_planning_schedule',
                    nested_filter: {
                        range: {
                            '_planning_schedule.scheduled': onlyFuture ? {
                                gte: 'now/d',
                                time_zone: getTimeZoneOffset(),
                            } : {
                                lt: 'now/d',
                                time_zone: getTimeZoneOffset(),
                            },
                        },
                    },
                },
            },
        ]

        if (eventIds) {
            sort = [{ _planning_date: { order: 'asc' } }]
        }

        // Query the API
        return api('planning').query({
            page,
            source: JSON.stringify({
                query,
                sort,
            }),
            embedded: { original_creator: 1 }, // Nest creator to planning
            timestamp: new Date(),
        })
        .then((data) => {
            if (get(data, '_items')) {
                data._items.forEach(planningUtils.convertCoveragesGenreToObject)
                return Promise.resolve(data._items)
            } else {
                return Promise.reject('Failed to retrieve items')
            }
        }, (error) => (Promise.reject(error)))
    }
)

/**
 * Action dispatcher for requesting a fetch of planning items
 * Then store them in the redux store. This also replaces the list of
 * visibile Planning items for the PlanningList component
 * @param {object} params - Parameters used when fetching the planning items
 * @return Promise
 */
const fetch = (params={}) => (
    (dispatch) => (
        dispatch(self.query(params))
        .then((items) => (
            dispatch(self.fetchPlanningsEvents(items))
            .then(() => {
                dispatch(self.receivePlannings(items))
                return Promise.resolve(items)
            }, (error) => (Promise.reject(error)))
        ), (error) => {
            dispatch(self.receivePlannings([]))
            return Promise.reject(error)
        })
    )
)

/**
 * Action Dispatcher to re-fetch the current list of planning
 * It achieves this by performing a fetch using the params from
 * the store value `planning.lastRequestParams`
 */
const refetch = (page=1, plannings=[]) => (
    (dispatch, getState) => {
        const prevParams = selectors.getPreviousPlanningRequestParams(getState())
        let params = {
            ...selectors.getPlanningFilterParams(getState()),
            page,
        }

        return dispatch(self.query(params))
        .then((items) => {
            plannings = plannings.concat(items)
            page++
            if (get(prevParams, 'page', 1) >= page) {
                return dispatch(self.refetch(page, plannings))
            }

            dispatch(self.receivePlannings(plannings))
            return Promise.resolve(plannings)
        }, (error) => (Promise.reject(error)))
    }
)

/**
 * Action dispatcher to fetch Events associated with Planning items
 * and place them in the local store.
 * @param {Array} plannings - An array of Planning items
 * @return Promise
 */
const fetchPlanningsEvents = (plannings) => (
    (dispatch, getState) => {
        const loadedEvents = selectors.getEvents(getState())
        const linkedEvents = plannings
        .map((p) => p.event_item)
        .filter((eid) => (
            eid && !has(loadedEvents, eid)
        ))

        // load missing events, if there are any
        if (get(linkedEvents, 'length', 0) > 0) {
            return dispatch(actions.events.api.silentlyFetchEventsById(linkedEvents,
                SPIKED_STATE.BOTH))
        }

        return Promise.resolve([])
    }
)

/**
 * Action Dispatcher that fetches a Planning Item by ID
 * and adds or updates it in the redux store.
 * If the Planning item already exists in the local store, then don't
 * fetch the Planning item from the API
 * @param {string} pid - The ID of the Planning item to fetch
 * @param {boolean} force - Force using the API instead of local store
 * @return Promise
 */
const fetchPlanningById = (pid, force=false) => (
    (dispatch, getState, { api }) => {
        // Test if the Planning item is already loaded into the store
        // If so, return that instance instead
        const storedPlannings = selectors.getStoredPlannings(getState())
        if (has(storedPlannings, pid) && !force) {
            return Promise.resolve(storedPlannings[pid])
        }

        return api('planning').getById(pid)
        .then((item) => (
            dispatch(self.fetchPlanningsEvents([planningUtils.convertCoveragesGenreToObject(item)]))
            .then(() => {
                dispatch(self.receivePlannings([item]))
                return Promise.resolve(item)
            }, (error) => (Promise.reject(error)))
        ), (error) => {
            dispatch(self.receivePlannings([]))
            return Promise.reject(error)
        })
    }
)

/**
 * Action Dispatcher to fetch planning history from the server
 * This will add the history of action on that planning item in planning history list
 * @param {object} currentPlanningId - Query parameters to send to the server
 * @return arrow function
 */
const fetchPlanningHistory = (currentPlanningId) => (
    (dispatch, getState, { api }) => (
        // Query the API and sort by created
        api('planning_history').query({
            where: { planning_id: currentPlanningId },
            max_results: 200,
            sort: '[(\'_created\', 1)]',
        })
        .then(data => {
            dispatch(self.receivePlanningHistory(data._items))
            return Promise.resolve(data)
        }, (error) => (Promise.reject(error)))
    )
)

/**
 * Action to receive the history of actions on planning item
 * @param {array} planningHistoryItems - An array of planning history items
 * @return object
 */
const receivePlanningHistory = (planningHistoryItems) => ({
    type: PLANNING.ACTIONS.RECEIVE_PLANNING_HISTORY,
    payload: planningHistoryItems,
})

/**
 * Action dispatcher to load a Planning item from the API, and place them
 * in the local store. This does not update the list of visible Planning items
 * @param {object} query - The query used to query the Planning items
 * @param {boolean} saveToStore - If true, save the Planning item in the Redux store
 * @return Promise
 */
const loadPlanning = (query, saveToStore=true) => (
    (dispatch) => (
        dispatch(self.query(query))
        .then((data) => {
            if (saveToStore) {
                dispatch(self.receivePlannings(data))
            }

            return Promise.resolve(data)
        }, (error) => (Promise.reject(error)))
    )
)

/**
 * Action dispatcher to load Planning items by ID from the API, and place them
 * in the local store. This does not update the list of visible Planning items
 * @param {Array, string} ids - Either an array of Planning IDs or a single Planning ID to fetch
 * @param {string} spikeState - Planning item's spiked state (SPIKED, NOT_SPIKED or BOTH)
 * @param {boolean} saveToStore - If true, save the Planning item in the Redux store
 * @return Promise
 */
const loadPlanningById = (ids=[], spikeState = SPIKED_STATE.BOTH, saveToStore=true) => (
    (dispatch, getState, { api }) => {
        if (Array.isArray(ids)) {
            return dispatch(self.loadPlanning({
                ids,
                spikeState,
            }))
        } else {
            return api('planning').getById(ids)
            .then((item) => {
                planningUtils.convertCoveragesGenreToObject(item)
                if (saveToStore) {
                    dispatch(self.receivePlannings([item]))
                }

                return Promise.resolve([item])
            }, (error) => (Promise.reject(error)))
        }
    }
)

/**
 * Action dispatcher to load Planning items by Event ID from the API, and place them
 * in the local store. This does not update the list of visible Planning items
 * @param {string} eventIds - The Event ID used to query the API
 * @param {boolean} loadToStore - If true, save the Planning Items to the Redux Store
 * @return Promise
 */
const loadPlanningByEventId = (eventIds, loadToStore=true) => (
    (dispatch, getState, { api }) => (
        api('planning').query({
            source: JSON.stringify(
                Array.isArray((eventIds)) ?
                    { query: { terms: { event_item: eventIds } } } :
                    { query: { term: { event_item: eventIds } } }
            ),
        })
        .then((data) => {
            if (loadToStore) {
                dispatch(self.receivePlannings(data._items))
            }

            return Promise.resolve(data._items)
        }, (error) => Promise.reject(error))
    )
)

const loadPlanningByRecurrenceId = (recurrenceId, loadToStore=true) => (
    (dispatch, getState, { api }) => (
        api('planning').query({
            source: JSON.stringify(
                { query: { term: { recurrence_id: recurrenceId } } }
            ),
        })
        .then((data) => {
            if (loadToStore) {
                dispatch(self.receivePlannings(data._items))
            }

            return Promise.resolve(data._items)
        }, (error) => Promise.reject(error))
    )
)

/**
 * Action dispatcher to query the API for all Planning items
 * that are currently locked
 * @return Array of locked Planning items
 */
const queryLockedPlanning = () => (
    (dispatch, getState, { api }) => (
        api('planning').query({
            source: JSON.stringify(
                { query: { constant_score: { filter: { exists: { field: 'lock_session' } } } } }
            ),
        })
        .then(
            (data) => Promise.resolve(data._items),
            (error) => Promise.reject(error)
        )
    )
)

/**
 * Action Dispatcher to get a single Planning item
 * If the Planning item is already stored in the Redux store, then return that
 * Otherwise fetch the Planning item from the server and optionally
 * save the Planning item in the Redux store
 * @param {string} planId - The ID of the Planning item to retrieve
 * @param {boolean} saveToStore - If true, save the Planning item in the Redux store
 */
const getPlanning = (planId, saveToStore=true) => (
    (dispatch, getState) => {
        const plannings = selectors.getStoredPlannings(getState())
        if (planId in plannings) {
            return Promise.resolve(plannings[planId])
        }

        return dispatch(self.loadPlanningById(planId, SPIKED_STATE.BOTH, saveToStore))
        .then(
            (items) => Promise.resolve(items[0]),
            (error) => Promise.reject(error)
        )
    }
)

/**
 * Saves a Planning Item
 * If the item does not contain an _id, then it creates a new planning item instead
 * @param {object} item - The Planning item to save
 * @param {object} original - If supplied, will use this as the original Planning item
 * @return Promise
 */
const save = (item, original=undefined) => (
    (dispatch, getState, { api }) => {
        // remove all properties starting with _,
        // otherwise it will fail for "unknown field" with `_type`
        item = pickBy(item, (v, k) => (k === '_id' || !k.startsWith('_')))

        // remove nested original creator
        delete item.original_creator

        if (item.agendas) {
            item.agendas = item.agendas.map((agenda) => agenda._id || agenda)
        }

        get(item, 'coverages', []).forEach((coverage) => {
            // Convert genre back to an Array
            if (get(coverage, 'planning.genre')) {
                coverage.planning.genre = [coverage.planning.genre]
            }
        })

        // Find the original (if it exists) either from the store or the API
        return new Promise((resolve, reject) => {
            if (original !== undefined) {
                return resolve(original)
            } else if (get(item, '_id')) {
                return dispatch(self.fetchPlanningById(item._id))
                .then(
                    (item) => resolve(item),
                    (error) => reject(error)
                )
            } else if (get(item, 'coverages.length', 0) > 0) {
                // If the new Planning item has coverages then we need to create
                // the planning first before saving the coverages
                // As assignments are created and require a Planning ID
                // const coverages = cloneDeep(item.coverages)
                // item.coverages = []
                return api('planning').save({}, {
                    ...item,
                    coverages: [],
                })
                .then(
                    (newItem) => resolve(newItem),
                    (error) => reject(error)
                )
            } else {
                return resolve({})
            }
        })
        .then((originalItem) => (
            api('planning').save(cloneDeep(originalItem), item)
            .then(
                (item) => (Promise.resolve(item)),
                (error) => (Promise.reject(error))
            )
        ), (error) => Promise.reject(error))
    }
)

/**
 * Saves the supplied planning item and reload the
 * list of Agendas and their associated planning items.
 * If the planning item does not have an ._id, then add it to the
 * currently selected Agenda
 * If no Agenda is selected, or the currently selected Agenda is spiked,
 * then notify the end user and reject this action
 * @param {object} item - The planning item to save
 * @return Promise
 */
const saveAndReloadCurrentAgenda = (item) => (
    (dispatch, getState) => (
        new Promise((resolve, reject) => {
            if (get(item, '_id')) {
                return dispatch(self.fetchPlanningById(item._id))
                .then(
                    (item) => (resolve(item)),
                    (error) => (reject(error))
                )
            } else {
                return resolve({})
            }
        })
        .then((originalItem) => {
            if (isEqual(originalItem, {})) {
                const currentAgenda = selectors.getCurrentAgenda(getState())
                const currentAgendaId = selectors.getCurrentAgendaId(getState())
                const errorMessage = { data: {} }

                if (!currentAgendaId) {
                    errorMessage.data._message = 'No Agenda is currently selected.'
                    return Promise.reject(errorMessage)
                } else if (currentAgenda && !currentAgenda.is_enabled) {
                    errorMessage.data._message =
                        'Cannot create a new planning item in a disabled Agenda.'
                    return Promise.reject(errorMessage)
                }

                item.agendas = currentAgenda ? [currentAgenda] : []
            }

            return dispatch(self.save(item, originalItem))
            .then(
                (item) => (Promise.resolve(item)),
                (error) => (Promise.reject(error))
            )
        })
    )
)

const duplicate = (plan) => (
    (dispatch, getState, { api }) => (
        api('planning_duplicate', plan).save({})
        .then((items) => {
            if ('_items' in items) {
                return Promise.resolve(items._items[0])
            }

            return Promise.resolve(items)
        }, (error) => (
            Promise.reject(error)
        ))
    )
)

/**
 * Set a Planning item as Published
 * @param {string} plan - Planning item
 */
const publish = (plan) => (
    (dispatch, getState, { api }) => (
        api.save('planning_publish', {
            planning: plan._id,
            etag: plan._etag,
            pubstatus: PUBLISHED_STATE.USABLE,
        }).then(() => {
            dispatch(self.fetchPlanningById(plan._id, true))
        })
    )
)

/**
 * Save a Planning item, then Publish it
 * @param {object} plan - Planning item
 */
const saveAndPublish = (plan) => (
    (dispatch) => (
        dispatch(self.save(plan))
        .then(
            (newItem) => (
                dispatch(self.publish(newItem))
                .then(
                    () => (Promise.resolve(newItem)),
                    (error) => (Promise.reject(error))
                )
            ), (error) => (Promise.reject(error))
        )
    )
)

/**
 * Set a Planning item as not Published
 * @param {string} plan - Planning item ID
 */
const unpublish = (plan) => (
    (dispatch, getState, { api }) => (
        api.save('planning_publish', {
            planning: plan._id,
            etag: plan._etag,
            pubstatus: PUBLISHED_STATE.CANCELLED,
        })
    )
)

/**
 * Save a Planning item then Unpublish it
 * @param {object} plan - Planning item
 */
const saveAndUnpublish = (plan) => (
    (dispatch) => (
        dispatch(self.save(plan))
        .then(
            (newItem) => (
                dispatch(self.unpublish(newItem))
                .then(
                    () => Promise.resolve(newItem),
                    (error) => Promise.reject(error)
                )
            ), (error) => Promise.reject(error)
        )
    )
)

/**
 * Action for updating the list of planning items in the redux store
 * @param  {array, object} plannings - An array of planning item objects
 * @return action object
 */
const receivePlannings = (plannings) => ({
    type: PLANNING.ACTIONS.RECEIVE_PLANNINGS,
    payload: plannings,
})

/**
 * Action dispatcher that attempts to unlock a Planning item through the API
 * @param {object} item - The Planning item to unlock
 * @return Promise
 */
const unlock = (item) => (
    (dispatch, getState, { api }) => (
        api('planning_unlock', item).save({})
    )
    .then((item) => {
        planningUtils.convertCoveragesGenreToObject(item)
        return Promise.resolve(item)
    }, (error) => Promise.reject(error))
)

/**
 * Action dispatcher that attempts to lock a Planning item through the API
 * @param {object} item - The Planning item to lock
 * @return Promise
 */
const lock = (planning, lockAction='edit') => (
    (dispatch, getState, { api }) => {
        if (lockAction === null ||
            isItemLockedInThisSession(planning, selectors.getSessionDetails(getState()))
        ) {
            return Promise.resolve(planning)
        }

        return api.save(
            'planning_lock',
            {},
            { lock_action: lockAction },
            { _id: planning._id }
        )
        .then((item) => {
            planningUtils.convertCoveragesGenreToObject(item)
            return Promise.resolve(item)
        }, (error) => Promise.reject(error))
    }
)

const markPlanningCancelled = (plan, reason, coverageState, eventCancellation) => ({
    type: PLANNING.ACTIONS.MARK_PLANNING_CANCELLED,
    payload: {
        planning_item: plan,
        reason,
        coverage_state: coverageState,
        event_cancellation: eventCancellation,
    },
})

const markCoverageCancelled = (plan, reason, coverageState, ids) => ({
    type: PLANNING.ACTIONS.MARK_COVERAGE_CANCELLED,
    payload: {
        planning_item: plan,
        reason,
        coverage_state: coverageState,
        ids: ids,
    },
})

const markPlanningPostponed = (plan, reason) => ({
    type: PLANNING.ACTIONS.MARK_PLANNING_POSTPONED,
    payload: {
        planning_item: plan,
        reason,
    },
})

/**
 * Export selected planning items as a new article
 *
 * First opens a modal where user can sort those and
 * then it sends it to server.
 */
function exportAsArticle() {
    return (dispatch, getState, { api, notify, gettext, superdesk, $interpolate, $location }) => {
        const state = getState()
        const sortableItems = []
        const label = (item) => item.headline || item.slugline || item.description_text
        const locks = selectors.getLockedItems(state)

        state.planning.selectedItems.forEach((id) => {
            const item = state.planning.plannings[id]
            const isLocked = planningUtils.isPlanningLocked(item, locks)
            const isNotForPublication = get(item, 'flags.marked_for_not_publication')

            if (isLocked || isNotForPublication) {
                return
            }

            sortableItems.push({
                id,
                label: label(item),
            })
        })

        if (sortableItems.length < state.planning.selectedItems.length) {
            const count = state.planning.selectedItems.length - sortableItems.length

            if (count === 1) {
                notify.warning(gettext('1 item was not included in the export.'))
            } else {
                const message = gettext('{{ count }} items were not included in the export.')
                notify.warning($interpolate(message)({ count }))
            }
        }

        if (!sortableItems.length) { // nothing to sort, stop
            return
        }

        if (sortableItems.length === 1) { // 1 item to sort - skip it
            return handleSorted(sortableItems)
        }

        return dispatch(actions.showModal({
            modalType: MODALS.SORT_SELECTED,
            modalProps: {
                items: sortableItems,
                action: handleSorted,
            },
        }))

        function handleSorted(sorted) {
            return api.save('planning_export', {
                desk: state.workspace.currentDeskId,
                items: sorted.map((item) => item.id),
            })
            .then((item) => {
                dispatch(actions.planning.ui.deselectAll())
                notify.success(gettext('Article was created.'), 5000, {
                    button: {
                        label: gettext('Open'),
                        onClick: () => {
                            $location.url('/workspace/monitoring')
                            superdesk.intent('edit', 'item', item)
                        },
                    },
                })
            }, () => {
                notify.error(gettext('There was an error when exporting.'))
            })
        }
    }
}

const self = {
    spike,
    unspike,
    query,
    fetch,
    receivePlannings,
    save,
    saveAndReloadCurrentAgenda,
    fetchPlanningById,
    fetchPlanningsEvents,
    unlock,
    lock,
    loadPlanning,
    loadPlanningById,
    fetchPlanningHistory,
    receivePlanningHistory,
    loadPlanningByEventId,
    publish,
    unpublish,
    saveAndPublish,
    saveAndUnpublish,
    refetch,
    duplicate,
    markPlanningCancelled,
    markCoverageCancelled,
    markPlanningPostponed,
    exportAsArticle,
    queryLockedPlanning,
    getPlanning,
    loadPlanningByRecurrenceId,
    cancel,
    cancelAllCoverage,
}

export default self
