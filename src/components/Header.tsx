import { APP_VERSION } from '../config/appInfo';

type HeaderProps = {
  onOpenSettings: () => void;
  onOpenAbout: () => void;
};

export function Header({ onOpenSettings, onOpenAbout }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__titles">
        <h1 className="app-header__title">Raport Eco</h1>
        <p className="app-header__subtitle">
          Dictare și redactare a rapoartelor ecocardiografice · v{APP_VERSION}
        </p>
      </div>
      <div className="app-header__actions">
        <button type="button" className="btn btn--neutral" onClick={onOpenSettings}>
          ⚙ Setări
        </button>
        <button type="button" className="btn btn--neutral" onClick={onOpenAbout}>
          Despre
        </button>
        <div className="offline-indicator" aria-label="Mod offline activ">
          <span className="offline-indicator__dot" aria-hidden="true" />
          Offline
        </div>
      </div>
    </header>
  );
}
