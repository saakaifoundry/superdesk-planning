Feature: Cancel all coverage

    @auth
    @notification
    Scenario: Changes planning item state to `cancelled`
      When we post to "planning" with success
      """
      [{
          "guid": "123",
          "headline": "test headline",
          "slugline": "test slugline",
          "state": "scheduled",
          "pubstatus": "usable",
          "coverages": [{
              "planning": {
                  "ednote": "test coverage, 250 words",
                  "headline": "test headline",
                  "slugline": "test slugline",
                  "scheduled": "2029-11-21T14:00:00.000Z",
                  "g2_content_type": "text"
              }
          }]
      }]
      """
      When we perform cancel on planning "123"
      Then we get OK response
      And we get notifications
      """
      [{
          "event": "planning:created",
          "extra": {"item": "123"}
      },
      {
          "event": "planning:cancelled",
          "extra": {"item": "123","user": "#CONTEXT_USER_ID#"}
      }]
      """
      When we get "planning/#planning._id#"
      Then we get existing resource
      """
      {
          "guid": "123",
          "headline": "test headline",
          "slugline": "test slugline",
          "state": "cancelled",
          "pubstatus": "usable",
          "ednote": "------------------------------------------------------------\nPlanning cancelled\n"
      }
      """

    @auth
    @notification
    @vocabulary
    Scenario: Changes coverage status to `coverage not intended`
      Given "vocabularies"
      """
      [{
          "_id": "newscoveragestatus",
          "display_name": "News Coverage Status",
          "type": "manageable",
          "unique_field": "qcode",
          "items": [
              {"is_active": true, "qcode": "ncostat:int", "name": "coverage intended", "label": "Planned"},
              {"is_active": true, "qcode": "ncostat:notdec", "name": "coverage not decided yet",
                  "label": "On merit"},
              {"is_active": true, "qcode": "ncostat:notint", "name": "coverage not intended",
                  "label": "Not planned"},
              {"is_active": true, "qcode": "ncostat:onreq", "name": "coverage upon request",
                  "label": "On request"}
          ]
      }]
      """
      When we post to "planning" with success
      """
      [{
          "guid": "123",
          "headline": "test headline",
          "slugline": "test slugline",
          "state": "scheduled",
          "pubstatus": "usable",
          "coverages": [
              {
                  "planning": {
                      "ednote": "test coverage, 250 words",
                      "headline": "test headline",
                      "slugline": "test slugline",
                      "scheduled": "2029-11-21T14:00:00.000Z",
                      "g2_content_type": "text"
                  },
                  "news_coverage_status": {
                      "qcode": "ncostat:int",
                      "name": "coverage intended",
                      "label": "Planned"
                  }
              }
          ]
      }]
      """
      When we perform cancel on planning "123"
      Then we get OK response
      And we get notifications
      """
      [{
          "event": "planning:created",
          "extra": {"item": "123"}
      },
      {
          "event": "planning:cancelled",
          "extra": {"item": "123","user": "#CONTEXT_USER_ID#"}
      }]
      """
      When we get "planning/#planning._id#"
      Then we get existing resource
      """
      {
          "_id": "#planning._id#",
          "state": "cancelled",
          "pubstatus": "usable",
          "ednote": "------------------------------------------------------------\nPlanning cancelled\n",
          "coverages": [
              {
                  "coverage_id": "__any_value__",
                  "planning": {
                      "ednote": "test coverage, 250 words",
                      "g2_content_type": "text",
                      "internal_note" : "\n\n------------------------------------------------------------\nPlanning cancelled\n"
                  },
                  "news_coverage_status": {
                      "name" : "coverage not intended",
                      "qcode" : "ncostat:notint"
                  }
              }
          ]
      }
      """

    @auth
    @notification
    @vocabulary
    Scenario: Associated event remains unchanged
      Given "vocabularies"
      """
      [{
          "_id": "newscoveragestatus",
          "display_name": "News Coverage Status",
          "type": "manageable",
          "unique_field": "qcode",
          "items": [
              {"is_active": true, "qcode": "ncostat:int", "name": "coverage intended", "label": "Planned"},
              {"is_active": true, "qcode": "ncostat:notdec", "name": "coverage not decided yet",
                  "label": "On merit"},
              {"is_active": true, "qcode": "ncostat:notint", "name": "coverage not intended",
                  "label": "Not planned"},
              {"is_active": true, "qcode": "ncostat:onreq", "name": "coverage upon request",
                  "label": "On request"}
          ]
      },
      {
          "_id": "eventoccurstatus",
          "display_name": "Event Occurence Status",
          "type": "manageable",
          "unique_field": "qcode",
          "items": [
              {"is_active": true, "qcode": "eocstat:eos0", "name": "Unplanned event"},
              {"is_active": true, "qcode": "eocstat:eos1", "name": "Planned, occurence planned only"},
              {"is_active": true, "qcode": "eocstat:eos2", "name": "Planned, occurence highly uncertain"},
              {"is_active": true, "qcode": "eocstat:eos3", "name": "Planned, May occur"},
              {"is_active": true, "qcode": "eocstat:eos4", "name": "Planned, occurence highly likely"},
              {"is_active": true, "qcode": "eocstat:eos5", "name": "Planned, occurs certainly"},
              {"is_active": true, "qcode": "eocstat:eos6", "name": "Planned, then cancelled"}
          ]
        }]
      """
      Given "contacts"
      """
        [{"first_name": "Albert", "last_name": "Foo"}]
      """
      Given "events"
      """
      [
          {
              "guid": "789",
              "unique_id": "789",
              "unique_name": "789 name",
              "name": "event 789",
              "slugline": "event-789",
              "definition_short": "short value",
              "definition_long": "long value",
              "relationships":{
                  "broader": "broader value",
                  "narrower": "narrower value",
                  "related": "related value"
              },
              "dates": {
                  "start": "2016-01-02",
                  "end": "2016-01-03"
              },
              "subject": [{"qcode": "test qcaode", "name": "test name"}],
              "event_contact_info": ["#contacts._id#"],
              "occur_status": {
                  "name": "Planned, occurs certainly",
                  "qcode": "eocstat:eos5"
              },
              "state": "draft"
          }
      ]
      """
      When we get "events/#events._id#"
      Then we get existing resource
      """
      {
          "guid": "789",
          "unique_id": 789
      }
      """
      When we post to "planning" with success
      """
      [{
          "guid": "123",
          "headline": "test headline",
          "slugline": "test slugline",
          "event_item": "#events._id#",
          "state": "scheduled",
          "pubstatus": "usable",
          "coverages": [
              {
                  "planning": {
                      "ednote": "test coverage, 250 words",
                      "headline": "test headline",
                      "slugline": "test slugline",
                      "scheduled": "2029-11-21T14:00:00.000Z",
                      "g2_content_type": "text"
                  },
                  "news_coverage_status": {
                      "qcode": "ncostat:int",
                      "name": "coverage intended",
                      "label": "Planned"
                  }
              }
          ]
      }]
      """
      When we perform cancel on planning "123"
      Then we get OK response
      When we get "events/#events._id#"
      Then we get existing resource
      """
      {
          "guid": "789",
          "unique_id": 789,
          "unique_name": "789 name",
          "name": "event 789",
          "slugline": "event-789",
          "definition_short": "short value",
          "definition_long": "long value",
          "relationships":{
              "broader": "broader value",
              "narrower": "narrower value",
              "related": "related value"
          },
          "dates": {
              "start": "2016-01-02T00:00:00+0000",
              "end": "2016-01-03T00:00:00+0000"
          },
          "subject": [{"qcode": "test qcaode", "name": "test name"}],
          "event_contact_info": ["#contacts._id#"],
          "occur_status": {
              "name": "Planned, occurs certainly",
              "qcode": "eocstat:eos5"
          },
          "state": "draft"
      }
      """

    @auth
    @notification
    Scenario: Changes coverage status on cancel all coverage
      Given "vocabularies"
      """
      [{
          "_id": "newscoveragestatus",
          "display_name": "News Coverage Status",
          "type": "manageable",
          "unique_field": "qcode",
          "items": [
              {"is_active": true, "qcode": "ncostat:int", "name": "coverage intended", "label": "Planned"},
              {"is_active": true, "qcode": "ncostat:notdec", "name": "coverage not decided yet",
                  "label": "On merit"},
              {"is_active": true, "qcode": "ncostat:notint", "name": "coverage not intended",
                  "label": "Not planned"},
              {"is_active": true, "qcode": "ncostat:onreq", "name": "coverage upon request",
                  "label": "On request"}
          ]
      }]
      """
      When we post to "planning" with success
      """
      [{
          "guid": "123",
          "headline": "test headline",
          "slugline": "test slugline",
          "state": "scheduled",
          "pubstatus": "usable",
          "ednote": "something happened",
          "coverages": [
              {
                  "planning": {
                      "ednote": "test coverage, 250 words",
                      "g2_content_type": "text"
                  },
                  "news_coverage_status": {
                      "qcode": "ncostat:int",
                      "name": "coverage intended",
                      "label": "Planned"
                  }
              },
              {
                  "planning": {
                      "ednote": "test coverage2, 250 words",
                      "g2_content_type": "text"
                  },
                  "news_coverage_status": {
                      "qcode": "ncostat:int",
                      "name": "coverage intended",
                      "label": "Planned"
                  }
              }
          ]
      }]
      """
      Then we get OK response
      Then we store coverage id in "firstcoverage" from coverage 0
      Then we store coverage id in "secondcoverage" from coverage 1
      When we perform cancel on planning "123"
      """
      { "cancel_all_coverage": true }
      """
      Then we get OK response
      And we get notifications
      """
      [{
          "event": "planning:created",
          "extra": {"item": "123"}
      },
      {
          "event": "coverage:cancelled",
          "extra": {"planning_item": "123","ids": ["#firstcoverage#", "#secondcoverage#"]}
      }]
      """
      When we get "/planning/#planning._id#"
      Then we get existing resource
      """
      {
          "_id": "#planning._id#",
          "headline": "test headline",
          "slugline": "test slugline",
          "state": "scheduled",
          "pubstatus": "usable",
          "ednote": "something happened",
          "coverages":       [
              {
                  "planning": {
                      "ednote": "test coverage, 250 words",
                      "g2_content_type": "text",
                      "internal_note" : "\n\n------------------------------------------------------------\nCoverage cancelled\n"
                  },
                  "news_coverage_status": {
                      "qcode" : "ncostat:notint"
                  }
              },
              {
                  "planning": {
                      "ednote": "test coverage2, 250 words",
                      "g2_content_type": "text",
                      "internal_note" : "\n\n------------------------------------------------------------\nCoverage cancelled\n"
                  },
                  "news_coverage_status": {
                      "qcode" : "ncostat:notint"
                  }
              }
          ]
      }
      """