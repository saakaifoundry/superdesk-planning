Feature: Events Postpone

    @auth
    @notification
    @vocabulary
    Scenario: Changes state to `postponed`
        Given "events"
        """
        [{
            "_id": "event1",
            "guid": "event1",
            "name": "TestEvent",
            "dates": {
                "start": "2029-11-21T12:00:00.000Z",
                "end": "2029-11-21T14:00:00.000Z",
                "tz": "Australia/Sydney"
            },
            "state": "draft",
            "lock_user": "#CONTEXT_USER_ID#",
            "lock_session": "session123"
        }]
        """
        When we perform postpone on events "event1"
        Then we get OK response
        And we get notifications
        """
        [{
            "event": "events:created",
            "extra": {"item": "event1"}
        },
        {
            "event": "events:postponed",
            "extra": {"item": "event1","user": "#CONTEXT_USER_ID#"}
        }]
        """
        When we get "/events"
        Then we get a list with 1 items
        """
        {"_items": [{
            "_id": "event1",
            "state": "postponed",
            "lock_user": null,
            "lock_session": null
        }]}
        """
        When we get "/events_history?where=event_id==%22event1%22"
        Then we get list with 1 items
        """
        {"_items": [{
            "event_id": "event1",
            "operation": "postpone",
            "update": {"state": "postponed"}
        }]}
        """

    @auth
    @notification
    @vocabulary
    Scenario: Postponing an Event also postpones associated Planning items
        Given "events"
        """
        [{
            "_id": "event1",
            "guid": "event1",
            "name": "TestEvent",
            "dates": {
                "start": "2029-11-21T12:00:00.000Z",
                "end": "2029-11-21T14:00:00.000Z",
                "tz": "Australia/Sydney"
            },
            "state": "draft"
        }]
        """
        Given "planning"
        """
        [{
            "_id": "plan1",
            "guid": "plan1",
            "slugline": "TestPlan 1",
            "event_item": "event1",
            "state": "draft"
        },
        {
            "_id": "plan2",
            "guid": "plan2",
            "slugline": "TestPlan 2",
            "event_item": "event1",
            "state": "draft"
        }]
        """
        When we perform postpone on events "event1"
        Then we get OK response
        And we get notifications
        """
        [{
            "event": "events:created",
            "extra": {"item": "event1"}
        },
        {
            "event": "planning:created",
            "extra": {"item": "plan1"}
        },
        {
            "event": "planning:created",
            "extra": {"item": "plan2"}
        },
        {
            "event": "events:postponed",
            "extra": {"item": "event1", "user": "#CONTEXT_USER_ID#"}
        },
        {
            "event": "planning:postponed",
            "extra": {"item": "plan1", "user": "#CONTEXT_USER_ID#"}
        },
        {
            "event": "planning:postponed",
            "extra": {"item": "plan2", "user": "#CONTEXT_USER_ID#"}
        }]
        """
        When we get "/events"
        Then we get a list with 1 items
        """
        {"_items": [{
            "_id": "event1",
            "state": "postponed"
        }]}
        """
        When we get "/planning"
        Then we get a list with 2 items
        """
        {"_items": [
            {
                "_id": "plan1",
                "state": "postponed"
            },
            {
                "_id": "plan2",
                "state": "postponed"
            }
        ]}
        """
        When we get "/events_history"
        Then we get list with 3 items
        """
        {"_items": [
            {
                "event_id": "event1",
                "operation": "planning created",
                "update": {"planning_id": "plan1"}
            },
            {
                "event_id": "event1",
                "operation": "planning created",
                "update": {"planning_id": "plan2"}
            },
            {
                "event_id": "event1",
                "operation": "postpone",
                "update": {"state": "postponed"}
            }
        ]}
        """
        When we get "/planning_history"
        Then we get list with 2 items
        """
        {"_items": [
            {
                "planning_id": "plan1",
                "operation": "postpone",
                "update": {"state": "postponed"}
            },
            {
                "planning_id": "plan2",
                "operation": "postpone",
                "update": {"state": "postponed"}
            }
        ]}
        """

    @auth
    @notification
    @vocabulary
    Scenario: Postponing a series of recurring Events
        When we post to "events"
        """
        [{
            "name": "Friday Club",
            "dates": {
                "start": "2099-11-21T12:00:00.000Z",
                "end": "2099-11-21T14:00:00.000Z",
                "tz": "Australia/Sydney",
                "recurring_rule": {
                    "frequency": "DAILY",
                    "interval": 1,
                    "count": 4,
                    "endRepeatMode": "count"
                }
            },
            "state": "draft"
        }]
        """
        Then we get OK response
        Then we store "EVENT1" with first item
        Then we store "EVENT2" with 2 item
        Then we store "EVENT3" with 3 item
        Then we store "EVENT4" with 4 item
        When we post to "planning"
        """
        [{
            "slugline": "Weekly Meetings",
            "headline": "Friday Club",
            "event_item": "#EVENT3._id#"
        }]
        """
        Then we get OK response
        When we perform postpone on events "#EVENT3._id#"
        """
        {"update_method": "all"}
        """
        Then we get OK response
        When we get "/events"
        Then we get list with 4 items
        """
        {"_items": [
            { "_id": "#EVENT1._id#", "state": "postponed" },
            { "_id": "#EVENT2._id#", "state": "postponed" },
            { "_id": "#EVENT3._id#", "state": "postponed" },
            { "_id": "#EVENT4._id#", "state": "postponed" }
        ]}
        """

    @auth
    @notification
    @vocabulary
    Scenario: Postponing future events in a series of recurring Events
        When we post to "events"
        """
        [{
            "name": "Friday Club",
            "dates": {
                "start": "2099-11-21T12:00:00.000Z",
                "end": "2099-11-21T14:00:00.000Z",
                "tz": "Australia/Sydney",
                "recurring_rule": {
                    "frequency": "DAILY",
                    "interval": 1,
                    "count": 5,
                    "endRepeatMode": "count"
                }
            },
            "state": "draft"
        }]
        """
        Then we get OK response
        Then we store "EVENT1" with first item
        Then we store "EVENT2" with 2 item
        Then we store "EVENT3" with 3 item
        Then we store "EVENT4" with 4 item
        Then we store "EVENT5" with 5 item
        When we post to "planning"
        """
        [{
            "slugline": "Weekly Meetings",
            "headline": "Friday Club",
            "event_item": "#EVENT3._id#"
        }]
        """
        Then we get OK response
        When we perform postpone on events "#EVENT3._id#"
        """
        {"update_method": "future"}
        """
        Then we get OK response
        When we get "/events"
        Then we get list with 5 items
        """
        {"_items": [
            { "_id": "#EVENT1._id#", "state": "draft" },
            { "_id": "#EVENT2._id#", "state": "draft" },
            { "_id": "#EVENT3._id#", "state": "postponed" },
            { "_id": "#EVENT4._id#", "state": "postponed" },
            { "_id": "#EVENT5._id#", "state": "postponed" }
        ]}
        """

    @auth
    @notification
    @vocabulary
    Scenario: Postponing an Event sets item notes
        Given "events"
        """
        [{
            "_id": "event1",
            "guid": "event1",
            "name": "TestEvent",
            "dates": {
                "start": "2029-11-21T12:00:00.000Z",
                "end": "2029-11-21T14:00:00.000Z",
                "tz": "Australia/Sydney"
            },
            "definition_long":  "An event with exciting things",
            "occur_status": {
                "qcode": "eocstat:eos5",
                "name": "Planned, occurs certainly"
            },
            "state": "draft"
        }]
        """
        Given "planning"
        """
        [{
            "_id": "plan1",
            "guid": "plan1",
            "slugline": "TestPlan 1",
            "event_item": "event1",
            "ednote": "We're covering this Event",
            "state": "draft",
            "coverages": [{
                "coverage_id": "cov1",
                "slugline": "TestCoverage 1",
                "planning": {
                    "internal_note": "Cover something please!"
                },
                "planning_item": "plan1",
                "news_coverage_status": {
                    "qcode": "ncostat:int",
                    "name": "Coverage intended"
                }
            }]
        }]
        """
        When we perform postpone on events "event1"
        """
        {"reason": "Not happening anymore!"}
        """
        Then we get OK response
        When we get "/events"
        Then we get a list with 1 items
        """
        {"_items":[{
            "_id": "event1",
            "state": "postponed",
            "definition_long": "An event with exciting things\n\n------------------------------------------------------------\nEvent Postponed\nReason: Not happening anymore!\n"
        }]}
        """
        When we get "/planning"
        Then we get a list with 1 items
        """
        {"_items": [{
            "_id": "plan1",
            "state": "postponed",
            "ednote": "We're covering this Event\n\n------------------------------------------------------------\nEvent Postponed\nReason: Not happening anymore!\n",
            "coverages": [{
                "coverage_id": "cov1",
                "planning": {
                    "internal_note": "Cover something please!\n\n------------------------------------------------------------\nEvent has been postponed\nReason: Not happening anymore!\n"
                }
            }]
        }]}
        """
