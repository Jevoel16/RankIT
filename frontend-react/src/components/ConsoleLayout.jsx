import { useAuth } from '../hooks/useAuth';
import usePersistentState from '../hooks/usePersistentState';
import { TabPanel, Tabs } from './ui';

// Staff console frame: section list (a sidebar on desktop, a scrollable row on phones) and
// optional sub-tabs inside each section. The open section and sub-tab are remembered per user.
//
// sections: [{ id, label, icon?, badge?, subtabs?: [{ id, label, render }], render? }]
export default function ConsoleLayout({ consoleId, title, subtitle, sections, toolbar }) {
  const { user } = useAuth();
  const storageKey = `rankit_ui_${consoleId}_${user?.id || 'anon'}`;
  const visible = sections.filter(Boolean);
  const [state, setState] = usePersistentState(storageKey, {});

  const activeSection = visible.find((section) => section.id === state.section) || visible[0];
  const subtabs = activeSection?.subtabs?.filter(Boolean) || [];
  const activeSubtab = subtabs.find((tab) => tab.id === state[activeSection?.id]) || subtabs[0];

  const setSection = (id) => setState((prev) => ({ ...prev, section: id }));
  const setSubtab = (id) => setState((prev) => ({ ...prev, [activeSection.id]: id }));

  const baseId = `${consoleId}-sections`;
  const subBaseId = `${consoleId}-${activeSection?.id}-subtabs`;

  return (
    <section className="console">
      <header className="console__header">
        <div>
          <h1 className="console__title">{title}</h1>
          {subtitle && <p className="console__subtitle">{subtitle}</p>}
        </div>
        {toolbar && <div className="console__toolbar">{toolbar}</div>}
      </header>

      <div className="console__body">
        {visible.length > 1 && (
          <nav className="console__nav" aria-label={`${title} sections`}>
            <Tabs
              baseId={baseId}
              label={`${title} sections`}
              tabs={visible.map(({ id, label, icon, badge }) => ({ id, label, icon, badge }))}
              value={activeSection?.id}
              onChange={setSection}
              orientation="vertical"
              className="console__sections"
            />
          </nav>
        )}

        <TabPanel baseId={baseId} id={activeSection?.id} active className="console__panel panel">
          <h2 className="console__section-title">{activeSection?.label}</h2>
          {subtabs.length > 1 && (
            <Tabs
              baseId={subBaseId}
              label={`${activeSection.label} views`}
              tabs={subtabs.map(({ id, label, badge }) => ({ id, label, badge }))}
              value={activeSubtab.id}
              onChange={setSubtab}
              className="console__subtabs"
            />
          )}
          {subtabs.length > 0 ? (
            <TabPanel baseId={subBaseId} id={activeSubtab.id} active className="console__subpanel">
              {activeSubtab.render()}
            </TabPanel>
          ) : (
            activeSection?.render?.()
          )}
        </TabPanel>
      </div>
    </section>
  );
}
