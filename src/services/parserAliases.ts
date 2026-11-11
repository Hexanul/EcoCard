import type { MeasurementKey } from '../types/echoReport.js';

// Everything the parser knows about how labels are spoken and how whisper
// writes them: section headings, field aliases, known value words and the
// text rewrites applied before matching. Whisper fixes (/fix-dictation) are
// made here; the matching logic lives in medicalParser.ts.
//
// Aliases are written in normalized form: lowercase, no diacritics,
// ș/ț as s/t, hyphens as spaces.

export type FlowContext = 'aortic' | 'lvot' | 'mitral' | 'tricuspid' | 'pulmonary' | 'septal' | 'apical4c';

export type NumericFieldDef = {
  field: MeasurementKey;
  aliases: string[];
  context?: FlowContext;
  // Section contexts in which this definition must NOT be applied, even
  // without an explicit context requirement (e.g. an unprefixed diameter
  // phrase that only belongs to the parasternal longitudinal section).
  excludeContexts?: FlowContext[];
};

export type QualitativeFieldDef = {
  field: MeasurementKey;
  aliases: string[];
};

export const CONTEXT_ALIASES: Record<FlowContext, string[]> = {
  aortic: ['flux aortic', 'fluxul aortic'],
  lvot: [
    'flux lvot',
    'fluxul lvot',
    // Whisper reads "LVOT" letter-by-letter and often fuses the letters
    // ("El-V-O-T") or splits them ("l v o t", "lu vot").
    'flux luvot',
    'fluxul luvot',
    // Whisper hearing "t" as "d" ("luvod").
    'flux luvod',
    'fluxul luvod',
    'flux eluvot',
    'fluxul eluvot',
    // Whisper hearing "u" as "a" ("lăvod" -> lavod, normalized from "lăvod").
    // Covers "Flux lăvod" dictation which Whisper transcribes as "lavod/lavot".
    'flux lavod',
    'fluxul lavod',
    'flux lavot',
    'fluxul lavot',
    'flux elavod',
    'fluxul elavod',
    'flux elavot',
    'fluxul elavot',
    // Whisper hearing "u" as "e" ("levot" -> le vot, elevot). The doctor may
    // dictate "Flux levot" which Whisper transcribes as "levot/levod".
    'flux levot',
    'fluxul levot',
    'flux levod',
    'fluxul levod',
    // Whisper splits "LVOT" after the L ("Flux L, vot").
    'flux l vot',
    'fluxul l vot',
    'flux elevot',
    'fluxul elevot',
    'flux elevod',
    'fluxul elevod',
    'flux le vot',
    'fluxul le vot',
    'flux le vod',
    'fluxul le vod',
    'flux la vod',
    'fluxul la vod',
    'flux la vot',
    'fluxul la vot',
    'flux l v o t',
    'flux lu vot',
    // Whisper dropping the "L" entirely ("VOT").
    'flux vot',
    'fluxul vot',
    'flux de vot',
    'fluxul de vot',
    'tract de ejectie',
    'tractul de ejectie',
    'tract de ejectie stang',
    'tractul de ejectie stang',
    // Romanian for "outflow tract" ("căi de ejecție").
    'cai de ejectie',
    'caii de ejectie',
    'calea de ejectie',
    'caiile de ejectie',
  ],
  // Whisper drops the "F": "Lux mitral".
  mitral: ['flux mitral', 'fluxul mitral', 'lux mitral'],
  tricuspid: [
    'flux tricuspidian',
    'fluxul tricuspidian',
    // Whisper splits the word: "Flux tri cuspidian".
    'flux tri cuspidian',
    'fluxul tri cuspidian',
    // A regurgitation phrase stays in the tricuspid section: a following
    // bare "Vmax"/"PSVD" belongs to it even when the doctor did not dictate
    // the "Flux tricuspidian" heading.
    'regurgitare tricuspidiana',
    'regurgitarea tricuspidiana',
    'recurgitare tricuspidiana',
    'recurgitarea tricuspidiana',
    'recucitare tricuspidiana',
    'recucitarea tricuspidiana',
    'regulcitare tricuspidiana',
    'regulcitarea tricuspidiana',
  ],
  pulmonary: ['flux pulmonar', 'fluxul pulmonar'],
  septal: [
    'doppler tisular sept',
    'doppler tisular',
    'dopplerul tisular',
    // Whisper hearing "ti" as "tri" ("Doppler trisular").
    'doppler trisular sept',
    'doppler trisular',
    'dopplerul trisular',
    // Whisper "doper tisular": the heading must start at "doper", or the
    // word ends up in the previous field's value ("absentă, doper").
    'doper tisular',
    'dopler tisular',
    // Whisper may drop "Doppler" and keep only "tisular"; the word only
    // ever names this section.
    'tisular',
    // ... or only its end: "Sular, Unda E prim 10".
    'sular',
  ],
  apical4c: ['apical 4c', 'apical 4 camere', 'apicala 4 camere'],
};

export const UNASSIGNED_FIELD_ALIASES = [
  'fractie de ejectie',
  'fractia de ejectie',
  'fratie de ejectie',
  // Whisper drops "Aria" and spells "AS" as "A, S, E" ("A, S, E, 20"): end
  // the previous field's window there so the bare "E, 20" is not read as a
  // wave E, without guessing between the AS area and the AS diameter.
  'as e',
];

