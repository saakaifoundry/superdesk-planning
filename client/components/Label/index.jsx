/* eslint-disable react/no-multi-comp */
import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'

export const Label = ({ text, iconType, verbose, isHollow, tooltip }) => {
    const labelClasses = classNames('label',
    `label--${iconType}`,
    { 'label--hollow': isHollow })

    const label = (
        <span className={labelClasses}>
            {verbose ? verbose : text}
        </span>
    )

    return (
        <span>
            {tooltip &&
                <span
                    data-sd-tooltip={tooltip.text}
                    data-flow={tooltip.flow ? tooltip.flow : 'down'}>
                    {label}
                </span>
            }
            {!tooltip && label}
        </span>
    )
}

Label.propTypes = {
    text: PropTypes.string.isRequired,
    iconType: PropTypes.string,
    isHollow: PropTypes.bool,
    tooltip: PropTypes.object,
    verbose: PropTypes.string,
}

Label.defaultProps = {
    iconType: 'draft',
    isHollow: true,
    tooltip: undefined,
}