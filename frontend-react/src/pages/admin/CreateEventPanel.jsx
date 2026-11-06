import { useState } from 'react';
import { createEvent } from '../../api';
import { Button, FormField, useToast } from '../../components/ui';
import { EVENT_CATEGORIES, SPORTS_CATEGORY, buildSetCriteria } from '../../utils/events';

const DEFAULT_CRITERIA = [
  { label: 'Beauty', weight: 50, maxScore: 50 },
  { label: 'Wit', weight: 50, maxScore: 50 }
];

export default function CreateEventPanel({ onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(EVENT_CATEGORIES[0]);
  const [setCount, setSetCount] = useState(5);
  const [judgeCount, setJudgeCount] = useState(3);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [saving, setSaving] = useState(false);

  const isSports = category === SPORTS_CATEGORY;
  const effectiveCriteria = isSports ? buildSetCriteria(setCount) : criteria;
  const totalWeight =
    Math.round(effectiveCriteria.reduce((sum, item) => sum + Number(item.weight || 0), 0) * 100) / 100;
  const weightOk = Math.abs(totalWeight - 100) < 0.5;

  const updateCriterion = (index, key, value) =>
    setCriteria((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: key === 'label' ? value : Number(value) } : item))
    );

  const removeCriterion = (index) => setCriteria((prev) => prev.filter((_, i) => i !== index));

  const reset = () => {
    setName('');
    setCategory(EVENT_CATEGORIES[0]);
    setSetCount(5);
    setJudgeCount(3);
    setCriteria(DEFAULT_CRITERIA);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const cleaned = isSports
      ? effectiveCriteria
      : criteria
          .map((item) => ({
            label: String(item.label || '').trim(),
            weight: Number(item.weight || 0),
            maxScore: Number(item.maxScore || 10)
          }))
          .filter((item) => item.label && item.weight > 0);

    if (cleaned.length === 0) {
      toast.error('Add at least one criterion with a label and a weight.');
      return;
    }

    setSaving(true);
    try {
      await createEvent({
        name: name.trim(),
        category,
        scoringMode: isSports ? 'sets' : 'criteria',
        setCount: isSports ? setCount : null,
        requiredTalliers: isSports ? 1 : judgeCount,
        criteria: cleaned
      });
      toast.success(`Event "${name.trim()}" created.`);
      reset();
      onCreated?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <div className="form-grid">
        <FormField label="Event name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </FormField>
        <FormField label="Category" required>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EVENT_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FormField>
        {isSports ? (
          <FormField label="Number of sets" hint="Each set is scored out of 25." required>
            <input
              type="number"
              min={1}
              max={7}
              value={setCount}
              onChange={(e) => setSetCount(Number(e.target.value))}
            />
          </FormField>
        ) : (
          <FormField label="Number of judges" required>
            <input
              type="number"
              min={1}
              max={50}
              value={judgeCount}
              onChange={(e) => setJudgeCount(Number(e.target.value))}
            />
          </FormField>
        )}
      </div>

      {!isSports && (
        <fieldset className="criteria-editor">
          <legend>
            Criteria
            <span className={`weight-pill ${weightOk ? 'is-ok' : 'is-warn'}`} aria-live="polite">
              Total weight {totalWeight}%
            </span>
          </legend>
          <div className="criteria-editor__head" aria-hidden="true">
            <span>Label</span>
            <span>Weight %</span>
            <span>Max score</span>
            <span />
          </div>
          {criteria.map((criterion, index) => (
            <div className="criteria-editor__row" key={index}>
              <input
                aria-label={`Criterion ${index + 1} label`}
                value={criterion.label}
                onChange={(e) => updateCriterion(index, 'label', e.target.value)}
                placeholder="e.g. Stage presence"
              />
              <input
                aria-label={`Criterion ${index + 1} weight percent`}
                type="number"
                min={0}
                max={100}
                value={criterion.weight}
                onChange={(e) => updateCriterion(index, 'weight', e.target.value)}
              />
              <input
                aria-label={`Criterion ${index + 1} maximum score`}
                type="number"
                min={1}
                value={criterion.maxScore}
                onChange={(e) => updateCriterion(index, 'maxScore', e.target.value)}
              />
              <button
                type="button"
                className="ui-icon-btn"
                aria-label={`Remove criterion ${index + 1}`}
                onClick={() => removeCriterion(index)}
                disabled={criteria.length === 1}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z" />
                </svg>
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCriteria((prev) => [...prev, { label: '', weight: 0, maxScore: 10 }])}
          >
            Add criterion
          </Button>
        </fieldset>
      )}

      <div className="form-actions">
        {!weightOk && <p className="form-note">Weights must add up to 100% before saving.</p>}
        <Button type="submit" variant="primary" loading={saving} disabled={!weightOk || !name.trim()}>
          Save event
        </Button>
      </div>
    </form>
  );
}
