import clsx from 'clsx'
import type { Evaluation, MlAnalysisResponse } from '../../../types/api'
import { fmtNumber } from '../../../utils/format'

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2" title={hint}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular font-display text-lg font-semibold">{value}</p>
    </div>
  )
}

export function ConfusionMatrix({ ev }: { ev: Evaluation }) {
  const { labels, matrix } = ev.confusion_matrix
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="tabular w-full min-w-[20rem] text-center text-sm">
        <caption className="sr-only">Confusion matrix of out-of-sample predictions: rows are actual classes, columns are predicted classes</caption>
        <thead>
          <tr>
            <th className="p-1 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">Actual ↓ / Predicted →</th>
            {labels.map((l) => (
              <th key={l} scope="col" className="p-1 text-xs font-semibold capitalize text-muted">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const total = row.reduce((a, b) => a + b, 0) || 1
            return (
              <tr key={labels[i]}>
                <th scope="row" className="p-1 text-left text-xs font-semibold capitalize text-muted">{labels[i]}</th>
                {row.map((n, j) => {
                  const share = n / total
                  const diagonal = i === j
                  return (
                    <td key={j} className="p-1">
                      <div
                        className={clsx('rounded-md py-2 font-semibold', share > 0.5 && diagonal ? 'text-white' : 'text-ink')}
                        style={{ background: diagonal ? `rgba(29,93,63,${0.08 + share * 0.9})` : `rgba(154,38,57,${0.04 + share * 0.5})` }}
                      >
                        {n}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Honest model report card: metrics, a naive baseline and plain-language caveats. */
export function ModelEvaluation({ ml }: { ml: MlAnalysisResponse }) {
  const ev = ml.evaluation
  const edge = ev.accuracy - ev.baseline_accuracy
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">Model evaluation (out-of-sample)</h3>
      <p className="mt-1 text-xs text-muted">
        {ev.validation}. Scored on {ev.n_test_samples.toLocaleString()} sessions the model had not seen when predicting them.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Accuracy" value={fmtNumber(ev.accuracy, 3)} />
        <Metric label="Precision" value={fmtNumber(ev.precision_macro, 3)} hint="Macro-averaged across bearish / neutral / bullish" />
        <Metric label="Recall" value={fmtNumber(ev.recall_macro, 3)} hint="Macro-averaged across bearish / neutral / bullish" />
        <Metric label="F1" value={fmtNumber(ev.f1_macro, 3)} hint="Macro-averaged across bearish / neutral / bullish" />
        <Metric label="ROC-AUC" value={ev.roc_auc_ovr == null ? '--' : fmtNumber(ev.roc_auc_ovr, 3)} hint="One-vs-rest, macro. 0.5 = no better than chance" />
        <Metric label="Baseline" value={fmtNumber(ev.baseline_accuracy, 3)} hint="Always predicting the most common class in the training window" />
      </div>

      <div
        className={clsx(
          'mt-3 rounded-xl border p-3 text-sm',
          ev.beats_baseline ? 'border-oak-200 bg-oak-50 text-oak-900' : 'border-wine-200 bg-wine-50 text-wine-900',
        )}
      >
        {ev.beats_baseline ? (
          <>
            On this stock’s history the model scored <b>{fmtNumber(edge * 100, 1)} pp</b> above a naive “always predict the usual class” baseline.
            That is a <b>historical, in-sample-period result</b> - not evidence of future accuracy.
          </>
        ) : (
          <>
            <b>No historical edge detected.</b> The model did not beat a naive baseline on this stock ({fmtNumber(ev.accuracy, 3)} vs {fmtNumber(ev.baseline_accuracy, 3)}),
            so its classification should carry very little weight. Reporting this plainly is intentional.
          </>
        )}
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Confusion matrix</p>
          <ConfusionMatrix ev={ev} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Accuracy by validation fold</p>
          <div className="relative h-24" role="img" aria-label={`Accuracy per fold: ${ev.fold_accuracy.join(', ')}. Naive baseline ${ev.baseline_accuracy}.`}>
            <div className="flex h-full items-end gap-2">
              {ev.fold_accuracy.map((a, i) => (
                <div key={i} className="flex h-full flex-1 flex-col justify-end">
                  <div className="w-full rounded-t bg-oak-300" style={{ height: `${Math.max(4, a * 100)}%` }} />
                </div>
              ))}
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-wine-500"
              style={{ bottom: `${ev.baseline_accuracy * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="tabular mt-1 flex gap-2 text-[10px] text-muted" aria-hidden="true">
            {ev.fold_accuracy.map((a, i) => (
              <span key={i} className="flex-1 text-center">{fmtNumber(a, 2)}</span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">Dashed line = naive baseline. Fold-to-fold swings show how unstable performance is across market periods.</p>
        </div>
      </div>

      <details className="mt-4 rounded-xl bg-oak-50 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-oak-800">Model details &amp; limitations</summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div><dt className="inline font-semibold">Version: </dt><dd className="inline tabular">{ml.model.version}</dd></div>
          <div><dt className="inline font-semibold">Algorithm: </dt><dd className="inline">{ml.model.algorithm}</dd></div>
          <div><dt className="inline font-semibold">Trained through: </dt><dd className="inline">{ml.model.trained_through}</dd></div>
          <div><dt className="inline font-semibold">Training samples: </dt><dd className="inline">{ml.model.n_training_samples.toLocaleString()}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-muted">
          <b>Target:</b> {ml.model.target_definition} <b>Leakage controls:</b> features use only past data, splits are chronological (never shuffled) with a
          {` ${ml.model.horizon_days}`}-session embargo between training and test windows.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>Historical back-testing cannot capture regime changes, news, liquidity shocks or transaction costs.</li>
          <li>One stock’s history is a small sample; metrics can look better or worse by chance.</li>
          <li>The model is retrained per stock on demand, so results are not a fixed, audited system.</li>
        </ul>
      </details>
    </div>
  )
}
