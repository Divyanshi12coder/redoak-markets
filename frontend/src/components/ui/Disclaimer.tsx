import clsx from 'clsx'
import { DISCLAIMER, ML_DISCLAIMER } from '../../utils/format'
import { Icon } from './Icon'

export function Disclaimer({ ml, className, dark }: { ml?: boolean; className?: string; dark?: boolean }) {
  return (
    <p
      className={clsx(
        'flex items-start gap-2 text-xs leading-relaxed',
        dark ? 'text-oak-200' : 'text-muted',
        className,
      )}
    >
      <Icon name="info" size={14} className="mt-0.5 shrink-0" />
      <span>{ml ? `${ML_DISCLAIMER} ${DISCLAIMER}` : DISCLAIMER}</span>
    </p>
  )
}
