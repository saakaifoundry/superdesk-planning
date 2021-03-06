# -*- coding: utf-8; -*-
#
# This file is part of Superdesk.
#
# Copyright 2013, 2014 Sourcefabric z.u. and contributors.
#
# For the full copyright and license information, please see the
# AUTHORS and LICENSE files distributed with this source code, or
# at https://www.sourcefabric.org/superdesk/license

from superdesk.services import BaseService
from superdesk.notification import push_notification
from apps.archive.common import get_user, get_auth
from eve.utils import config
from copy import deepcopy
from .planning import PlanningResource, planning_schema
from .common import WORKFLOW_STATE, ITEM_STATE


planning_reschedule_schema = deepcopy(planning_schema)
planning_reschedule_schema['reason'] = {
    'type': 'string',
    'nullable': True
}


class PlanningRescheduleResource(PlanningResource):
    url = 'planning/reschedule'
    resource_title = endpoint_name = 'planning_reschedule'

    datasource = {'source': 'planning'}
    resource_methods = []
    item_methods = ['PATCH']
    privileges = {'PATCH': 'planning_planning_management'}
    internal_resource = True

    schema = planning_reschedule_schema


class PlanningRescheduleService(BaseService):
    def update(self, id, updates, original):
        reason = updates.pop('reason', None)
        self._reschedule_plan(updates, original, reason)

        updates['coverages'] = deepcopy(original.get('coverages'))
        coverages = updates.get('coverages') or []

        for coverage in coverages:
            self._reschedule_coverage(coverage, reason)

        return self.backend.update(self.datasource, id, updates, original)

    def on_updated(self, updates, original):
        user = get_user(required=True).get(config.ID_FIELD, '')
        session = get_auth().get(config.ID_FIELD, '')

        push_notification(
            'planning:rescheduled',
            item=str(original[config.ID_FIELD]),
            user=str(user),
            session=str(session)
        )

    def _reschedule_plan(self, updates, original, reason):
        ednote = '''------------------------------------------------------------
Event Rescheduled
'''
        if reason:
            ednote += 'Reason: {}\n'.format(reason)

        if 'ednote' in original:
            ednote = original['ednote'] + '\n\n' + ednote

        updates['ednote'] = ednote

        if updates.get(ITEM_STATE) == WORKFLOW_STATE.DRAFT and original.get('pubstatus'):
            updates[ITEM_STATE] = WORKFLOW_STATE.SCHEDULED
        else:
            updates[ITEM_STATE] = updates.get(ITEM_STATE) or WORKFLOW_STATE.RESCHEDULED

    def _reschedule_coverage(self, coverage, reason):
        note = '''------------------------------------------------------------
Event has been rescheduled
'''
        if reason:
            note += 'Reason: {}\n'.format(reason)

        if not coverage.get('planning'):
            coverage['planning'] = {}

        coverage['planning']['internal_note'] = (coverage['planning'].get('internal_note') or '') + '\n\n' + note
