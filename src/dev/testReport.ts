import { createEmptyEchoReport, type EchoReport } from '../types/echoReport';
import { calculateDerivedMeasurements } from '../utils/derivedMeasurements';

// Temporary development fixture (milestone: report preview + printing).
// Loaded only via the dev-only "Date test" button; never used in production.
// Values stay inside the plausibility limits, so the preview is not blocked.
export function createTestEchoReport(): EchoReport {
  const report = createEmptyEchoReport();
  report.measurements = calculateDerivedMeasurements({
    ...report.measurements,
    lvEndDiastolicDiameter: '5.3',
    lvEndSystolicDiameter: '4.4',
    ivsDiastolicDiameter: '0.8',
    posteriorWallDiastolicDiameter: '0.8',
    lvEjectionFractionTeicholz: '30',
    laAnteroposteriorDiameter: '3',
    lvLateromedialDiameter: '5',
    rvLateromedialDiameter: '3.5',
    laLateromedialDiameter: '5',
    raLateromedialDiameter: '4.5',
    laArea: '9',
    raArea: '9.9',
    lvEndDiastolicVolume: '100',
    lvEndSystolicVolume: '45',
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
    mitralE: '80',
    mitralA: '65',
    mitralDecelerationTime: '190',
    mitralTriv: '90',
    mitralValveArea: '4',
    mitralRegurgitation: 'absent',
    tricuspidA: '40',
    tricuspidRegurgitation: 'absent',
    septalEPrime: '8',
    septalAPrime: '9',
  });
  return report;
}
