# This file is part of Superdesk.
#
# Copyright 2013, 2014, 2015, 2016, 2017 Sourcefabric z.u. and contributors.
#
# For the full copyright and license information, please see the
# AUTHORS and LICENSE files distributed with this source code, or
# at https://www.sourcefabric.org/superdesk/license
from copy import deepcopy
from superdesk import Resource, Service, get_resource_service
from superdesk.errors import SuperdeskApiError
from eve.utils import config
from .common import ASSIGNMENT_WORKFLOW_STATE
from apps.content import push_content_notification


class AssignmentsUnlinkService(Service):
    def on_create(self, docs):
        for doc in docs:
            self._validate(doc)

    def create(self, docs):
        ids = []
        production = get_resource_service('archive')
        assignments_service = get_resource_service('assignments')
        items = []

        for doc in docs:
            assignment = assignments_service.find_one(req=None, _id=doc.pop('assignment_id'))
            item = production.find_one(req=None, _id=doc.pop('item_id'))

            # Set the state to 'assigned' if the item is 'submitted'
            updates = {'assigned_to': deepcopy(assignment.get('assigned_to'))}
            updates['assigned_to']['state'] = ASSIGNMENT_WORKFLOW_STATE.ASSIGNED
            assignments_service.patch(assignment[config.ID_FIELD], updates)

            production.system_update(
                item[config.ID_FIELD],
                {'assignment_id': None},
                item
            )

            get_resource_service('delivery').delete_action(lookup={
                'assignment_id': assignment[config.ID_FIELD],
                'item_id': item[config.ID_FIELD]
            })

            doc.update(item)
            ids.append(doc[config.ID_FIELD])
            items.append(item)

        push_content_notification(items)
        return ids

    def _validate(self, doc):
        assignment = get_resource_service('assignments').find_one(
            req=None,
            _id=doc.get('assignment_id')
        )

        if not assignment:
            raise SuperdeskApiError.badRequestError('Assignment not found.')

        if assignment.get('assigned_to', {}).get('state') == ASSIGNMENT_WORKFLOW_STATE.COMPLETED:
            raise SuperdeskApiError.badRequestError('Assignment already completed.')

        item = get_resource_service('archive').find_one(
            req=None,
            _id=doc.get('item_id')
        )

        if not item:
            raise SuperdeskApiError.badRequestError('Content item not found.')

        if not item.get('assignment_id'):
            raise SuperdeskApiError.badRequestError(
                'Content not linked to an assignment. Cannot unlink assignment and content.'
            )

        if str(item.get('assignment_id')) != str(assignment.get(config.ID_FIELD)):
            raise SuperdeskApiError.badRequestError(
                'Assignment and Content are not linked.'
            )

        delivery = get_resource_service('delivery').find_one(
            req=None,
            assignment_id=assignment[config.ID_FIELD]
        )

        if not delivery or delivery.get('item_id') != doc.get('item_id'):
            raise SuperdeskApiError.badRequestError(
                'Content doesnt exist for the assignment. Cannot unlink assignment and content.'
            )


class AssignmentsUnlinkResource(Resource):
    endpoint_name = resource_title = 'assignments_unlink'
    url = 'assignments/unlink'
    schema = {
        'assignment_id': {
            'type': 'string',
            'required': True
        },
        'item_id': {
            'type': 'string',
            'required': True
        }
    }

    resource_methods = ['POST']
    item_methods = []

    privileges = {'POST': 'archive'}
