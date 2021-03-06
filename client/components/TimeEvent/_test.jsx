import React from 'react'
import { mount } from 'enzyme'
import { TimeEvent } from '../index'
import moment from 'moment'
import { createTestStore } from '../../utils'
import { Provider } from 'react-redux'


describe('<TimeEvent />', () => {

    function renderToText(event) {
        const store = createTestStore()
        const wrapper = mount(
            <Provider store={store}>
                <TimeEvent event={event}/>
            </Provider>
        )
        return wrapper.text()
    }

    it('renders an event', () => {
        const event = {
            dates: {
                start: moment('2016-10-15T13:01:00+0000'),
                end: moment('2016-10-15T14:01:00+0000'),
            },
        }
        expect(renderToText(event)).toBe(
            moment(event.dates.start).format('HH:mm') + ' - ' +
            moment(event.dates.end).format('HH:mm')
        )
    })

    it('renders a full day event', () => {
        const event = {
            dates: {
                start: moment('2016-10-15T00:00:00'),
                end: moment('2016-10-15T23:59:00'),
                tz: 'Europe/Berlin',
            },
        }
        expect(renderToText(event)).toBe('All day')
    })

    it('renders an event that ends on another day', () => {
        const event = {
            dates: {
                start: moment('2016-10-15T08:00:00+0000'),
                end: moment('2016-10-16T11:00:00+0000'),
            },
        }
        expect(renderToText(event)).toBe(
            moment(event.dates.start).format('DD/MM/YYYY') + ' - ' +
            moment(event.dates.end).format('DD/MM/YYYY')
        )
    })

    it('renders repeat icon for recurring events', () => {
        const event = {
            dates: {
                start: moment('2016-10-15T08:00:00+0000'),
                end: moment('2016-10-16T11:00:00+0000'),
            },
        }
        const store = createTestStore()
        let wrapper = mount(
            <Provider store={store}>
                <TimeEvent event={event}/>
            </Provider>
        )
        expect(wrapper.find('.icon-repeat').length).toBe(0)

        event.recurrence_id = 'rec1'
        wrapper = mount(
            <Provider store={store}>
                <TimeEvent event={event}/>
            </Provider>
        )
        expect(wrapper.find('.icon-repeat').length).toBe(1)
    })
})
