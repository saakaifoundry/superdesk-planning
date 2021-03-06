
from flask import abort
from eve.utils import config

from superdesk import get_resource_service
from superdesk.resource import Resource
from superdesk.services import BaseService
from apps.publish.enqueue import get_enqueue_service
from superdesk.notification import push_notification

from .events import EventsResource
from .common import WORKFLOW_STATE, PUBLISHED_STATE, published_state


class EventsPublishResource(EventsResource):
    schema = {
        'event': Resource.rel('events', type='string', required=True),
        'etag': {'type': 'string', 'required': True},
        'pubstatus': {'type': 'string', 'required': True, 'allowed': published_state},
    }

    url = 'events/publish'
    resource_title = endpoint_name = 'events_publish'
    resource_methods = ['POST']
    privileges = {'POST': 'planning_event_publish'}
    item_methods = []


class EventsPublishService(BaseService):
    def create(self, docs):
        ids = []
        for doc in docs:
            event = get_resource_service('events').find_one(req=None, _id=doc['event'], _etag=doc['etag'])
            if event:
                event['pubstatus'] = doc['pubstatus']
                self.validate_event(event)
                self.publish_event(event)
                ids.append(doc['event'])
            else:
                abort(412)
        return ids

    def validate_event(self, event):
        try:
            assert event.get('pubstatus') in published_state
        except AssertionError:
            abort(409)

    def publish_event(self, event):
        event.setdefault(config.VERSION, 1)
        event.setdefault('item_id', event['_id'])
        get_enqueue_service('publish').enqueue_item(event, 'event')
        updates = {'state': self._get_publish_state(event), 'pubstatus': event['pubstatus']}
        updatedEvent = get_resource_service('events').update(event['_id'], updates, event)
        get_resource_service('events_history')._save_history(event, updates, 'publish')

        event_type = 'events:published'
        if updatedEvent['state'] == WORKFLOW_STATE.KILLED:
            event_type = 'events:unpublished'

        push_notification(
            event_type,
            item=event[config.ID_FIELD],
            etag=updatedEvent['_etag'],
            pubstatus=updatedEvent['pubstatus'],
            state=updatedEvent['state']
        )

    def _get_publish_state(self, event):
        if event.get('pubstatus') == PUBLISHED_STATE.CANCELLED:
            return WORKFLOW_STATE.KILLED
        return WORKFLOW_STATE.SCHEDULED
