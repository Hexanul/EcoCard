export const MEASUREMENT_SECTIONS = [
    {
        group: 'echo',
        title: 'Secțiune longitudinală parasternală',
        fields: [
            { key: 'lvEndDiastolicDiameter', label: 'VS — diametrul telediastolic', unit: 'cm', reportLabel: 'VS - diametrul telediastolic' },
            { key: 'lvEndSystolicDiameter', label: 'VS — diametrul telesistolic', unit: 'cm', reportLabel: 'VS - diametrul telesistolic' },
            { key: 'ivsDiastolicDiameter', label: 'SIV — diam. diastolic', unit: 'cm', reportLabel: 'SIV - diam. diastolic' },
            { key: 'posteriorWallDiastolicDiameter', label: 'Perete posterior — diam. diastolic', unit: 'cm', reportLabel: 'Perete posterior - diam. diastolic' },
            { key: 'lvEjectionFractionTeicholz', label: 'Fracție de ejecție VS (Teicholz)', unit: '%' },
            { key: 'shorteningFraction', label: 'Fracție de scurtare', unit: '%' },
            { key: 'lvMass', label: 'Masă VS', unit: 'g/m²', reportLabel: 'Masa VS' },
            { key: 'aortaAnnulus', label: 'Aorta la inel', unit: 'cm' },
            { key: 'ascendingAorta', label: 'Aorta ascendentă', unit: 'cm' },
            { key: 'laAnteroposteriorDiameter', label: 'AS — diametrul antero-posterior', unit: 'cm', reportLabel: 'AS - diametrul antero-posterior' },
            { key: 'aortaAtArch', label: 'Aorta la nivelul crosei', unit: 'cm' },
            { key: 'pulmonaryArtery', label: 'Artera pulmonară', unit: 'cm' },
        ],
    },
    {
        group: 'echo',
        title: 'Apical 4C',
        fields: [
            { key: 'lvLateromedialDiameter', label: 'VS — diametrul latero-median', unit: 'cm', reportLabel: 'VS - diametrul latero-median' },
            { key: 'rvLateromedialDiameter', label: 'VD — diametrul latero-median', unit: 'cm', reportLabel: 'VD - diametrul latero-median' },
            { key: 'laLateromedialDiameter', label: 'AS — diametrul latero-median', unit: 'cm', reportLabel: 'AS - diametrul latero-median' },
            { key: 'raLateromedialDiameter', label: 'AD — diametrul latero-median', unit: 'cm', reportLabel: 'AD - diametrul latero-median' },
            { key: 'mapse', label: 'MAPSE', unit: 'mm' },
            { key: 'tapse', label: 'TAPSE', unit: 'mm' },
        ],
    },
    {
        group: 'echo',
        title: 'Alte măsurători',
        fields: [
            { key: 'wallMotion', label: 'Cinetică parietală', type: 'textarea' },
            { key: 'aorticValves', label: 'Valve aortice', type: 'textarea' },
            { key: 'mitralValves', label: 'Valve mitrale', type: 'textarea' },
            { key: 'tricuspidValves', label: 'Valve tricuspide', type: 'textarea' },
            { key: 'pulmonaryValves', label: 'Valve pulmonare', type: 'textarea' },
            { key: 'laArea', label: 'Aria AS', unit: 'cm²' },
            { key: 'raArea', label: 'Aria AD', unit: 'cm²' },
            { key: 'lvEndDiastolicVolume', label: 'Volum telediastolic VS', unit: 'ml' },
            { key: 'lvEndSystolicVolume', label: 'Volum telesistolic VS', unit: 'ml' },
            { key: 'lvEjectionFractionSimpson', label: 'Fracție de ejecție Simpson', unit: '%', reportLabel: 'Fracție de ejecție (Simpson)' },
        ],
    },
    {
        group: 'echo',
        title: 'Pericard',
        fields: [
            { key: 'pericardialFluid', label: 'Lichid pericardic', type: 'textarea', reportLabel: 'Pericard: Lichid pericardic' },
        ],
    },
    {
        group: 'doppler',
        title: 'Flux aortic',
        reviewPrefix: 'Flux aortic',
        fields: [
            { key: 'aorticVmax', label: 'Vmax', unit: 'cm/s' },
            { key: 'aorticPmax', label: 'Pmax', unit: 'mmHg' },
            { key: 'aorticPmean', label: 'Pmediu', unit: 'mmHg' },
        ],
    },
    {
        group: 'doppler',
        title: 'Flux LVOT',
        reviewPrefix: 'Flux LVOT',
        fields: [
            { key: 'lvotVmax', label: 'Vmax', unit: 'cm/s' },
            { key: 'lvotPmax', label: 'Pmax', unit: 'mmHg' },
            { key: 'lvotVti', label: 'VTI', unit: 'cm' },
            { key: 'aorticValveArea', label: 'Aria valvei aortice (EC)', unit: 'cm²' },
            { key: 'aorticRegurgitation', label: 'Regurgitare aortică', type: 'textarea' },
        ],
    },
    {
        group: 'doppler',
        title: 'Flux mitral',
        reviewPrefix: 'Flux mitral',
        fields: [
            { key: 'mitralE', label: 'Undă E', unit: 'cm/s', reportLabel: 'Unda E' },
            { key: 'mitralA', label: 'Undă A', unit: 'cm/s', reportLabel: 'Unda A' },
            { key: 'mitralEaRatio', label: 'E/A', type: 'derived' },
            { key: 'mitralDecelerationTime', label: 'TDE', unit: 'msec' },
            { key: 'mitralTriv', label: 'TRIV', unit: 'msec' },
            { key: 'mitralValveArea', label: 'Aria valvei mitrale', unit: 'cm²' },
            { key: 'mitralRegurgitation', label: 'Regurgitare mitrală', type: 'textarea' },
        ],
    },
    {
        group: 'doppler',
        title: 'Flux tricuspidian',
        reviewPrefix: 'Flux tricuspidian',
        fields: [
            { key: 'tricuspidVmax', label: 'Vmax', unit: 'cm/s' },
            { key: 'tricuspidPmax', label: 'Pmax', unit: 'mmHg' },
            { key: 'psvd', label: 'PSVD', unit: 'mmHg' },
            { key: 'tricuspidE', label: 'Undă E', unit: 'cm/s', reportLabel: 'Unda E' },
            { key: 'tricuspidA', label: 'Undă A', unit: 'cm/s', reportLabel: 'Unda A' },
            { key: 'tricuspidEaRatio', label: 'E/A', type: 'derived' },
            { key: 'tricuspidRegurgitation', label: 'Regurgitare tricuspidiană', type: 'textarea' },
        ],
    },
    {
        group: 'doppler',
        title: 'Flux pulmonar',
        reviewPrefix: 'Flux pulmonar',
        fields: [
            { key: 'pulmonaryVmax', label: 'Vmax', unit: 'cm/s' },
            { key: 'pulmonaryPmax', label: 'Pmax', unit: 'mmHg' },
            { key: 'pulmonaryVti', label: 'VTI', unit: 'cm' },
            { key: 'pulmonaryRegurgitation', label: 'Regurgitare pulmonară', type: 'textarea' },
        ],
    },
    {
        group: 'doppler',
        title: 'Doppler tisular (sept)',
        reviewPrefix: 'Doppler tisular',
        fields: [
            { key: 'septalEPrime', label: "Undă E'", unit: 'cm/s', reportLabel: "Unda E'" },
            { key: 'septalAPrime', label: "Undă A'", unit: 'cm/s', reportLabel: "Unda A'" },
            { key: 'septalEaPrimeRatio', label: "E'/A'", type: 'derived' },
            { key: 'eePrimeRatio', label: "E/E'", type: 'derived' },
            { key: 'septalS', label: 'Undă S', unit: 'cm/s', reportLabel: 'Unda S' },
        ],
    },
];
export const MEASUREMENT_FIELDS = Object.fromEntries(MEASUREMENT_SECTIONS.flatMap((section) => section.fields.map((field) => [
    field.key,
    {
        ...field,
        reportLabel: field.reportLabel ?? field.label,
        reviewLabel: section.reviewPrefix && field.type !== 'textarea'
            ? `${section.reviewPrefix} — ${field.label}`
            : field.label,
    },
])));
export const DERIVED_MEASUREMENT_KEYS = MEASUREMENT_SECTIONS.flatMap((section) => section.fields.filter((field) => field.type === 'derived').map((field) => field.key));
