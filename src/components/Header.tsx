export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__titles">
        <h1 className="app-header__title">Echo Report</h1>
        <p className="app-header__subtitle">
          Asistent pentru raportarea ecocardiografică
        </p>
      </div>
      <div className="offline-indicator" aria-label="Mod offline activ">
        <span className="offline-indicator__dot" aria-hidden="true" />
        Offline
      </div>
    </header>
  );
}