export const NUMERIC_FIELDS: NumericFieldDef[] = [
  // Secțiune longitudinală parasternală
  {
    field: 'lvEndDiastolicDiameter',
    aliases: [
      'vs diametrul telediastolic',
      'vs diametrul telediastoric',
      'vs diametrul tere diastolic',
      // Spoken "diametru la telediastolic" (with "la" between the words).
      'vs diametru la telediastolic',
      'vs diametrul la telediastolic',
      'vs diametru la telediastoric',
      'vs diametrul la telediastoric',
      'vs diametru la tele diastolic',
      'vs diametrul la tele diastolic',
      'vs diametru la tele diastoric',
      'vs diametrul la tele diastoric',
      // Whisper splits "telediastolic" into "tele diastolic" (with or
      // without a comma between the two words).
      'vs diametrul tele diastolic',
      'vs diametrul tele diastoric',
      'vs diametru tele diastolic',
      'vs diametru telediastolic',
      'vs telediastolic',
      'vs telediastoric',
      'ventricul stang diametrul telediastolic',
      'ventricul stang diametrul telediastoric',
      'ps diametrul telediastolic',
      'ps telediastolic',
      // Whisper "VSE" for "VS" (extra E from dictation).
      'vse diametrul telediastolic',
      'vse diametrul telediastoric',
      'vse diametrul tele diastolic',
      'vse diametrul tele diastoric',
      'vse diametru tele diastolic',
      'vse diametru telediastolic',
      'vse diametrul la telediastolic',
      'vse diametru la telediastolic',
      'vse diametrul la tele diastolic',
      'vse diametru la tele diastolic',
      'vse diametrul la telediastoric',
      'vse diametru la telediastoric',
      'vse diametrul la tele diastoric',
      'vse diametru la tele diastoric',
      'vse diametrul telediastolic',
      'vse telediastolic',
      'vse telediastoric',
      // Whisper hears "tele" as the digit 3 ("diametru 3 diastolic").
      'vs diametru 3 diastolic',
      'vs diametrul 3 diastolic',
      'vse diametru 3 diastolic',
      'vse diametrul 3 diastolic',
      'vs diametru 3 diastoric',
      'vs diametrul 3 diastoric',
      'vse diametru 3 diastoric',
      'vse diametrul 3 diastoric',
      'vse diametru telediastolic',
      'vse diametru telediastoric',
      'vse diametrul tele diastolic',
    ],
  },
  // Unprefixed telediastolic forms (same parasternal rule as above).
  {
    field: 'lvEndDiastolicDiameter',
    aliases: [
      'diametrul telediastolic',
      'diametrul telediastoric',
      'diametru la telediastolic',
      'diametrul la telediastolic',
      'diametru la telediastoric',
      'diametrul la telediastoric',
      'diametru la tele diastolic',
      'diametrul la tele diastolic',
      'diametru la tele diastoric',
      'diametrul la tele diastoric',
      'diametrul tele diastolic',
      'diametrul tele diastoric',
      'diametru tele diastolic',
      'diametrul la diastolic',
      'diametru la diastolic',
      'diametrul la diastoric',
      'diametru la diastoric',
      'diametrul diastolic',
      'diametrul diastoric',
      'diametru diastolic',
      'diametru diastoric',
    ],
    excludeContexts: ['apical4c'],
  },
  {
    field: 'lvEndSystolicDiameter',
    aliases: [
      'vs diametrul telesistolic',
      // Spoken "diametru la telesistolic" (with "la" between the words).
      'vs diametru la telesistolic',
      'vs diametrul la telesistolic',
      'vs diametru la telesistoric',
      'vs diametrul la telesistoric',
      'vs diametru la tele sistolic',
      'vs diametrul la tele sistolic',
      // Whisper splits "telesistolic" into "tele sistolic" (with or
      // without a comma between the two words).
      'vs diametrul tele sistolic',
      'vs diametru tele sistolic',
      'vs diametru telesistolic',
      'vs diametru telesistoric',
      'vs diametrul telesistoric',
      'vs telesistolic',
      // Whisper "teletistolic" / "tele tistolic" (s -> t) for telesistolic
      'vs diametrul la teletistolic',
      'vs diametru la teletistolic',
      'vs diametrul la tele tistolic',
      'vs diametru la tele tistolic',
      'vs diametrul teletistolic',
      'vs diametru teletistolic',
      'vs diametrul tele tistolic',
      'vs diametru tele tistolic',
      'vs teletistolic',
      'ventricul stang diametrul telesistolic',
      'ventricul stang diametrul teletistolic',
      'ps diametrul telesistolic',
      'ps diametrul teletistolic',
      'ps telesistolic',
      'ps teletistolic',
      // Whisper "VSE" for "VS".
      'vse diametrul telesistolic',
      'vse diametru la telesistolic',
      'vse diametrul la telesistolic',
      'vse diametru la tele sistolic',
      'vse diametrul la tele sistolic',
      'vse diametrul tele sistolic',
      'vse diametru tele sistolic',
      'vse diametru telesistolic',
      'vse diametru telesistoric',
      'vse diametrul telesistoric',
      'vse telesistolic',
      'vse diametrul la teletistolic',
      'vse diametru la teletistolic',
      'vse diametrul la tele tistolic',
      'vse diametru la tele tistolic',
      'vse diametrul teletistolic',
      'vse diametru teletistolic',
      'vse diametrul tele tistolic',
      'vse diametru tele tistolic',
      'vse teletistolic',
      // Whisper hears "tele" as the digit 3: "VSE, diametru 3 sistolic 2".
      'vs diametru 3 sistolic',
      'vs diametrul 3 sistolic',
      'vse diametru 3 sistolic',
      'vse diametrul 3 sistolic',
      'vs diametru 3 sistoric',
      'vs diametrul 3 sistoric',
      'vse diametru 3 sistoric',
      'vse diametrul 3 sistoric',
      'vse diametru telesistolic',
    ],
  },
  // Unprefixed diameters: in parasternal longitudinal dictation the doctor
  // may omit "VS" because the section identifies the field. The bare
  // phrases map to the VS diameters only when no other section context
  // (e.g. APICAL 4C, where diameters are latero-median) is active.
  {
    field: 'lvEndSystolicDiameter',
    aliases: [
      'diametrul telesistolic',
      'diametru la telesistolic',
      'diametrul la telesistolic',
      'diametru la tele sistolic',
      'diametrul la tele sistolic',
      'diametrul tele sistolic',
      'diametrul teletistolic',
      'diametrul tele tistolic',
    ],
    excludeContexts: ['apical4c'],
  },
  {
    field: 'ivsDiastolicDiameter',
    aliases: [
      'siv diametrul diastolic',
      'siv diametrul diastoric',
      // Shorter spoken form without the "-l" article.
      'siv diametru diastolic',
      'siv diametru diastoric',
      'siv diam diastolic',
      'siv diam. diastolic',
      // Whisper hears "tele" as the digit 3 ("Siv, diametrul 3 diastoric").
      'siv diametrul 3 diastoric',
      'siv diametru 3 diastoric',
      'siv diastolic',
      'siv diastoric',
      // Known Whisper transcription variants of "diastolic".
      'siv diametrul siastolic',
      'siv diam siastolic',
      'siv diametrul diasolic',
      'siv diam diasolic',
      // Whisper "Tiv, diametru diastolic".
      'tiv diametru diastolic',
      'tiv diametrul diastolic',
      // Whisper hears "SIV" as "SIF".
      'sif diametrul diastolic',
      'sif diametru diastolic',
      'sif diam diastolic',
      'sif diastolic',
      // ... with "diastoric" ("Sif, diametrul diastoric 3").
      'sif diametrul diastoric',
      'sif diametru diastoric',
      'sif diastoric',
      'sept interventricular diametrul diastolic',
      'sept interventricular diametrul diastoric',
    ],
  },
  {
    field: 'posteriorWallDiastolicDiameter',
    aliases: [
      'perete posterior diametrul diastolic',
      'perete posterior diametrul diastoric',
      'perete posterior diametru diastolic',
      'perete posterior diametru diastoric',
      // Known Whisper transcription variant of "diastolic".
      'perete posterior diametrul distolic',
      'perete posterior distolic',
      // Abbreviated "diam diastolic" dictation — doctor may shorten
      // "diametrul/diametru" to "diam" ("perete posterior diam diastolic").
      'perete posterior diam diastolic',
      'perete posterior diam diastoric',
      'perete posterior diam. diastolic',
      'perete posterior diam. diastoric',
      'perete posterior diam distolic',
      'perete posterior diam. distolic',
      'peretele posterior diam diastolic',
      'peretele posterior diam. diastolic',
      // Whisper may transcribe "perete" as "priete".
      'priete posterior diametrul diastolic',
      'priete posterior diametrul distolic',
      'priete posterior diam diastolic',
      'priete posterior diam. diastolic',
      'priete posterior diam distolic',
      'priete posterior',
      // Whisper may drop the initial "r" in "perete".
      'pete posterior diametrul diastolic',
      'pete posterior diametru diastolic',
      'pete posterior diam diastolic',
      'pete posterior diam. diastolic',
      'pete posterior',
      // Dictated shorthand: the doctor may omit "diametru diastolic"
      // entirely because the form context identifies this field.
      'perete posterior',
      'peretele posterior',
    ],
  },
  {
    field: 'lvEjectionFractionTeicholz',
    aliases: [
      'fractie de ejectie vs teicholz',
      'fractie de ejectie teicholz',
      'fractie de ejectie vs teicholtz',
      'fractie de ejectie teicholtz',
      'fractie de ejectie vs tai ciolti',
      'fractie de ejectie tai ciolti',
      'fractie de ejectie vs taiciolti',
      'fractie de ejectie taiciolti',
      'fractie de ejectie vs',
      'fractia de ejectie vs',
      // Whisper/colloquial plural and abbreviated forms.
      'fractii de ejectie vs',
      'fractiile de ejectie vs',
      'fe vs',
      'fe ventricul stang',
      'fractia de ejectie vs teicholz',
      'fractia de ejectie teicholz',
      'fractia de ejectie vs teicholtz',
      'fractia de ejectie teicholtz',
      'fractia de ejectie vs tai ciolti',
      'fractia de ejectie tai ciolti',
      'fractia de ejectie vs taiciolti',
      'fractia de ejectie taiciolti',
      // Whisper "VSE" for "VS" and "Thaischolz/Taischolz" for "Teicholz"
      'fractie de ejectie vse teicholz',
      'fractie de ejectie vse teicholtz',
      'fractie de ejectie vse tai ciolti',
      'fractie de ejectie vse taiciolti',
      'fractie de ejectie vse thaischolz',
      'fractie de ejectie thaischolz',
      'fractie de ejectie vse thaischoltz',
      'fractie de ejectie thaischoltz',
      'fractie de ejectie vse taischolz',
      'fractie de ejectie taischolz',
      'fractie de ejectie vs thaischolz',
      'fractie de ejectie vs thaischoltz',
      'fractie de ejectie vs taischolz',
      'fractia de ejectie vse teicholz',
      'fractia de ejectie vse thaischolz',
      'fractia de ejectie vse thaischoltz',
      'fractia de ejectie thaischolz',
      'fractia de ejectie thaischoltz',
      'fractia de ejectie vs thaischolz',
      'fractii de ejectie vse',
      'fractiile de ejectie vse',
      'fe vse',
      'fractie de ejectie vse',
      'fractia de ejectie vse',
      // Whisper kept only the end of "Teicholz": "Colt. Z. 62".
      'colt. z.',
      // Whisper dropped "Fracție de ejecție VS" and kept "Taiholtz, 62";
      // the name alone only ever means this field.
      'taiholtz',
      'teicholz',
      'teicholtz',
    ],
  },
  {
    field: 'shorteningFraction',
    // Whisper drops the "r": "FACție de scurtare".
    // Whisper also writes "Frații de scurtare".
    aliases: [
      'fractie de scurtare',
      'fractia de scurtare',
      'factie de scurtare',
      'factia de scurtare',
      'fratie de scurtare',
      'fratii de scurtare',
      // Whisper "Tracție de scurtare".
      'tractie de scurtare',
      'tractia de scurtare',
    ],
  },
  {
    field: 'lvMass',
    aliases: ['masa vs', 'masa vse', 'masa ventricul stang'],
  },
  {
    field: 'aortaAnnulus',
    aliases: [
      'aorta la inel',
      'aorta la inelul',
      // Whisper may drop "Aorta" at a line start ("88,\nla inel 2"). Whole
      // words only, so "la inelul mitral" does not match.
      'la inel',
      'aorta inel',
      'aortelainel',
      'aortel a inel',
      'aortel inel',
      // Whisper fuses "la inel" into "liner" ("Aorta liner, 2,4").
      'aorta liner',
      // Whisper "inere" for "inel"
      'aorta la inere',
      'aorta la inare',
      'aorta inere',
      // Whisper "enel" for "inel"
      'aorta la enel',
      'aorta la enelul',
      'aortel inere',
      'aortelainere',
      // Whisper "Aorta la liniel".
      'aorta la liniel',
    ],
  },
  {
    field: 'ascendingAorta',
    aliases: [
      'aorta ascendenta',
      'aortel ascendente',
      'aortel ascendenta',
      'aortel ascendent',
      // Whisper "ascedente"/"ascedenta" (missing n) for "ascendenta"
      'aorta ascedente',
      'aorta ascedenta',
      'aorta ascendente',
      'aortel ascedente',
      'aortel ascedenta',
      'aortel ascendente',
    ],
  },
  {
    field: 'laAnteroposteriorDiameter',
    aliases: [
      'as diametrul antero posterior',
      'as diametrul anteroposterior',
      // Shorter spoken forms without the "-l" article.
      'as diametru antero posterior',
      'as diametru anteroposterior',
      // "anterior posterior" is a known spoken variant of "antero-posterior".
      'as diametrul anterior posterior',
      'as diametru anterior posterior',
      // Whisper "Asă. Diametru anterior-posterior."
      'asa. diametru anterior posterior',
      'asa diametru anterior posterior',
      'as diametrul anterior postior',
      'as diametru anterior postior',
      // Whisper drops the "e": "antroposterior".
      'as diametrul antroposterior',
      'as diametru antroposterior',
      // Whisper drops the "n" in "antero": "atero-posterior".
      'as diametrul atero posterior',
      'as diametru atero posterior',
      'as diametrul ateroposterior',
      'as diametru ateroposterior',
      // Whisper fuses "latero"/"antero": "lanteroposterior".
      'as diametrul lanteroposterior',
      'as diametru lanteroposterior',
      'as diametrul lantero posterior',
      'as diametru lantero posterior',
      'atriul stang diametrul antero posterior',
      // Dictated without the "AS" prefix ("Diametrul anteroposterior, 3 cm").
      'diametrul anteroposterior',
      'diametrul antero posterior',
      'diametru anteroposterior',
      'diametru antero posterior',
      'diametrul antroposterior',
      'diametru antroposterior',
      'diametrul atero posterior',
      'diametru atero posterior',
      'diametrul ateroposterior',
      'diametru ateroposterior',
    ],
  },
  {
    field: 'aortaAtArch',
    aliases: [
      'aorta la nivelul crosei',
      'aorta la nivelul crossei',
      // Whisper "crossie" / "crosii" for "croșei".
      'aorta la nivelul crossie',
      'aorta la nivelul crosie',
      'aorta la nivelul crosii',
      // Whisper "Aorta la nivelul cross."
      'aorta la nivelul cross',
      'aorta la nivelul crossii',
      'aorta la nivelul crosse',
      'la nivelul crossei',
      'la nivelul cossei',
      'aorta la crosa',
      'aortel la nivelul crossei',
      'aortel la nivelul crosei',
      'aortel la crosa',
    ],
  },
  {
    field: 'pulmonaryArtery',
    aliases: [
      'artera pulmonara',
      'artera pulmonare',
      'artera volmonara',
      'arterea pulmonare',
      'atera pulmonara',
      'cartera pulmonara',
      'aorta la pulmonara',
      // Whisper "altera pulmonară" (numeric6, recorded in the app).
      'altera pulmonara',
    ],
  },

  // Apical 4C
  {
    field: 'lvLateromedialDiameter',
    aliases: [
      'vs diametrul latero median',
      'vs diametrul lateromedian',
      'vs diametru latero median',
      'vs diametru lateromedian',
      'vs diam latero median',
      'vs diam lateromedian',
      // Whisper spells VS as "VSE" ("Vse, diametru latero-median").
      'vse diametrul latero median',
      'vse diametrul lateromedian',
      'vse diametru latero median',
      'vse diametru lateromedian',
      'vs diametrul ateromedian',
      'vs diametru ateromedian',
      'vs diam ateromedian',
      // Whisper "PS" for "VS" ("PS, diametrul ateromedian").
      'ps diametrul lateromedian',
      'ps diametru lateromedian',
      'ps diametrul ateromedian',
      'ps diametru ateromedian',
      // Whisper fuses "latero"/"antero": "lanteromedian".
      'vs diametrul lanteromedian',
      'vs diametru lanteromedian',
      'vs diametrul lantero median',
      'vs diametru lantero median',
      'vse diametrul anterior median',
      'vse diametru anterior median',
    ],
  },
  {
    field: 'rvLateromedialDiameter',
    aliases: [
      'vd diametrul latero median',
      'vd diametrul lateromedian',
      'vd diametru latero median',
      'vd diametru lateromedian',
      'vd diam latero median',
      'vd diam lateromedian',
      'vd diametrul ateromedian',
      'vd diametru ateromedian',
      'vd diam ateromedian',
      // Whisper hears "VD" as "B, D".
      'b d diametrul ateromedian',
      'b d diametru ateromedian',
      'b d diametrul lateromedian',
      'b d diametru lateromedian',
      'b d diametrul latero median',
      'b d diametru latero median',
      // Whisper hears VD as "vede".
      'vede diametrul latero median',
      'vede diametrul lateromedian',
      'vede diametru latero median',
      'vede diametru lateromedian',
      'vde diametrul anterior median',
      'vde diametru anterior median',
    ],
  },
  {
    field: 'laLateromedialDiameter',
    aliases: [
      'as diametrul latero median',
      'as diametrul lateromedian',
      'as diametru latero median',
      'as diametru lateromedian',
      'as diam latero median',
      'as diam lateromedian',
      'as diametrul ateromedian',
      'as diametru ateromedian',
      'as diam ateromedian',
      'as diametrul anterior median',
      'as diametru anterior median',
    ],
  },
  {
    field: 'raLateromedialDiameter',
    aliases: [
      'ad diametrul latero median',
      'ad diametrul lateromedian',
      'ad diametru latero median',
      'ad diametru lateromedian',
      'ad diam latero median',
      'ad diam lateromedian',
      'ad diametrul ateromedian',
      'ad diametru ateromedian',
      'ad diam ateromedian',
      'a de diametrul anterior median',
      'a de diametru anterior median',
    ],
  },
  // In APICAL 4C dictation the first bare "diametrul latero-median" is
  // conventionally the VS one (the form order is VS, VD, AS, AD). The bare
  // phrase maps to VS only inside the apical 4C context; outside it the
  // phrase stays unparsed rather than guessed.
  {
    field: 'lvLateromedialDiameter',
    aliases: ['diametrul latero median', 'diametrul lateromedian', 'diam latero median', 'diam lateromedian'],
    context: 'apical4c',
  },
  {
    field: 'mapse',
    // Whisper "Map-S", "M, A, S, E" (normalized "m as e") and the fully
    // spelled "M, A, P, S, E" (normalized "m a ps e").
    aliases: ['mapse', 'map s', 'm as e', 'm a ps e'],
  },
  {
    field: 'tapse',
    // Whisper "Tap-S", "T, A, S, E" (normalized "t as e") and the fully
    // spelled "T, A, P, S, E" (normalized "t a ps e").
    aliases: ['tapse', 'tap s', 't as e', 't a ps e'],
  },

  // Alte măsurători
  {
    field: 'laArea',
    // Whisper "ARA AS" and "ARIA VS" for "Aria AS" (there is no LV area field).
    aliases: ['aria as', 'aria s', 'area as', 'area s', 'are as', 'ara as', 'aria vs', 'aria atriului stang'],
  },
  {
    field: 'raArea',
    // Whisper fuses "Aria AD" into "ARAD".
    aliases: ['aria ad', 'aria d', 'area ad', 'area d', 'are ad', 'ara ad', 'arad', 'aria atriului drept'],
  },
  {
    field: 'lvEndDiastolicVolume',
    aliases: [
      'volum telediastolic vs',
      'volumul telediastolic vs',
      'volum telediastolic',
      'volum tele diastolic vs',
      'volum tele diastolic. vs',
      'volum tele diastolic.vs',
      'volum tele diastolic',
      'volum telediastolic. vs',
      'volum telediastolic.vs',
      'vs volum telediastolic',
      'vs volum tele diastolic',
      // Whisper "telediastoric" variant (same as diameters)
      'volum telediastoric vs',
      // Whisper "Volum T, diastoric V, S". It can also be a misheard
      // telesistolic volume; a second, different value then makes both review
      // rows start unchecked (conflictingDuplicateFields) so the doctor picks.
      'volum t diastoric vs',
      'volum t diastolic vs',
      'volumul telediastoric vs',
      'volum telediastoric',
      'vs volum telediastoric',
      // Whisper hears "tele" as the digit 3 ("Volum 3, diastoric WS").
      'volum 3 diastoric vs',
      'volum 3 diastolic vs',
      // Whisper "Volum T-L, diastolic V-S" (also heard for the telesistolic one).
      'volum t l diastolic vs',
      // Whisper "Volum trediastoric V.S." (also heard for the telesistolic
      // volume, whose value then shows up as a second choice here).
      'volum trediastoric vs',
      'volum trediastolic vs',
      // Whisper "Voluntele diastoric, V, S" (distinct from the systolic one).
      'voluntele diastoric vs',
      'voluntele diastolic vs',
    ],
  },
  {
    field: 'lvEndSystolicVolume',
    aliases: [
      'volum telesistolic vs',
      'volumul telesistolic vs',
      'volum telesistolic',
      // Whisper splits "telesistolic" and may attach the "VS" directly to
      // the sentence period ("Volum tele sistolic.Vs, 9").
      'volum tele sistolic vs',
      'volum tele sistolic. vs',
      'volum tele sistolic.vs',
      'volum tele sistolic',
      'volum telesistolic. vs',
      'volum telesistolic.vs',
      'volum tele sistolic vse',
      'volum telesistolic vse',
      'vs volum telesistolic',
      // Whisper "telesistoric" variant (same as diameters) and spaced VS
      'volum telesistoric vs',
      'volumul telesistoric vs',
      'volum telesistoric',
      'vs volum telesistoric',
      'vs volum tele sistolic',
      'volum 3 sistoric vs',
      'volum 3 sistolic vs',
      // Whisper "Voluntele sistoric, V, S".
      'voluntele sistoric vs',
      'voluntele sistolic vs',
    ],
  },
  {
    field: 'lvEjectionFractionSimpson',
    aliases: [
      'fractie de ejectie simpson',
      'fractia de ejectie simpson',
      // Whisper/colloquial plural forms.
      'fractii de ejectie simpson',
      'fractiile de ejectie simpson',
      'fractie ejectie simpson',
      'fractia ejectie simpson',
      // Whisper drops the "r": "Facție de ejecție Simpson".
      'factie de ejectie simpson',
      'factia de ejectie simpson',
      // Whisper drops the "c": "Frație de ejecție Simpson".
      'fratie de ejectie simpson',
      'fatie de ejectie simpsong',
      'fatia de ejectie simpsong',
      // Whisper "Practice de ejecție Simpson" (numeric6, recorded in the app).
      'practice de ejectie simpson',
      'fe simpson',
    ],
  },
  {
    field: 'aorticValveArea',
    aliases: [
      // The "EC" suffix is dictated by Whisper with or without parentheses;
      // "area" instead of "aria" is a known Whisper variant.
      'aria valvei aortice ec',
      'aria valvei aortice (ec)',
      'aria valve aortica ec',
      'aria valve aortica (ec)',
      'area valvei aortice ec',
      'area valvei aortice (ec)',
      // Nominative forms ("aria valva aortica") and short forms without the
      // "aortice" qualifier ("area valve 5"). Whisper also hears the first
      // word as "are" ("are valvă aortică").
      'aria valva aortica',
      'area valva aortica',
      'are valva aortica',
      'aria valve aortice',
      'area valve aortice',
      'are valve aortice',
      'area valvei aortice',
      'aria valva',
      'area valva',
      'are valva',
      'aria valve',
      'area valve',
      'are valve',
      'aria valvei aortice',
      'aria valvulei aortice',
    ],
    // The aortic valve area belongs to the LVOT section, never to "Flux aortic".
    context: 'lvot',
  },
  {
    field: 'aorticValveArea',
    // When whisper drops the "Flux LVOT" heading the area is heard while the
    // aortic context is still active; only the forms that name the aortic
    // valve are accepted there (the short "aria valve" stays LVOT-only).
    aliases: [
      'aria valvei aortice',
      'area valvei aortice',
      'aria valve aortice',
      'area valve aortice',
      'aria valva aortica',
      'area valva aortica',
      'aria valvulei aortice',
    ],
    context: 'aortic',
  },
  {
    field: 'mitralValveArea',
    aliases: [
      'aria valvei mitrale',
      'aria valvei mitrala',
      // Whisper drops the ending: "ARIA valvei mitral, 4,2".
      'aria valvei mitral',
      'aria valvulei mitrale',
      'aria valvulei mitrala',
      // Whisper "area" instead of "aria".
      'area valvei mitrale',
      'area valvei mitrala',
      // Whisper drops "valvei" / "valvulei" ("area valve mitrala")
      'aria valve mitrala',
      'aria valve mitrale',
      'area valve mitrala',
      'area valve mitrale',
      // Whisper "Area valvele mitrale".
      'area valvele mitrale',
      'aria valvele mitrale',
      'aria valva mitrala',
      'area valva mitrala',
      // Whisper "are valve mitral de 3.9".
      'are valve mitral',
      'are valve mitrala',
      'are valve mitrale',
      'are valvei mitrale',
    ],
  },

  // Doppler — flux aortic
  { field: 'aorticVmax', aliases: ['vmax', 'v max'], context: 'aortic' },
  { field: 'aorticPmax', aliases: ['pmax', 'p max'], context: 'aortic' },
  { field: 'aorticPmean', aliases: ['pmediu', 'p mediu'], context: 'aortic' },

  // Doppler — flux LVOT
  { field: 'lvotVmax', aliases: ['vmax', 'v max'], context: 'lvot' },
  { field: 'lvotPmax', aliases: ['pmax', 'p max'], context: 'lvot' },
  // Whisper also drops the "I": "V, T, 22".
  { field: 'lvotVti', aliases: ['vti', 'v t i', 'v t', 'pti', 'p t i', 'fti', 'f t i'], context: 'lvot' },

  // Doppler — flux mitral
  // Bare "e"/"a"/"ea" are only matched while the mitral context is active, so
  // Whisper forms like "E4", "A5", "EA1.2" never leak into other sections.
  { field: 'mitralE', aliases: ['unda e', 'onda e', 'e'], context: 'mitral' },
  { field: 'mitralA', aliases: ['unda a', 'onda a', 'a'], context: 'mitral' },
  { field: 'mitralEaRatio', aliases: ['e/a', 'e a', 'ea', 'epa'], context: 'mitral' },
  { field: 'mitralDecelerationTime', aliases: ['tde', 'timp de deceleratie'], context: 'mitral' },
  // Whisper splits TRIV and glues the number: "TRI V104".
  { field: 'mitralTriv', aliases: ['triv', 'tri v'], context: 'mitral' },

  // Doppler — flux tricuspidian
  { field: 'tricuspidVmax', aliases: ['vmax', 'v max'], context: 'tricuspid' },
  { field: 'tricuspidPmax', aliases: ['pmax', 'p max'], context: 'tricuspid' },
  // PSVD is a unique measurement name, so it is not gated behind the
  // tricuspid flow context: Whisper may drop the initial "P" ("Svd") and the
  // phrase can be dictated without the "Flux tricuspidian" heading.
  // Whisper phonetic "psevede" for PSVD
  { field: 'psvd', aliases: ['psvd', 'svd', 'psevede', 'pseved', 'pseve de'] },
  { field: 'tricuspidE', aliases: ['unda e', 'e'], context: 'tricuspid' },
  { field: 'tricuspidA', aliases: ['unda a', 'a'], context: 'tricuspid' },
  { field: 'tricuspidEaRatio', aliases: ['e/a', 'e a', 'ea', 'epa'], context: 'tricuspid' },

  // Doppler — flux pulmonar
  { field: 'pulmonaryVmax', aliases: ['vmax', 'v max'], context: 'pulmonary' },
  { field: 'pulmonaryPmax', aliases: ['pmax', 'p max'], context: 'pulmonary' },
  { field: 'pulmonaryVti', aliases: ['vti', 'v t i', 'v t', 'pti', 'p t i', 'fti', 'f t i'], context: 'pulmonary' },

  // Doppler tisular (sept) — in this section "Unda E"/"Unda A"/"EA"/"EE" mean
  // E', A', E'/A' and E/E' respectively (not the mitral waves).
  {
    field: 'septalEPrime',
    aliases: ["unda e'", 'unda e prim', 'unda e prime', 'unda e', 'e'],
    context: 'septal',
  },
  {
    field: 'septalAPrime',
    aliases: ["unda a'", 'unda a prim', 'unda a prime', 'unda a', 'a'],
    context: 'septal',
  },
  {
    field: 'septalEaPrimeRatio',
    aliases: [
      "e'/a'",
      'e prim a prim',
      'e prim pe a prim',
      'e/a',
      'e a',
      'ea',
      // Spoken "E pe A" ("E peste A"), transcribed by Whisper as "e-pe a".
      'e pe a',
    ],
    context: 'septal',
  },
  {
    field: 'eePrimeRatio',
    aliases: ["e/e'", 'e e prim', 'e pe e prim', 'e/e', 'e e', 'ee', 'e pe e'],
    context: 'septal',
  },
  { field: 'septalS', aliases: ['unda s'], context: 'septal' },
];

