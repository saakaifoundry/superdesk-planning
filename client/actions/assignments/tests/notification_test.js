import sinon from 'sinon'
import { getTestActionStore, restoreSinonStub } from '../../../utils/testUtils'
import { registerNotifications } from '../../../utils/notifications'
import * as selectors from '../../../selectors'
import assignmentsUi from '../ui'
import assignmentsApi from '../api'
import assignmentNotifications from '../notifications'

describe('actions.assignments.notification', () => {
    let store

    beforeEach(() => {
        store = getTestActionStore()
        store.init()
    })

    describe('websocket', () => {
        const delay = 0
        let $rootScope

        beforeEach(inject((_$rootScope_) => {
            sinon.stub(assignmentNotifications, 'onAssignmentCreated').callsFake(
                () => (Promise.resolve())
            )
            sinon.stub(assignmentNotifications, 'onAssignmentUpdated').callsFake(
                () => (Promise.resolve())
            )
            $rootScope = _$rootScope_
            registerNotifications($rootScope, store)
            $rootScope.$digest()
        }))

        afterEach(() => {
            restoreSinonStub(assignmentNotifications.onAssignmentCreated)
            restoreSinonStub(assignmentNotifications.onAssignmentUpdated)
        })

        it('`assignment:created` calls onAssignmentCreated', (done) => {
            $rootScope.$broadcast('assignments:created', { item: 'p2' })

            setTimeout(() => {
                expect(assignmentNotifications.onAssignmentCreated.callCount).toBe(1)
                expect(assignmentNotifications.onAssignmentCreated.args[0][1])
                .toEqual({ item: 'p2' })

                done()
            }, delay)
        })

        it('`assignment:updated` calls onAssignmentUpdated', (done) => {
            $rootScope.$broadcast('assignments:updated', { item: 'p2' })

            setTimeout(() => {
                expect(assignmentNotifications.onAssignmentUpdated.callCount).toBe(1)
                expect(assignmentNotifications.onAssignmentUpdated.args[0][1])
                .toEqual({ item: 'p2' })

                done()
            }, delay)
        })
    })

    describe('`assignment:created`', () => {
        afterEach(() => {
            restoreSinonStub(assignmentsApi.query)
            restoreSinonStub(assignmentsApi.receivedAssignments)
            restoreSinonStub(assignmentsUi.setInList)
        })

        it('query assignments on create', (done) => {
            store.initialState.workspace.currentDeskId = 'desk1'
            let payload = {
                item: 'as1',
                assigned_desk: 'desk1',
            }
            sinon.stub(assignmentsApi, 'query').callsFake(() => (Promise.resolve({ _items: [] })))
            sinon.stub(assignmentsUi, 'setInList').callsFake(() => {})
            sinon.stub(assignmentsApi, 'receivedAssignments').callsFake(() => {})

            return store.test(done, assignmentNotifications.onAssignmentCreated({}, payload))
            .then(() => {
                expect(assignmentsApi.query.callCount).toBe(1)
                expect(assignmentsApi.receivedAssignments.callCount).toBe(1)
                expect(assignmentsUi.setInList.callCount).toBe(1)
                done()
            })
        })
    })

    describe('`assignment:update`', () => {
        afterEach(() => {
            restoreSinonStub(assignmentsUi.fetch)
        })

        it('update planning on assignment update', (done) => {
            store.initialState.workspace.currentDeskId = 'desk1'
            let payload = {
                item: 'as1',
                assigned_desk: 'desk2',
                assignment_state: 'foo',
                coverage: 'c1',
                planning: 'p1',
                original_assigned_desk: 'desk1',
            }
            const plans = selectors.getStoredPlannings(store.getState())
            const planning1 = plans[payload.planning]
            const coverage1 = planning1.coverages.find((cov) =>
                cov.coverage_id === payload.coverage)

            expect(coverage1.assigned_to.desk).toBe('desk1')
            expect(coverage1.assigned_to.state).toBe(undefined)
            sinon.stub(assignmentsUi, 'fetch').callsFake(() => Promise.resolve())

            return store.test(done, assignmentNotifications.onAssignmentUpdated({}, payload))
            .then(() => {
                expect(coverage1.assigned_to.desk).toBe('desk2')
                expect(coverage1.assigned_to.state).toBe('foo')
                expect(assignmentsUi.fetch.callCount).toBe(1)
                done()
            })
        })
    })
})
