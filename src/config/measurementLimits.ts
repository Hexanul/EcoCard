import type { MeasurementKey } from '../types/echoReport.js';

// Plausibility limits for every numeric form field, transcribed from
// echo_measurement_limits.xlsx (sheet "Limits", widened version). They assume
// adult patients and must be checked by a cardiologist before release.
//
// A value below rejectBelow or above rejectAbove is impossible; one below
// confirmBelow or above confirmAbove is unusual and needs a one-click
// confirmation; anything in between is accepted. A value equal to a limit is
// on the accepted side. Limits are in the field's stored unit (the registry's
// `unit`), so dictated values are checked after unit conversion.

export type ValueLimits = {
  rejectBelow: number;
  confirmBelow?: number;
  confirmAbove?: number;
  rejectAbove: number;
  maxDecimals: number;
};

function limits(
  rejectBelow: number,
  confirmBelow: number | undefined,
  confirmAbove: number | undefined,
  rejectAbove: number,
  maxDecimals: number,
): ValueLimits {
  return {
    rejectBelow,
    ...(confirmBelow === undefined ? {} : { confirmBelow }),
    ...(confirmAbove === undefined ? {} : { confirmAbove }),
    rejectAbove,
    maxDecimals,
  };
}

export type PatientLimitKey = 'age' | 'weight' | 'height';

export const PATIENT_LIMITS: Record<PatientLimitKey, ValueLimits> = {
  age: limits(0, undefined, 100, 130, 0), // years
  weight: limits(1, 25, 220, 500, 1), // kg
  height: limits(30, 110, 220, 260, 0), // cm
};

// Every numeric measurement in the field registry; text fields and the
// calculated ratios (read-only) have none. A test asserts the coverage.
export const MEASUREMENT_LIMITS: Partial<Record<MeasurementKey, ValueLimits>> = {
  // Secțiune longitudinală parasternală
  lvEndDiastolicDiameter: limits(0.8, 2, 8.5, 14, 2), // cm
  lvEndSystolicDiameter: limits(0.4, 1, 8, 13, 2), // cm
  ivsDiastolicDiameter: limits(0.1, 0.3, 3, 6, 2), // cm
  posteriorWallDiastolicDiameter: limits(0.1, 0.3, 2.5, 5, 2), // cm
  lvEjectionFractionTeicholz: limits(2, 12, 82, 99, 1), // %
  shorteningFraction: limits(1, 6, 60, 80, 1), // %
  lvMass: limits(10, 25, 350, 900, 1), // g/m²
  aortaAnnulus: limits(0.6, 1.2, 3.5, 5, 2), // cm
  ascendingAorta: limits(0.8, 1.8, 7, 12, 2), // cm
  laAnteroposteriorDiameter: limits(0.8, 1.8, 7.5, 12, 2), // cm
  aortaAtArch: limits(0.8, 1.5, 5.5, 10, 2), // cm
  pulmonaryArtery: limits(0.6, 1.2, 5, 10, 2), // cm

  // Apical 4C
  lvLateromedialDiameter: limits(0.8, 2, 8.5, 14, 2), // cm
  rvLateromedialDiameter: limits(0.6, 1.2, 7, 12, 2), // cm
  laLateromedialDiameter: limits(0.8, 1.8, 8, 12, 2), // cm
  raLateromedialDiameter: limits(0.8, 1.8, 8, 12, 2), // cm
  mapse: limits(0.5, 3, 25, 45, 1), // mm
  tapse: limits(0.5, 5, 40, 55, 1), // mm

  // Alte măsurători
  laArea: limits(2, 6, 60, 130, 1), // cm²
  raArea: limits(2, 6, 60, 150, 1), // cm²
  lvEndDiastolicVolume: limits(10, 25, 450, 1000, 1), // ml
  lvEndSystolicVolume: limits(3, 8, 400, 900, 1), // ml
  lvEjectionFractionSimpson: limits(2, 8, 85, 99, 1), // %

  // Flux aortic
  aorticVmax: limits(20, 50, 650, 900, 1), // cm/s
  aorticPmax: limits(0.5, undefined, 170, 330, 1), // mmHg
  aorticPmean: limits(0.5, undefined, 120, 220, 1), // mmHg

  // Flux LVOT
  lvotVmax: limits(15, 35, 250, 400, 1), // cm/s
  lvotPmax: limits(0.1, undefined, 20, 70, 1), // mmHg
  lvotVti: limits(2, 6, 40, 70, 1), // cm
  aorticValveArea: limits(0.05, 0.25, 6, 10, 2), // cm²

  // Flux mitral
  mitralE: limits(5, 20, 220, 400, 1), // cm/s
  mitralA: limits(3, 10, 170, 350, 1), // cm/s (may be absent in atrial fibrillation)
  mitralDecelerationTime: limits(30, 60, 450, 800, 0), // msec
  mitralTriv: limits(15, 30, 200, 350, 0), // msec
  mitralValveArea: limits(0.2, 0.5, 8, 12, 2), // cm²

  // Flux tricuspidian
  tricuspidVmax: limits(30, 80, 550, 700, 1), // cm/s
  tricuspidPmax: limits(0.5, undefined, 120, 200, 1), // mmHg
  psvd: limits(3, 8, 140, 250, 1), // mmHg
  tricuspidE: limits(5, 15, 140, 300, 1), // cm/s
  tricuspidA: limits(3, 8, 120, 250, 1), // cm/s

  // Flux pulmonar
  pulmonaryVmax: limits(15, 30, 450, 700, 1), // cm/s
  pulmonaryPmax: limits(0.1, undefined, 120, 200, 1), // mmHg
  pulmonaryVti: limits(2, 6, 35, 70, 1), // cm

  // Doppler tisular (sept)
  septalEPrime: limits(0.5, 1.5, 25, 40, 1), // cm/s
  septalAPrime: limits(0.5, 1.5, 25, 40, 1), // cm/s
  septalS: limits(0.5, 1.5, 25, 40, 1), // cm/s
};

// Free-text fields: length limits only.
export const FINDINGS_MAX_LENGTH = 500;
export const CONCLUSIONS_MAX_LENGTH = 5000;
