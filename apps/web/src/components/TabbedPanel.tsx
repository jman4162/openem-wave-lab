import { useState, type ComponentType } from 'react';

export interface TabDef {
  label: string;
  Content: ComponentType;
}

/**
 * Mobile panel tabs. Only the active tab's component is mounted, so inactive
 * panels (which can do real per-render work) cost nothing.
 */
export function TabbedPanel({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(0);
  const ActiveContent = tabs[active]?.Content;

  return (
    <>
      <div className="tab-strip" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel">
        {ActiveContent && <ActiveContent />}
      </div>
    </>
  );
}
