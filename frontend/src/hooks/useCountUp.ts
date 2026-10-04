import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/** Animates a number towards `target`; jumps straight there for reduced-motion users. */
export function useCountUp(target: number | null | undefined, duration = 0.9): number | null {
  const reduce = useReducedMotion()
  const [value, setValue] = useState<number | null>(target ?? null)
  const from = useRef(0)

  useEffect(() => {
    if (target == null) {
      setValue(null)
      return
    }
    if (reduce) {
      setValue(target)
      return
    }
    const controls = animate(from.current, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => {
        from.current = v
        setValue(v)
      },
    })
    return () => controls.stop()
  }, [target, duration, reduce])

  return value
}
