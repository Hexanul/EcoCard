export type PatientInfo = {
  lastName: string;
  firstName: string;
  age: string;
  examinationDate: string;
  currentNumber: string;
  weight: string;
  height: string;
  bmi: string;
};

export type Measurements = {
  // Sectiune longitudinala parasternala
  lvEndDiastolicDiameter: string;
  lvEndSystolicDiameter: string;
  ivsDiastolicDiameter: string;
  posteriorWallDiastolicDiameter: string;
  lvEjectionFractionTeicholz: string;
  shorteningFraction: string;
  lvMass: string;
  aortaAnnulus: string;
  ascendingAorta: string;
  laAnteroposteriorDiameter: string;
  aortaAtArch: string;
  pulmonaryArtery: string;

  // Apical 4C
  lvLateromedialDiameter: string;
  rvLateromedialDiameter: string;
  laLateromedialDiameter: string;
  raLateromedialDiameter: string;
  mapse: string;
  tapse: string;

  // Text fields
  wallMotion: string;
  aorticValves: string;
  mitralValves: string;
  tricuspidValves: string;
  pulmonaryValves: string;
  pericardialFluid: string;

  // Additional measurements
  laArea: string;
  raArea: string;
  lvEndDiastolicVolume: string;
  lvEndSystolicVolume: string;
  lvEjectionFractionSimpson: string;

  // Doppler - Flux aortic
  aorticVmax: string;
  aorticPmax: string;
  aorticPmean: string;

  // Doppler - Flux LVOT
  lvotVmax: string;
  lvotPmax: string;
  lvotVti: string;

  aorticValveArea: string;
  aorticRegurgitation: string;

  // Doppler - Flux mitral
  mitralE: string;
  mitralA: string;
  mitralEaRatio: string;
  mitralDecelerationTime: string;
  mitralTriv: string;
  mitralValveArea: string;
  mitralRegurgitation: string;

  // Doppler - Flux tricuspidian
  tricuspidVmax: string;
  tricuspidPmax: string;
  psvd: string;
  tricuspidE: string;
  tricuspidA: string;
  tricuspidEaRatio: string;
  tricuspidRegurgitation: string;

  // Doppler - Flux pulmonar
  pulmonaryVmax: string;
  pulmonaryPmax: string;
  pulmonaryVti: string;
  pulmonaryRegurgitation: string;

  // Doppler tisular (sept)
  septalEPrime: string;
  septalAPrime: string;
  septalEaPrimeRatio: string;
  eePrimeRatio: string;
  septalS: string;
};

export type EchoReport = {
  patient: PatientInfo;
  measurements: Measurements;
  conclusions: string;
};

export type MeasurementKey = keyof Measurements;

export function createEmptyPatient(): PatientInfo {
  return {
    lastName: '',
    firstName: '',
    age: '',
    examinationDate: new Date().toISOString().slice(0, 10),
    currentNumber: '',
    weight: '',
    height: '',
    bmi: '',
  };
}

export function createEmptyMeasurements(): Measurements {
  return {
    lvEndDiastolicDiameter: '',
    lvEndSystolicDiameter: '',
    ivsDiastolicDiameter: '',
    posteriorWallDiastolicDiameter: '',
    lvEjectionFractionTeicholz: '',
    shorteningFraction: '',
    lvMass: '',
    aortaAnnulus: '',
    ascendingAorta: '',
    laAnteroposteriorDiameter: '',
    aortaAtArch: '',
    pulmonaryArtery: '',
    lvLateromedialDiameter: '',
    rvLateromedialDiameter: '',
    laLateromedialDiameter: '',
    raLateromedialDiameter: '',
    mapse: '',
    tapse: '',
    wallMotion: '',
    aorticValves: '',
    mitralValves: '',
    tricuspidValves: '',
    pulmonaryValves: '',
    pericardialFluid: '',
    laArea: '',
    raArea: '',
    lvEndDiastolicVolume: '',
    lvEndSystolicVolume: '',
    lvEjectionFractionSimpson: '',
    aorticVmax: '',
    aorticPmax: '',
    aorticPmean: '',
    lvotVmax: '',
    lvotPmax: '',
    lvotVti: '',
    aorticValveArea: '',
    aorticRegurgitation: '',
    mitralE: '',
    mitralA: '',
    mitralEaRatio: '',
    mitralDecelerationTime: '',
    mitralTriv: '',
    mitralValveArea: '',
    mitralRegurgitation: '',
    tricuspidVmax: '',
    tricuspidPmax: '',
    psvd: '',
    tricuspidE: '',
    tricuspidA: '',
    tricuspidEaRatio: '',
    tricuspidRegurgitation: '',
    pulmonaryVmax: '',
    pulmonaryPmax: '',
    pulmonaryVti: '',
    pulmonaryRegurgitation: '',
    septalEPrime: '',
    septalAPrime: '',
    septalEaPrimeRatio: '',
    eePrimeRatio: '',
    septalS: '',
  };
}

export function createEmptyEchoReport(): EchoReport {
  return {
    patient: createEmptyPatient(),
    measurements: createEmptyMeasurements(),
    conclusions: '',
  };
}