export const QUALITATIVE_FIELDS: QualitativeFieldDef[] = [
  {
    field: 'aorticRegurgitation',
    aliases: [
      'regurgitare aortica',
      'regurgitarea aortica',
      'reburgitare aortica',
      'reburgitarea aortica',
      'recurgitare aortica',
      'recurgitarea aortica',
      'recucitare aortica',
      'recucitarea aortica',
      'regulcitare aortica',
      'regulcitarea aortica',
      'recurcitare aortica',
      'recurcitarea aortica',
    ],
  },
  {
    field: 'mitralRegurgitation',
    aliases: [
      'regurgitare mitrala',
      'regurgitarea mitrala',
      'recurgitare mitrala',
      'recurgitarea mitrala',
      'recucitare mitrala',
      'recucitarea mitrala',
      'regulcitare mitrala',
      'regulcitarea mitrala',
    ],
  },
  {
    field: 'tricuspidRegurgitation',
    aliases: [
      'regurgitare tricuspidiana',
      'regurgitarea tricuspidiana',
      'recurgitare tricuspidiana',
      'recurgitarea tricuspidiana',
      'recucitare tricuspidiana',
      'recucitarea tricuspidiana',
      'regulcitare tricuspidiana',
      'regulcitarea tricuspidiana',
      'recurcitare tricuspidiana',
      'recurcitarea tricuspidiana',
    ],
  },
  {
    field: 'pulmonaryRegurgitation',
    aliases: [
      'regurgitare pulmonara',
      'regurgitarea pulmonara',
      'recurgitare pulmonara',
      'recurgitarea pulmonara',
      'recucitare pulmonara',
      'recucitarea pulmonara',
      'regulcitare pulmonara',
      'regulcitarea pulmonara',
    ],
  },
  {
    field: 'pericardialFluid',
    aliases: [
      'lichid pericardic',
      // "Pericard, lichid pericardic, absent": the section word belongs to
      // this field, so it must not end up in the previous field's value.
      'pericard lichid pericardic',
      'pericard',
      // Whisper concatenation of "pericard, lichid pericardic".
      'pericardichid pericardic',
    ],
  },
  // Whisper hears "cinetica" as "genetica".
  { field: 'wallMotion', aliases: ['cinetica parietala', 'genetica parietala'] },
  { field: 'aorticValves', aliases: ['valve aortice'] },
  { field: 'mitralValves', aliases: ['valve mitrale', 'valve mitale'] },
  { field: 'tricuspidValves', aliases: ['valve tricuspide'] },
  { field: 'pulmonaryValves', aliases: ['valve pulmonare'] },
];

