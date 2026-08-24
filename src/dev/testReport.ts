import { createEmptyEchoReport, type EchoReport } from '../types/echoReport';

// Temporary development fixture (milestone: report preview + printing).
// Loaded only via the dev-only "Date test" button; never used in production.
export function createTestEchoReport(): EchoReport {
  const report = createEmptyEchoReport();
  report.measurements = {
    ...report.measurements,
    lvEndDiastolicDiameter: '5.3',
    lvEndSystolicDiameter: '4.4',
    ivsDiastolicDiameter: '0.8',
    posteriorWallDiastolicDiameter: '0.8',
    lvEjectionFractionTeicholz: '30',
    laAnteroposteriorDiameter: '3',
    lvLateromedialDiameter: '5',
    rvLateromedialDiameter: '8',
    laLateromedialDiameter: '5',
    raLateromedialDiameter: '94',
    laArea: '9',
    raArea: '9.99',
    lvEndDiastolicVolume: '100',
    lvEndSystolicVolume: '9',
    lvEjectionFractionSimpson: '55',
    wallMotion: 'normală',
    aorticValves: 'îngroșate',
    mitralValves: 'suple',
    tricuspidValves: 'normale',
    pulmonaryValves: 'îngroșate',
    pericardialFluid: 'absent',
    aorticVmax: '130',
    aorticPmax: '7',
    aorticPmean: '4',
    lvotVmax: '120',
    lvotPmax: '5',
    lvotVti: '20',
    aorticValveArea: '1.5',
    aorticRegurgitation: 'absent',
    mitralE: '4',
    mitralA: '5',
    mitralEaRatio: '1.2',
    mitralDecelerationTime: '9',
    mitralTriv: '4.5',
    mitralValveArea: '9',
    mitralRegurgitation: 'absent',
    tricuspidA: '9',
    tricuspidEaRatio: '3',
    tricuspidRegurgitation: 'absent',
    septalEPrime: '5',
    septalAPrime: '9',
    septalEaPrimeRatio: '5',
    eePrimeRatio: '4',
  };
  return report;
}
