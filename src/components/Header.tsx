type HeaderProps = {
  onOpenSettings: () => void;
};

export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__titles">
        <h1 className="app-header__title">Raport Eco</h1>
        <p className="app-header__subtitle">
          Asistent pentru raportarea ecocardiografică
        </p>
      </div>
      <div className="app-header__actions">
        <button type="button" className="btn btn--neutral" onClick={onOpenSettings}>
          ⚙ Setări
        </button>
        <div className="offline-indicator" aria-label="Mod offline activ">
          <span className="offline-indicator__dot" aria-hidden="true" />
          Offline
        </div>
      </div>
    </header>
  );
}