// Known qualitative value words used to recover Whisper concatenations such as
// "valvemitralessuple" → alias "valve mitrale" + value "suple". Matching is
// limited to this explicit list (no unrestricted fuzzy matching).
export const KNOWN_QUALITATIVE_VALUES = [
  'normale',
  'normala',
  'suple',
  'ingrosate',
  'ingrosata',
  'stenotice',
  'stenozate',
  'calcificate',
  'degenerative',
  'absent',
  'prezent',
  'usoara',
  'moderata',
  'severa',
  'hipokinetica',
  'akinetica',
  'diskinezie',
];

export type TextReplacement = { pattern: RegExp; target: string };

// Single source of truth for the text rewrites applied before matching; used
// by normalizeWithIndex() and therefore by normalize() as well, so alias
// matching and value extraction always see the same normalized text.
//
// Dotted abbreviations like "V.S." / "V S" / "V, S" -> "vs" for chamber
// prefixes that Whisper often splits. They run on already-lowercased
// normalized text (a-z only). Commas/semicolons between letters are also
// normalized because Whisper often dictates "V, S," with commas.
export const ABBREVIATION_REPLACEMENTS: TextReplacement[] = [
  { pattern: /\bv\s*[.,;]?\s*s\s*[.,;]?\s*e\.?(?![a-z0-9])/g, target: 'vse' },
  { pattern: /\bv\s*[.,;]?\s*s\.?(?![a-z0-9])/g, target: 'vs' },
  { pattern: /\bv\s*[.,;]?\s*d\.?(?![a-z0-9])/g, target: 'vd' },
  { pattern: /\ba\s*[.,;]?\s*s\.?(?![a-z0-9])/g, target: 'as' },
  { pattern: /\ba\s*[.,;]?\s*d\.?(?![a-z0-9])/g, target: 'ad' },
  { pattern: /\bp\s*[.,;]?\s*s\.?(?![a-z0-9])/g, target: 'ps' },
  { pattern: /\bf\s*[.,;]?\s*e\.?(?![a-z0-9])/g, target: 'fe' },
];

