// Local calendar date as yyyy-mm-dd (toISOString() would give the UTC date,
// which is the previous day in Romania shortly after midnight).
function todayLocalIsoDate() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}
export function createEmptyPatient() {
    return {
        lastName: '',
        firstName: '',
        age: '',
        examinationDate: todayLocalIsoDate(),
        currentNumber: '',
        weight: '',
        height: '',
        bmi: '',
    };
}
export function createEmptyMeasurements() {
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
export function createEmptyEchoReport() {
    return {
        patient: createEmptyPatient(),
        measurements: createEmptyMeasurements(),
        conclusions: '',
    };
}
