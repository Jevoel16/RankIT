import { createContext, useContext, useMemo, useState } from 'react';

const ActiveEventContext = createContext(null);

export function ActiveEventProvider({ children }) {
  const [activeEventId, setActiveEventId] = useState('');
  const [activeEventPayload, setActiveEventPayload] = useState(null);

  const setActiveEvent = ({ eventId, event = null, contestants = null, source = 'manual' }) => {
    setActiveEventId(eventId || '');
    setActiveEventPayload(
      eventId
        ? {
            eventId,
            event,
            contestants,
            source,
            updatedAt: Date.now()
          }
        : null
    );
  };

  const clearActiveEvent = () => {
    setActiveEventId('');
    setActiveEventPayload(null);
  };

  const value = useMemo(
    () => ({
      activeEventId,
      activeEventPayload,
      setActiveEvent,
      clearActiveEvent
    }),
    [activeEventId, activeEventPayload]
  );

  return <ActiveEventContext.Provider value={value}>{children}</ActiveEventContext.Provider>;
}

export function useActiveEvent() {
  const ctx = useContext(ActiveEventContext);
  if (!ctx) {
    throw new Error('useActiveEvent must be used within ActiveEventProvider');
  }
  return ctx;
}