// Whisper typos: "ejencție" (ejenctie) for "ejecție" (extra 'n'), "daimetru"
// for "diametru" (swapped vowel), "VSE" spelled "vese" (ve+se), and the
// Romanian inflection "telesistelor" for "telesistolic/telediastolic".
export const TYPO_REPLACEMENTS: TextReplacement[] = [
  { pattern: /\bejenctie\b/g, target: 'ejectie' },
  { pattern: /\bejentie\b/g, target: 'ejectie' },
  { pattern: /\bejencie\b/g, target: 'ejectie' },
  { pattern: /daimetr/g, target: 'diametr' },
  { pattern: /\bvese\b/g, target: 'vse' },
  { pattern: /telesistelor/g, target: 'telesistolic' },
  { pattern: /telesistolor/g, target: 'telesistolic' },
  { pattern: /telediastelor/g, target: 'telediastolic' },
  { pattern: /telediastolor/g, target: 'telediastolic' },
  { pattern: /\bsistelor\b/g, target: 'sistolic' },
  { pattern: /\bsistolor\b/g, target: 'sistolic' },
  { pattern: /\bdiastelor\b/g, target: 'diastolic' },
  { pattern: /\bdiastolor\b/g, target: 'diastolic' },
  // Whisper spells the atria "ASE" / "ADE" and fuses "Aria AS" into "Arease".
  { pattern: /\barease\b/g, target: 'aria as' },
  { pattern: /\bareade\b/g, target: 'aria ad' },
  { pattern: /\base\b/g, target: 'as' },
  { pattern: /\bade\b/g, target: 'ad' },
  // Whisper hears "latero-median" as "anteromedian" (same length, so the
  // raw index stays aligned).
  { pattern: /\banteromedian\b/g, target: 'lateromedian' },
  // Whisper spells "VS" as "WS" ("WS, diametrul lateromedian"); same length.
  { pattern: /\bws\b/g, target: 'vs' },
  // ... and as "vâsă" ("Vâsă, diametrul 3, diastoric 1"); not a Romanian word.
  { pattern: /\bvasa\b/g, target: 'vs' },
  // Whisper "onda" for "unda" in every Doppler section ("onda E' 9"); not a
  // Romanian word, same length.
  { pattern: /\bonda\b/g, target: 'unda' },
  // Whisper "diametrio" for "diametrul"; same length.
  { pattern: /\bdiametrio\b/g, target: 'diametrul' },
  // ... and "diametro" for "diametru"; same length.
  { pattern: /\bdiametro\b/g, target: 'diametru' },
];
