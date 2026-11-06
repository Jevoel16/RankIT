import { useEffect, useMemo, useState } from 'react';
import { recordOfflineScore } from '../../api';
import ScoreInputCard from '../../components/ScoreInputCard';
import { Button, EmptyState, FormField, useToast } from '../../components/ui';

const zeroDraft = (criteria) => Object.fromEntries(criteria.map((criterion) => [criterion.label, 0]));

// One judge's score sheet for one contestant in a criteria-based event.
export default function CriteriaScoreForm({ event, contestants, onRecorded }) {
  const toast = useToast();
  const criteria = useMemo(() => event?.criteria || [], [event]);
  const judges = useMemo(
    () => Array.from({ length: Math.max(1, Number(event?.requiredTalliers || 1)) }, (_, index) => `Judge ${index + 1}`),
    [event]
  );
  const [contestantId, setContestantId] = useState('');
  const [judge, setJudge] = useState(judges[0]);
  const [draft, setDraft] = useState(() => zeroDraft(criteria));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(zeroDraft(criteria));
    setJudge(judges[0]);
  }, [criteria, judges]);

  const sorted = useMemo(
    () => [...contestants].sort((a, b) => Number(a.contestantNumber || 0) - Number(b.contestantNumber || 0)),
    [contestants]
  );
  const selectedId = sorted.some((item) => item._id === contestantId) ? contestantId : sorted[0]?._id || '';

  const total = criteria.reduce((sum, criterion) => sum + Number(draft[criterion.label] || 0), 0);
  const invalid = criteria.find((criterion) => {
    const value = Number(draft[criterion.label]);
    return !Number.isFinite(value) || value < 0 || value > Number(criterion.maxScore || 0);
  });

  const submit = async (e) => {
    e.preventDefault();
    if (invalid) {
      toast.error(`${invalid.label} must be between 0 and ${invalid.maxScore}.`);
      return;
    }
    setSaving(true);
    try {
      const result = await recordOfflineScore({
        eventId: event._id,
        contestantId: selectedId,
        physicalJudgeName: judge,
        scores: criteria.map((criterion) => ({
          criteriaName: criterion.label,
          value: Number(draft[criterion.label] || 0)
        }))
      });
      const name = sorted.find((item) => item._id === selectedId)?.name;
      toast.success(result?.message || `Saved ${judge}'s score for ${name}.`);
      // Clear the sheet so the next judge's scores can't be submitted twice by accident.
      setDraft(zeroDraft(criteria));
      onRecorded?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (sorted.length === 0) {
    return <EmptyState title="No contestants yet">Ask an admin to add contestants to this event.</EmptyState>;
  }

  return (
    <form className="score-form" onSubmit={submit}>
      <div className="score-form__meta">
        <FormField label="Contestant">
          <select value={selectedId} onChange={(e) => setContestantId(e.target.value)}>
            {sorted.map((contestant) => (
              <option key={contestant._id} value={contestant._id}>
                {contestant.contestantNumber ? `#${contestant.contestantNumber} ` : ''}
                {contestant.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Judge">
          <select value={judge} onChange={(e) => setJudge(e.target.value)}>
            {judges.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <fieldset className="score-form__sheet">
        <legend>Score sheet</legend>
        {criteria.map((criterion) => (
          <ScoreInputCard
            key={criterion.label}
            criterion={criterion}
            value={draft[criterion.label] ?? 0}
            onChange={(value) => setDraft((prev) => ({ ...prev, [criterion.label]: value }))}
          />
        ))}
      </fieldset>

      <div className="score-form__footer">
        <span className="score-form__total" aria-live="polite">
          Total <strong>{Math.round(total * 100) / 100}</strong>
        </span>
        <Button type="submit" variant="primary" size="lg" loading={saving} disabled={!selectedId || Boolean(invalid)}>
          Record score
        </Button>
      </div>
    </form>
  );
}
