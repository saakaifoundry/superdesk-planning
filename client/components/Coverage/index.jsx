import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { EditAssignment, CoverageDetails } from '../../components'
import * as selectors from '../../selectors'
import { Field, formValueSelector } from 'redux-form'
import './style.scss'

function CoverageComponent({
    coverage,
    users,
    desks,
    readOnly,
    content_type,
    formProfile,
    keywords,
    coverageProviders,
    currentUserId,
    assignmentPriorities,
    }) {
    return (
        <fieldset>
            <Field
                name={`${coverage}.assigned_to`}
                component={EditAssignment}
                users={users}
                currentUserId={currentUserId}
                desks={desks}
                coverageProviders={coverageProviders}
                readOnly={readOnly}
                assignmentPriorities={assignmentPriorities}
                context="coverage" />
            <CoverageDetails
                coverage={coverage}
                formProfile={formProfile}
                readOnly={readOnly}
                content_type={content_type}
                keywords={keywords} />
        </fieldset>
    )
}

CoverageComponent.propTypes = {
    coverage: PropTypes.string.isRequired,
    content_type: PropTypes.string,
    users: PropTypes.array.isRequired,
    desks: PropTypes.array.isRequired,
    coverageProviders: PropTypes.array,
    readOnly: PropTypes.bool,
    formProfile: PropTypes.object,
    keywords: PropTypes.array,
    currentUserId: PropTypes.string,
    assignmentPriorities: PropTypes.array,
}

const selector = formValueSelector('planning') // same as form name
const mapStateToProps = (state, ownProps) => ({
    users: selectors.getUsers(state),
    currentUserId: selectors.getCurrentUserId(state),
    desks: selectors.getDesks(state),
    coverageProviders: selectors.getCoverageProviders(state),
    content_type: selector(state, ownProps.coverage + '.planning.g2_content_type'),
    formProfile: selectors.getCoverageFormsProfile(state),
    keywords: selectors.getKeywords(state),
    assignmentPriorities: selectors.getAssignmentPriorities(state),
})

export const Coverage = connect(mapStateToProps)(CoverageComponent)
