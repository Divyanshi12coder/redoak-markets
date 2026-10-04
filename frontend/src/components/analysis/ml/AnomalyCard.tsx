import clsx from 'clsx'
import type { Anomalies } from '../../../types/api'
import { fmtDate, fmtNumber } from '../../../utils/format'

export function AnomalyCard({ anomalies }: { anomalies: Anomalies }) {
  const events = anomalies.events.slice(0, 5)
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Anomaly detection</h3>
      <div
        className={clsx(
          'mt-2 flex items-start gap-3 rounded-xl border p-4',
          anomalies.detected ? 'border-wine-200 bg-wine-50' : 'border-stone bg-paper/60',
        )}
      >
        <span
          aria-hidden="true"
          className={clsx('mt-1 size-2.5 shrink-0 rounded-full', anomalies.detected ? 'bg-wine-600' : 'bg-oak-500')}
        />
        <div>
          <p className="font-display text-lg font-semibold">{anomalies.headline}</p>
          <p className="mt-1 text-xs text-muted">{anomalies.note}</p>
        </div>
      </div>

      {anomalies.available && (
        <>
          {events.length > 0 ? (
            <div className="mt-3 overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[26rem] text-left text-xs">
                <caption className="mb-1 text-left text-muted">
                  Unusual sessions in the last {anomalies.window_sessions} trading days (robust z-score ≥ {anomalies.z_threshold})
                </caption>
                <thead className="text-muted">
                  <tr>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">Date</th>
                    <th scope="col" className="py-1.5 pr-3 font-semibold">Kind</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Return</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Vol z</th>
                    <th scope="col" className="py-1.5 text-right font-semibold">Range z</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.date} className="border-t border-stone/70">
                      <td className="py-1.5 pr-3">{fmtDate(e.date)}</td>
                      <td className="py-1.5 pr-3 capitalize">{e.kinds.join(', ')}</td>
                      <td className="tabular py-1.5 pr-3 text-right">{e.return_pct > 0 ? '+' : ''}{fmtNumber(e.return_pct, 2)}%</td>
                      <td className="tabular py-1.5 pr-3 text-right">{e.z_volume == null ? '--' : fmtNumber(e.z_volume, 1)}</td>
                      <td className="tabular py-1.5 text-right">{e.z_volatility == null ? '--' : fmtNumber(e.z_volatility, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">No unusual sessions in the last {anomalies.window_sessions} trading days.</p>
          )}
          <p className="mt-2 text-[11px] text-muted">Methods: {anomalies.methods.join(' + ')}.</p>
        </>
      )}
    </div>
  )
}
