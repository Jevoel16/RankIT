import { useState } from 'react';
import { patchEventStatus } from '../api';

export default function FinalizeEventModal({ open, eventName, eventId, requiredTalliers, completedTalliers, onClose, onSuccess, token }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canFinalize = completedTalliers >= requiredTalliers;

  const handleFinalize = async () => {
    setError('');
    setIsLoading(true);

    try {
      await patchEventStatus(eventId, 'finalized', token);
      
      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to finalize event');
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>Finalize Event</h3>
          <span className="muted">Confirm event closure</span>
        </div>

        <div style={{ display: 'grid', gap: '14px', marginBottom: '16px' }}>
          <p className="muted">
            Are you ready to finalize <strong>{eventName}</strong> and declare the winners?
          </p>

          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
            <p style={{ margin: '4px 0', fontSize: '13px', color: 'rgba(255, 255, 255, 0.8)' }}>
              <strong>Tallier Submissions:</strong> {completedTalliers} of {requiredTalliers} required
            </p>
            {!canFinalize && (
              <p style={{ margin: '4px 0', fontSize: '12px', color: '#f59e0b' }}>
                ⚠️ Not all required talliers have submitted scores. Finalization is currently disabled.
              </p>
            )}
          </div>

          <div style={{ background: 'rgba(200, 50, 50, 0.1)', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #f87171' }}>
            <p style={{ margin: '0', fontSize: '12px', color: '#fca5a5', fontWeight: '500' }}>
              ⛔ Warning: Once finalized, no further score submissions or grievances can be filed.
            </p>
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '6px', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '13px' }}>
              {error}
            </div>
          )}
        </div>

        <div className="action-cell">
          <button
            type="button"
            className="ghost-btn"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleFinalize}
            disabled={!canFinalize || isLoading}
            style={{
              opacity: !canFinalize ? 0.5 : 1,
              cursor: !canFinalize ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Finalizing...' : '🏁 Finalize & Declare Winners'}
          </button>
        </div>
      </div>
    </div>
  );
}
