import { useTheme } from '../hooks/useTheme';

const OPTIONS = [
  {
    id: 'light',
    label: 'Light theme',
    icon: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm0 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1ZM3 11h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2Zm17 0h1a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2Z'
  },
  {
    id: 'dark',
    label: 'Dark theme',
    icon: 'M14.77 3.96a1 1 0 0 1 .96 1.28A7 7 0 1 0 18.76 14a1 1 0 0 1 1.28.96A9 9 0 1 1 14.77 3.96Z'
  },
  {
    id: 'system',
    label: 'Match system theme',
    icon: 'M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6v2h3v2H7v-2h3v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v9h16V6H4Z'
  }
];

export default function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Color theme">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={preference === option.id}
          aria-label={option.label}
          title={option.label}
          className={`theme-switcher__btn ${preference === option.id ? 'is-active' : ''}`}
          onClick={() => setPreference(option.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={option.icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}
