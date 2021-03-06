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


planning_postpone_schema = deepcopy(planning_schema)
planning_postpone_schema['reason'] = {
    'type': 'string',
    'nullable': True
}


class PlanningPostponeResource(PlanningResource):
    url = 'planning/postpone'
    resource_title = endpoint_name = 'planning_postpone'

    datasource = {'source': 'planning'}
    resource_methods = []
    item_methods = ['PATCH']
    privileges = {'PATCH': 'planning_planning_management'}
    internal_resource = True

    schema = planning_postpone_schema


class PlanningPostponeService(BaseService):
    def update(self, id, updates, original):
        self._postpone_plan(updates, original)
        updates['coverages'] = deepcopy(original.get('coverages'))
        coverages = updates.get('coverages') or []

        for coverage in coverages:
            self._postpone_coverage(updates, coverage)

        reason = updates.get('reason', None)
        if 'reason' in updates:
            del updates['reason']

        item = self.backend.update(self.datasource, id, updates, original)

        user = get_user(required=True).get(config.ID_FIELD, '')
        session = get_auth().get(config.ID_FIELD, '')

        push_notification(
            'planning:postponed',
            item=str(original[config.ID_FIELD]),
            user=str(user),
            session=str(session),
            reason=reason
        )

        return item

    def _postpone_plan(self, updates, original):
        ednote = '''------------------------------------------------------------
Event Postponed
'''
        if updates.get('reason', None) is not None:
            ednote += 'Reason: {}\n'.format(updates['reason'])

        if 'ednote' in original:
            ednote = original['ednote'] + '\n\n' + ednote

        updates['ednote'] = ednote
        updates[ITEM_STATE] = WORKFLOW_STATE.POSTPONED

    def _postpone_coverage(self, updates, coverage):
        note = '''------------------------------------------------------------
Event has been postponed
'''
        if updates.get('reason', None) is not None:
            note += 'Reason: {}\n'.format(updates['reason'])

        if not coverage.get('planning'):
            coverage['planning'] = {}

        coverage['planning']['internal_note'] = (coverage['planning'].get('internal_note') or '') + '\n\n' + note
