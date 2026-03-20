import { useState } from 'react';
import { createEvent } from '../api';
import { useAuth } from '../hooks/useAuth';
import AdminUsers from '../components/AdminUsers';
import AdminContestants from '../components/AdminContestants';

export default function AdminPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [requiredTalliers, setRequiredTalliers] = useState(3);
  const [criteria, setCriteria] = useState([
    { label: 'Beauty', weight: 50, maxScore: 50 },
    { label: 'Wit', weight: 50, maxScore: 50 }
  ]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const addCriterion = () => {
    setCriteria((prev) => [...prev, { label: '', weight: 0, maxScore: 10 }]);
  };

  const updateCriterion = (index, key, value) => {
    setCriteria((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [key]: key === 'label' ? value : Number(value)
            }
          : item
      )
    );
  };

  const totalWeight = criteria.reduce((sum, item) => sum + Number(item.weight || 0), 0);

  const onCreateEvent = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const cleanedCriteria = criteria
      .map((item) => ({
        label: String(item.label || '').trim(),
        weight: Number(item.weight || 0),
        maxScore: Number(item.maxScore || 10)
      }))
      .filter((item) => item.label && item.weight > 0);

    if (cleanedCriteria.length === 0) {
      setError('Add at least one valid criterion before saving the event.');
      return;
    }

    try {
      await createEvent(
        {
          name: name.trim(),
          category: category.trim(),
          requiredTalliers,
          criteria: cleanedCriteria
        },
        token
      );

      setSuccess('Event configuration saved.');
      setName('');
      setCategory('');
      setRequiredTalliers(3);
      setCriteria([
        { label: 'Beauty', weight: 50, maxScore: 50 },
        { label: 'Wit', weight: 50, maxScore: 50 }
      ]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="admin-workspace">
      <div className="admin-tabs" role="tablist" aria-label="Admin Functions">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Approval
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'contestants' ? 'active' : ''}`}
          onClick={() => setActiveTab('contestants')}
        >
          Contestants
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Event Configuration
        </button>
      </div>

      {activeTab === 'users' && <AdminUsers token={token} />}

      {activeTab === 'contestants' && <AdminContestants token={token} />}

      {activeTab === 'events' && (
        <div className="panel">
          <div className="section-head">
            <h2>Event Configuration</h2>
            <span className="muted">Dynamic Criteria Builder</span>
          </div>
          <p className="muted">Admin can define dynamic criteria and weights.</p>

          <div className="status-kpi">
            <div className="kpi-chip">
              <strong>Criteria Rows</strong>
              {criteria.length}
            </div>
            <div className="kpi-chip">
              <strong>Total Weight</strong>
              {totalWeight}%
            </div>
            <div className="kpi-chip">
              <strong>Required Talliers</strong>
              {requiredTalliers}
            </div>
          </div>

          <form onSubmit={onCreateEvent} className="stack">
            <label htmlFor="event-name">Event Name</label>
            <input id="event-name" value={name} onChange={(e) => setName(e.target.value)} required />

            <label htmlFor="event-category">Category</label>
            <input id="event-category" value={category} onChange={(e) => setCategory(e.target.value)} required />

            <label htmlFor="required-talliers">Required Talliers</label>
            <input
              id="required-talliers"
              type="number"
              min={1}
              value={requiredTalliers}
              onChange={(e) => setRequiredTalliers(Number(e.target.value))}
            />

            <div className="criteria-box">
              <div className="criteria-header">
                <strong>Criteria</strong>
                <span className={totalWeight === 100 ? 'success-inline' : 'warn-inline'}>
                  Total Weight: {totalWeight}%
                </span>
              </div>
              {criteria.map((criterion, index) => (
                <div className="criteria-row" key={index}>
                  <input
                    value={criterion.label}
                    onChange={(e) => updateCriterion(index, 'label', e.target.value)}
                    placeholder="Label"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={criterion.weight}
                    onChange={(e) => updateCriterion(index, 'weight', e.target.value)}
                    placeholder="Weight"
                  />
                  <input
                    type="number"
                    min={1}
                    value={criterion.maxScore}
                    onChange={(e) => updateCriterion(index, 'maxScore', e.target.value)}
                    placeholder="Max"
                  />
                </div>
              ))}
              <button type="button" className="ghost-btn" onClick={addCriterion}>
                Add Criterion
              </button>
            </div>

            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}

            <button type="submit" disabled={totalWeight !== 100}>
              Save Event
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
