import { useRef } from 'react';

export const tabDomId = (baseId, tabId) => `${baseId}-tab-${tabId}`;
export const panelDomId = (baseId, tabId) => `${baseId}-panel-${tabId}`;

// Accessible tablist with roving tabindex and arrow/Home/End keys.
// Pair with <TabPanel> using the same baseId.
export default function Tabs({ baseId, tabs, value, onChange, label, orientation = 'horizontal', className = '' }) {
  const refs = useRef({});
  const visible = tabs.filter(Boolean);

  const focusTab = (index) => {
    const tab = visible[(index + visible.length) % visible.length];
    if (!tab) return;
    onChange(tab.id);
    refs.current[tab.id]?.focus();
  };

  const onKeyDown = (event) => {
    const index = visible.findIndex((tab) => tab.id === value);
    const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const moves = { [prevKey]: index - 1, [nextKey]: index + 1, Home: 0, End: visible.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      focusTab(moves[event.key]);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation={orientation}
      className={`ui-tabs ui-tabs--${orientation} ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      {visible.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            type="button"
            role="tab"
            id={tabDomId(baseId, tab.id)}
            aria-selected={selected}
            aria-controls={panelDomId(baseId, tab.id)}
            tabIndex={selected ? 0 : -1}
            className={`ui-tab ${selected ? 'is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon && (
              <span className="ui-tab__icon" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge != null && tab.badge !== 0 && <span className="ui-tab__badge">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ baseId, id, active, children, className = '' }) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      id={panelDomId(baseId, id)}
      aria-labelledby={tabDomId(baseId, id)}
      tabIndex={0}
      className={`ui-tabpanel ${className}`.trim()}
    >
      {children}
    </div>
  );
}
