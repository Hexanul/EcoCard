export function isElectronAvailable(): boolean {
  return typeof window !== 'undefined' && window.echoReport?.isAvailable === true;
}

export function getEchoReportApi() {
  if (!isElectronAvailable() || !window.echoReport) {
    return null;
  }
  return window.echoReport;
}
