import type { Scoring, Template } from '../../shared/types';

export function defaultScoring(t: Template): Scoring {
  return { points: t.rounds.map((r) => r.points), seriesBonus: t.rounds.some((r) => r.bestOf > 1) ? 5 : 0 };
}

export function ScoringEditor({ template, value, onChange }: { template: Template; value: Scoring; onChange: (s: Scoring) => void }) {
  const hasSeries = template.rounds.some((r) => r.bestOf > 1);
  const perRoundMax = template.rounds.map((_, i) => template.matches.filter((m) => m.round === i).length * (value.points[i] ?? 0));
  const total = perRoundMax.reduce((a, b) => a + b, 0);
  const num = (v: string) => Math.max(0, Math.min(100000, Math.round(Number(v) || 0)));

  return (
    <div className="scoring">
      <table className="scoring-table">
        <thead>
          <tr>
            <th>Round</th>
            <th>Games</th>
            <th>Points each</th>
            <th className="hide-sm">Round total</th>
          </tr>
        </thead>
        <tbody>
          {template.rounds.map((r, i) => (
            <tr key={r.name}>
              <td>
                {r.name}
                {r.bestOf > 1 && <span className="muted small"> · best of {r.bestOf}</span>}
              </td>
              <td>{template.matches.filter((m) => m.round === i).length}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  inputMode="numeric"
                  aria-label={`${r.name} points`}
                  value={value.points[i] ?? 0}
                  onChange={(e) => {
                    const points = [...value.points];
                    points[i] = num(e.target.value);
                    onChange({ ...value, points });
                  }}
                />
              </td>
              <td className="hide-sm">{perRoundMax[i]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Perfect bracket</td>
            <td className="hide-sm">{total}</td>
          </tr>
        </tfoot>
      </table>
      {hasSeries && (
        <label className="field inline-field">
          <span className="field-label">Series length bonus</span>
          <input
            type="number"
            min={0}
            max={100000}
            inputMode="numeric"
            value={value.seriesBonus}
            onChange={(e) => onChange({ ...value, seriesBonus: num(e.target.value) })}
          />
          <span className="field-hint">
            Extra points for also calling how many games a series lasts. Set to 0 to turn off series-length picks.
          </span>
        </label>
      )}
      <div className="row">
        <button type="button" className="btn small ghost" onClick={() => onChange(defaultScoring(template))}>
          Reset to defaults
        </button>
        <button
          type="button"
          className="btn small ghost"
          onClick={() => onChange({ ...value, points: template.rounds.map(() => 1) })}
        >
          1 point per pick
        </button>
      </div>
    </div>
  );
}
