import type { MeasurementKey } from '../types/echoReport.js';
import { findRomanianNumber } from './romanianNumberParser.js';
import { findUnit } from './unitNormalizer.js';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ParsedMeasurementKind = 'numeric' | 'qualitative';

export type ParsedMeasurement = {
  field: MeasurementKey;
  label: string;
  value: string;
  unit?: string;
  kind: ParsedMeasurementKind;
  confidence: ConfidenceLevel;
  sourceText: string;
};

export type ParsedConclusion = {
  field: 'conclusions';
  label: 'Concluzii';
  value: string;
  kind: 'qualitative';
  confidence: 'high';
  sourceText: string;
};

export type ParsedDetectedItem = ParsedMeasurement | ParsedConclusion;

export type ParsedPatientInfo = {
  lastName: string;
  firstName: string;
  age: string;
  weight: string;
  height: string;
};

export type ParsedEchoData = {
  measurements: ParsedMeasurement[];
  conclusions: string;
  patient: ParsedPatientInfo;
};

type FlowContext = 'aortic' | 'lvot' | 'mitral' | 'tricuspid' | 'pulmonary' | 'septal' | 'apical4c';

type NumericFieldDef = {
  field: MeasurementKey;
  label: string;
  aliases: string[];
  context?: FlowContext;
  // Section contexts in which this definition must NOT be applied, even
  // without an explicit context requirement (e.g. an unprefixed diameter
  // phrase that only belongs to the parasternal longitudinal section).
  excludeContexts?: FlowContext[];
};

type QualitativeFieldDef = {
  field: MeasurementKey;
  label: string;
  aliases: string[];
};

const CONTEXT_ALIASES: Record<FlowContext, string[]> = {
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
  mitral: ['flux mitral', 'fluxul mitral'],
  tricuspid: [
    'flux tricuspidian',
    'fluxul tricuspidian',
    // A regurgitation phrase stays in the tricuspid section: a following
    // bare "Vmax"/"PSVD" belongs to it even when the doctor did not dictate
    // the "Flux tricuspidian" heading.
    'regurgitare tricuspidiana',
    'regurgitarea tricuspidiana',
    'recurgitare tricuspidiana',
    'recurgitarea tricuspidiana',
    'recucitare tricuspidiana',
    'recucitarea tricuspidiana',
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
  ],
  apical4c: ['apical 4c', 'apical 4 camere', 'apicala 4 camere'],
};

const NUMERIC_FIELDS: NumericFieldDef[] = [
  // Secțiune longitudinală parasternală
  {
    field: 'lvEndDiastolicDiameter',
    label: 'VS — diametrul telediastolic',
    aliases: [
      'vs diametrul telediastolic',
      'vs diametrul telediastoric',
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
      'vse diametrul telediastolic',
      'vse telediastolic',
      'vse telediastoric',
      'vse diametru telediastolic',
      'vse diametru telediastoric',
      'vse diametrul tele diastolic',
    ],
  },
  // Unprefixed telediastolic forms (same parasternal rule as above).
  {
    field: 'lvEndDiastolicDiameter',
    label: 'VS — diametrul telediastolic',
    aliases: [
      'diametrul telediastolic',
      'diametrul telediastoric',
      'diametrul tele diastolic',
      'diametrul tele diastoric',
      'diametru tele diastolic',
      'diametrul diastolic',
      'diametrul diastoric',
      'diametru diastolic',
      'diametru diastoric',
    ],
    excludeContexts: ['apical4c'],
  },
  {
    field: 'lvEndSystolicDiameter',
    label: 'VS — diametrul telesistolic',
    aliases: [
      'vs diametrul telesistolic',
      // Whisper splits "telesistolic" into "tele sistolic" (with or
      // without a comma between the two words).
      'vs diametrul tele sistolic',
      'vs diametru tele sistolic',
      'vs diametru telesistolic',
      'vs diametru telesistoric',
      'vs diametrul telesistoric',
      'vs telesistolic',
      // Whisper "teletistolic" / "tele tistolic" (s -> t) for telesistolic
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
      'vse diametrul tele sistolic',
      'vse diametru tele sistolic',
      'vse diametru telesistolic',
      'vse diametru telesistoric',
      'vse diametrul telesistoric',
      'vse telesistolic',
      'vse diametrul teletistolic',
      'vse diametru teletistolic',
      'vse diametrul tele tistolic',
      'vse diametru tele tistolic',
      'vse teletistolic',
      'vse diametru telesistolic',
    ],
  },
  // Unprefixed diameters: in parasternal longitudinal dictation the doctor
  // may omit "VS" because the section identifies the field. The bare
  // phrases map to the VS diameters only when no other section context
  // (e.g. APICAL 4C, where diameters are latero-median) is active.
  {
    field: 'lvEndSystolicDiameter',
    label: 'VS — diametrul telesistolic',
    aliases: [
      'diametrul telesistolic',
      'diametrul tele sistolic',
      'diametrul teletistolic',
      'diametrul tele tistolic',
    ],
    excludeContexts: ['apical4c'],
  },
  {
    field: 'ivsDiastolicDiameter',
    label: 'SIV — diametrul diastolic',
    aliases: [
      'siv diametrul diastolic',
      'siv diametrul diastoric',
      // Shorter spoken form without the "-l" article.
      'siv diametru diastolic',
      'siv diametru diastoric',
      'siv diam diastolic',
      'siv diam. diastolic',
      'siv diastolic',
      'siv diastoric',
      // Known Whisper transcription variants of "diastolic".
      'siv diametrul siastolic',
      'siv diam siastolic',
      'siv diametrul diasolic',
      'siv diam diasolic',
      'sept interventricular diametrul diastolic',
      'sept interventricular diametrul diastoric',
    ],
  },
  {
    field: 'posteriorWallDiastolicDiameter',
    label: 'Perete posterior — diametrul diastolic',
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
    label: 'Fracție de ejecție VS (Teicholz)',
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
    ],
  },
  {
    field: 'shorteningFraction',
    label: 'Fracție de scurtare',
    aliases: ['fractie de scurtare', 'fractia de scurtare'],
  },
  {
    field: 'lvMass',
    label: 'Masă VS',
    aliases: ['masa vs', 'masa vse', 'masa ventricul stang'],
  },
  {
    field: 'aortaAnnulus',
    label: 'Aortă la inel',
    aliases: [
      'aorta la inel',
      'aorta la inelul',
      'aorta inel',
      'aortelainel',
      'aortel a inel',
      'aortel inel',
      // Whisper "inere" for "inel"
      'aorta la inere',
      'aorta la inare',
      'aorta inere',
      'aortel inere',
      'aortelainere',
    ],
  },
  {
    field: 'ascendingAorta',
    label: 'Aortă ascendentă',
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
    label: 'AS — diametrul antero-posterior',
    aliases: [
      'as diametrul antero posterior',
      'as diametrul anteroposterior',
      // Shorter spoken forms without the "-l" article.
      'as diametru antero posterior',
      'as diametru anteroposterior',
      // "anterior posterior" is a known spoken variant of "antero-posterior".
      'as diametrul anterior posterior',
      'as diametru anterior posterior',
      'ase diametrul anterior postior',
      'ase diametru anterior postior',
      'atriul stang diametrul antero posterior',
      // Dictated without the "AS" prefix ("Diametrul anteroposterior, 3 cm").
      'diametrul anteroposterior',
      'diametrul antero posterior',
    ],
  },
  {
    field: 'aortaAtArch',
    label: 'Aortă la nivelul croșei',
    aliases: [
      'aorta la nivelul crosei',
      'aorta la nivelul crossei',
      'aorta la crosa',
      'aortel la nivelul crossei',
      'aortel la nivelul crosei',
      'aortel la crosa',
    ],
  },
  {
    field: 'pulmonaryArtery',
    label: 'Arteră pulmonară',
    aliases: ['artera pulmonara', 'atera pulmonara', 'aorta la pulmonara'],
  },

  // Apical 4C
  {
    field: 'lvLateromedialDiameter',
    label: 'VS — diametrul latero-median',
    aliases: [
      'vs diametrul latero median',
      'vs diametrul lateromedian',
      'vs diametru latero median',
      'vs diametru lateromedian',
      'vs diam latero median',
      'vs diam lateromedian',
      'vs diametrul ateromedian',
      'vs diametru ateromedian',
      'vs diam ateromedian',
      'vse diametrul anterior median',
      'vse diametru anterior median',
    ],
  },
  {
    field: 'rvLateromedialDiameter',
    label: 'VD — diametrul latero-median',
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
      'vde diametrul anterior median',
      'vde diametru anterior median',
    ],
  },
  {
    field: 'laLateromedialDiameter',
    label: 'AS — diametrul latero-median',
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
      'ase diametrul anterior median',
      'ase diametru anterior median',
    ],
  },
  {
    field: 'raLateromedialDiameter',
    label: 'AD — diametrul latero-median',
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
    label: 'VS — diametrul latero-median',
    aliases: ['diametrul latero median', 'diametrul lateromedian', 'diam latero median', 'diam lateromedian'],
    context: 'apical4c',
  },
  {
    field: 'mapse',
    label: 'MAPSE',
    aliases: ['mapse'],
  },
  {
    field: 'tapse',
    label: 'TAPSE',
    aliases: ['tapse'],
  },

  // Alte măsurători
  {
    field: 'laArea',
    label: 'Aria AS',
    aliases: ['aria as', 'area as', 'aria atriului stang'],
  },
  {
    field: 'raArea',
    label: 'Aria AD',
    aliases: ['aria ad', 'area ad', 'aria atriului drept'],
  },
  {
    field: 'lvEndDiastolicVolume',
    label: 'Volum telediastolic VS',
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
    ],
  },
  {
    field: 'lvEndSystolicVolume',
    label: 'Volum telesistolic VS',
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
    ],
  },
  {
    field: 'lvEjectionFractionSimpson',
    label: 'Fracție de ejecție Simpson',
    aliases: [
      'fractie de ejectie simpson',
      'fractia de ejectie simpson',
      // Whisper/colloquial plural forms.
      'fractii de ejectie simpson',
      'fractiile de ejectie simpson',
      'fractie ejectie simpson',
      'fractia ejectie simpson',
      'fatie de ejectie simpsong',
      'fatia de ejectie simpsong',
      'fe simpson',
    ],
  },
  {
    field: 'aorticValveArea',
    label: 'Aria valvei aortice (EC)',
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
    field: 'mitralValveArea',
    label: 'Aria valvei mitrale',
    aliases: [
      'aria valvei mitrale',
      'aria valvei mitrala',
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
      'aria valva mitrala',
      'area valva mitrala',
    ],
  },

  // Doppler — flux aortic
  { field: 'aorticVmax', label: 'Flux aortic — Vmax', aliases: ['vmax', 'v max'], context: 'aortic' },
  { field: 'aorticPmax', label: 'Flux aortic — Pmax', aliases: ['pmax', 'p max'], context: 'aortic' },
  { field: 'aorticPmean', label: 'Flux aortic — Pmediu', aliases: ['pmediu', 'p mediu'], context: 'aortic' },

  // Doppler — flux LVOT
  { field: 'lvotVmax', label: 'Flux LVOT — Vmax', aliases: ['vmax', 'v max'], context: 'lvot' },
  { field: 'lvotPmax', label: 'Flux LVOT — Pmax', aliases: ['pmax', 'p max'], context: 'lvot' },
  { field: 'lvotVti', label: 'Flux LVOT — VTI', aliases: ['vti', 'v t i', 'pti', 'p t i', 'fti', 'f t i'], context: 'lvot' },

  // Doppler — flux mitral
  // Bare "e"/"a"/"ea" are only matched while the mitral context is active, so
  // Whisper forms like "E4", "A5", "EA1.2" never leak into other sections.
  { field: 'mitralE', label: 'Flux mitral — Undă E', aliases: ['unda e', 'onda e', 'e'], context: 'mitral' },
  { field: 'mitralA', label: 'Flux mitral — Undă A', aliases: ['unda a', 'onda a', 'a'], context: 'mitral' },
  { field: 'mitralEaRatio', label: 'Flux mitral — E/A', aliases: ['e/a', 'e a', 'ea', 'epa'], context: 'mitral' },
  { field: 'mitralDecelerationTime', label: 'Flux mitral — TDE', aliases: ['tde', 'timp de deceleratie'], context: 'mitral' },
  { field: 'mitralTriv', label: 'Flux mitral — TRIV', aliases: ['triv'], context: 'mitral' },

  // Doppler — flux tricuspidian
  { field: 'tricuspidVmax', label: 'Flux tricuspidian — Vmax', aliases: ['vmax', 'v max'], context: 'tricuspid' },
  { field: 'tricuspidPmax', label: 'Flux tricuspidian — Pmax', aliases: ['pmax', 'p max'], context: 'tricuspid' },
  // PSVD is a unique measurement name, so it is not gated behind the
  // tricuspid flow context: Whisper may drop the initial "P" ("Svd") and the
  // phrase can be dictated without the "Flux tricuspidian" heading.
  // Whisper phonetic "psevede" for PSVD
  { field: 'psvd', label: 'Flux tricuspidian — PSVD', aliases: ['psvd', 'svd', 'psevede', 'pseved', 'pseve de'] },
  { field: 'tricuspidE', label: 'Flux tricuspidian — Undă E', aliases: ['unda e', 'e'], context: 'tricuspid' },
  { field: 'tricuspidA', label: 'Flux tricuspidian — Undă A', aliases: ['unda a', 'a'], context: 'tricuspid' },
  { field: 'tricuspidEaRatio', label: 'Flux tricuspidian — E/A', aliases: ['e/a', 'e a', 'ea', 'epa'], context: 'tricuspid' },

  // Doppler — flux pulmonar
  { field: 'pulmonaryVmax', label: 'Flux pulmonar — Vmax', aliases: ['vmax', 'v max'], context: 'pulmonary' },
  { field: 'pulmonaryPmax', label: 'Flux pulmonar — Pmax', aliases: ['pmax', 'p max'], context: 'pulmonary' },
  { field: 'pulmonaryVti', label: 'Flux pulmonar — VTI', aliases: ['vti', 'v t i', 'pti', 'p t i', 'fti', 'f t i'], context: 'pulmonary' },

  // Doppler tisular (sept) — in this section "Unda E"/"Unda A"/"EA"/"EE" mean
  // E', A', E'/A' and E/E' respectively (not the mitral waves).
  {
    field: 'septalEPrime',
    label: "Doppler tisular — Undă E'",
    aliases: ["unda e'", 'unda e prim', 'unda e prime', 'unda e', 'e'],
    context: 'septal',
  },
  {
    field: 'septalAPrime',
    label: "Doppler tisular — Undă A'",
    aliases: ["unda a'", 'unda a prim', 'unda a prime', 'unda a', 'a'],
    context: 'septal',
  },
  {
    field: 'septalEaPrimeRatio',
    label: "Doppler tisular — E'/A'",
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
    label: "Doppler tisular — E/E'",
    aliases: ["e/e'", 'e e prim', 'e pe e prim', 'e/e', 'e e', 'ee', 'e pe e'],
    context: 'septal',
  },
  { field: 'septalS', label: 'Doppler tisular — Undă S', aliases: ['unda s'], context: 'septal' },
];

const QUALITATIVE_FIELDS: QualitativeFieldDef[] = [
  {
    field: 'aorticRegurgitation',
    label: 'Regurgitare aortică',
    aliases: [
      'regurgitare aortica',
      'regurgitarea aortica',
      'reburgitare aortica',
      'reburgitarea aortica',
      'recurgitare aortica',
      'recurgitarea aortica',
      'recucitare aortica',
      'recucitarea aortica',
      'recurcitare aortica',
      'recurcitarea aortica',
    ],
  },
  {
    field: 'mitralRegurgitation',
    label: 'Regurgitare mitrală',
    aliases: [
      'regurgitare mitrala',
      'regurgitarea mitrala',
      'recurgitare mitrala',
      'recurgitarea mitrala',
      'recucitare mitrala',
      'recucitarea mitrala',
    ],
  },
  {
    field: 'tricuspidRegurgitation',
    label: 'Regurgitare tricuspidiană',
    aliases: [
      'regurgitare tricuspidiana',
      'regurgitarea tricuspidiana',
      'recurgitare tricuspidiana',
      'recurgitarea tricuspidiana',
      'recucitare tricuspidiana',
      'recucitarea tricuspidiana',
      'recurcitare tricuspidiana',
      'recurcitarea tricuspidiana',
    ],
  },
  {
    field: 'pulmonaryRegurgitation',
    label: 'Regurgitare pulmonară',
    aliases: [
      'regurgitare pulmonara',
      'regurgitarea pulmonara',
      'recurgitare pulmonara',
      'recurgitarea pulmonara',
      'recucitare pulmonara',
      'recucitarea pulmonara',
    ],
  },
  {
    field: 'pericardialFluid',
    label: 'Lichid pericardic',
    aliases: [
      'lichid pericardic',
      // Whisper concatenation of "pericard, lichid pericardic".
      'pericardichid pericardic',
    ],
  },
  { field: 'wallMotion', label: 'Cinetică parietală', aliases: ['cinetica parietala'] },
  { field: 'aorticValves', label: 'Valve aortice', aliases: ['valve aortice'] },
  { field: 'mitralValves', label: 'Valve mitrale', aliases: ['valve mitrale'] },
  { field: 'tricuspidValves', label: 'Valve tricuspide', aliases: ['valve tricuspide'] },
  { field: 'pulmonaryValves', label: 'Valve pulmonare', aliases: ['valve pulmonare'] },
];

// Known qualitative value words used to recover Whisper concatenations such as
// "valvemitralessuple" → alias "valve mitrale" + value "suple". Matching is
// limited to this explicit list (no unrestricted fuzzy matching).
const KNOWN_QUALITATIVE_VALUES = [
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

const LOW_CONFIDENCE_PATTERNS: RegExp[] = [
  /\b(?:probabil|posibil|nesigur|banuiesc)\b/,
  /\bnu\s+sunt\s+sigur\b/,
  /\bnu\s+stiu\b/,
];

const MEDIUM_CONFIDENCE_PATTERNS: RegExp[] = [
  /\b(?:aproximativ|aprox|circa|cam)\b/,
  /\bin\s+jur\s+de\b/,
];

const QUALITATIVE_CONNECTORS = /\b(?:este|e|sunt|are|cu|de|se|un|o)\s+/;

// A punctuation mark ends a value window unless it sits between two digits
// and is therefore a decimal separator ("4.8"). A sentence-ending period
// after a number ("2,2. Următoarea…") still ends the window. A period
// directly after a field label ("Aorta la inel. 2") is treated as a
// field-separator when a number follows, so it must NOT end the window.
const PUNCTUATION_BOUNDARY = /(?<!\d)[.!?;…\n](?!\s*\d)|(?<=\d)[.!?;…\n](?!\d)/;

function isSpace(ch: string): boolean {
  return /\s/.test(ch);
}

function normalizeChar(ch: string): string {
  const lower = ch.toLocaleLowerCase('ro-RO');
  const decomposed = lower.normalize('NFD');
  let out = '';
  for (const part of decomposed) {
    if (/\p{M}/u.test(part)) continue;
    out += part;
  }
  return out.replace(/[șş]/g, 's').replace(/[țţ]/g, 't');
}

// Normalizes dotted abbreviations like "V.S." / "V S" / "V, S" -> "vs" for chamber
// prefixes that Whisper often splits. Must run on already-lowercased
// normalized text (a-z only). Commas/semicolons between letters are also
// normalized because Whisper often dictates "V, S," with commas.
function normalizeAbbreviations(text: string): string {
  return text
    .replace(/\bv\s*[.,;]?\s*s\s*[.,;]?\s*e\.?(?![a-z0-9])/g, 'vse')
    .replace(/\bv\s*[.,;]?\s*s\.?(?![a-z0-9])/g, 'vs')
    .replace(/\bv\s*[.,;]?\s*d\.?(?![a-z0-9])/g, 'vd')
    .replace(/\ba\s*[.,;]?\s*s\.?(?![a-z0-9])/g, 'as')
    .replace(/\ba\s*[.,;]?\s*d\.?(?![a-z0-9])/g, 'ad')
    .replace(/\bp\s*[.,;]?\s*s\.?(?![a-z0-9])/g, 'ps')
    .replace(/\bf\s*[.,;]?\s*e\.?(?![a-z0-9])/g, 'fe');
}

// Whisper typo "ejencție" (ejenctie) for "ejecție" (ejectie) — extra 'n'.
function normalizeEjectieTypo(text: string): string {
  return text
    .replace(/\bejenctie\b/g, 'ejectie')
    .replace(/\bejentie\b/g, 'ejectie')
    .replace(/\bejencie\b/g, 'ejectie');
}

// Whisper typo "daimetru" for "diametru" — swapped vowel (a-i vs i-a).
function normalizeDaimetruTypo(text: string): string {
  return text.replace(/daimetr/g, 'diametr');
}

// Whisper transcribes "VSE" letter-by-letter as "vese" (ve+se) and
// "telesistolic/telediastolic" with Romanian inflection "telesistelor".
function normalizeVseAndTelesistelorTypo(text: string): string {
  return text
    .replace(/\bvese\b/g, 'vse')
    .replace(/telesistelor/g, 'telesistolic')
    .replace(/telesistolor/g, 'telesistolic')
    .replace(/telediastelor/g, 'telediastolic')
    .replace(/telediastolor/g, 'telediastolic')
    .replace(/\bsistelor\b/g, 'sistolic')
    .replace(/\bsistolor\b/g, 'sistolic')
    .replace(/\bdiastelor\b/g, 'diastolic')
    .replace(/\bdiastolor\b/g, 'diastolic');
}

// Protects decimal commas ("5,3", "4,85", "4, 5") from ever being treated as
// separators by replacing them with a decimal point. Whisper often inserts
// a space after the comma ("4, 5"), so optional whitespace is consumed.
// The replacement normalizes to "digit.digit" and keeps length differences
// minimal; rawIndex mapping stays valid because normalizeWithIndex also
// collapses whitespace.
function protectDecimalCommas(text: string): string {
  return text.replace(/(\d),\s*(\d)/g, '$1.$2');
}

function normalize(text: string): string {
  let out = '';
  for (const ch of text) {
    if (isSpace(ch) || ch === '-') {
      if (out.length > 0 && out[out.length - 1] !== ' ') out += ' ';
      continue;
    }
    out += normalizeChar(ch);
  }
  return normalizeVseAndTelesistelorTypo(
    normalizeDaimetruTypo(
      normalizeEjectieTypo(normalizeAbbreviations(protectDecimalCommas(out.trim()))),
    ),
  );
}

// Collapses whitespace/hyphens and records the raw position of every
// normalized character so that spans can be mapped back to the transcript.
// Also protects decimal commas, including Whisper's "4, 5" with a space,
// while keeping rawIndex accurate (removed spaces don't get an entry).
function normalizeWithIndex(raw: string): { text: string; rawIndex: number[] } {
  let text = '';
  const rawIndex: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (isSpace(ch) || ch === '-') {
      if (text.length > 0 && text[text.length - 1] !== ' ') {
        text += ' ';
        rawIndex.push(i);
      }
      continue;
    }
    text += normalizeChar(ch);
    rawIndex.push(i);
  }
  const trimmed = text.trim();
  // Trim start: drop leading rawIndex entries corresponding to leading spaces
  const leadingSpaces = text.length - text.trimStart().length;
  let trimmedRawIndex = rawIndex.slice(leadingSpaces);
  // Trim end: if original had trailing space, last char was ' ' and already trimmed
  if (trimmed.length < trimmedRawIndex.length) {
    trimmedRawIndex = trimmedRawIndex.slice(0, trimmed.length);
  }
  // Protect decimal commas "4,5" and Whisper "4, 5" -> "4.5"
  // When a space follows the comma between digits, drop it and its rawIndex.
  let out = '';
  let outRawIndex: number[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (
      ch === ',' &&
      i > 0 &&
      i + 1 < trimmed.length &&
      /\d/.test(trimmed[i - 1]) &&
      /\d/.test(trimmed[i + 1])
    ) {
      out += '.';
      outRawIndex.push(trimmedRawIndex[i]);
      continue;
    }
    if (
      ch === ' ' &&
      i > 1 &&
      trimmed[i - 1] === ',' &&
      /\d/.test(trimmed[i - 2]) &&
      i + 1 < trimmed.length &&
      /\d/.test(trimmed[i + 1])
    ) {
      // Space inside decimal "4, 5" -> skip it (already converted comma to dot)
      continue;
    }
    // Also handle case where protectDecimalCommas comma was already converted?
    // Whisper "4, 5" originally has comma->dot conversion above, space skipped here.
    out += ch;
    outRawIndex.push(trimmedRawIndex[i]);
  }
  // Normalize dotted abbreviations "V.S." / "V S" / "V, S" -> "vs" etc., keeping rawIndex
  // aligned by preserving only the letter positions (dots/spaces/commas are dropped).
  // This ensures "Masa V.S. 5" and "V, S, daimetru ..." match alias "masa vs" / "vs diametru".
  const abbrevReplacements: Array<{ pattern: RegExp; target: string }> = [
    { pattern: /\bv\s*[.,;]?\s*s\s*[.,;]?\s*e\.?(?![a-z0-9])/g, target: 'vse' },
    { pattern: /\bv\s*[.,;]?\s*s\.?(?![a-z0-9])/g, target: 'vs' },
    { pattern: /\bv\s*[.,;]?\s*d\.?(?![a-z0-9])/g, target: 'vd' },
    { pattern: /\ba\s*[.,;]?\s*s\.?(?![a-z0-9])/g, target: 'as' },
    { pattern: /\ba\s*[.,;]?\s*d\.?(?![a-z0-9])/g, target: 'ad' },
    { pattern: /\bp\s*[.,;]?\s*s\.?(?![a-z0-9])/g, target: 'ps' },
    { pattern: /\bf\s*[.,;]?\s*e\.?(?![a-z0-9])/g, target: 'fe' },
  ];
  for (const { pattern, target } of abbrevReplacements) {
    // Reset regex state for each iteration after mutation
    let match: RegExpExecArray | null;
    // Use while loop with manual index tracking because we mutate out
    pattern.lastIndex = 0;
    while ((match = pattern.exec(out)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      // Collect raw indices of letters a-z in the matched substring to map to target
      const letterIndices: number[] = [];
      for (let k = start; k < end; k += 1) {
        if (/[a-z]/.test(out[k])) letterIndices.push(outRawIndex[k]);
      }
      // Fallback: if letter extraction failed, just use first N indices
      const mappedRaw = letterIndices.slice(0, target.length);
      while (mappedRaw.length < target.length) mappedRaw.push(outRawIndex[start]);
      const newOut = out.slice(0, start) + target + out.slice(end);
      const newRaw = [...outRawIndex.slice(0, start), ...mappedRaw, ...outRawIndex.slice(end)];
      out = newOut;
      outRawIndex = newRaw;
      pattern.lastIndex = start + target.length;
      // For patterns like "v s" that could overlap, restart from start
      // to avoid missing consecutive abbreviations after replacement.
      if (pattern.lastIndex > out.length) break;
    }
  }
  // Whisper typos: "ejenctie" (ejencție) -> "ejectie" (extra 'n'),
  // "daimetru" -> "diametru" (swapped vowel), "vese" (ve+se) -> "vse" and
  // "telesistelor" -> "telesistolic" (inflection). Length changes require
  // dropping a rawIndex entry; same-length replacements keep all indices.
  const typoPatterns: Array<{ pattern: RegExp; target: string }> = [
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
  ];
  for (const { pattern, target } of typoPatterns) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(out)) !== null) {
      const s = m.index;
      const e = s + m[0].length;
      let mapped: number[];
      if (m[0] === 'ejenctie' && target === 'ejectie') {
        // e j e n c t i e (8) -> e j e c t i e (7) : drop 'n' at offset 3
        mapped = [
          outRawIndex[s],
          outRawIndex[s + 1],
          outRawIndex[s + 2],
          outRawIndex[s + 4],
          outRawIndex[s + 5],
          outRawIndex[s + 6],
          outRawIndex[s + 7],
        ];
      } else if (m[0] === 'vese' && target === 'vse') {
        // v e s e (4) -> v s e (3) : drop 'e' at offset 1
        mapped = [outRawIndex[s], outRawIndex[s + 2], outRawIndex[s + 3]];
      } else {
        // Same length: keep all indices
        mapped = outRawIndex.slice(s, e);
        // If target length differs unexpectedly, pad/truncate
        if (mapped.length !== target.length) {
          mapped = mapped.slice(0, target.length);
          while (mapped.length < target.length) mapped.push(outRawIndex[s]);
        }
      }
      out = out.slice(0, s) + target + out.slice(e);
      outRawIndex = [...outRawIndex.slice(0, s), ...mapped, ...outRawIndex.slice(e)];
      pattern.lastIndex = s + target.length;
      if (pattern.lastIndex > out.length) break;
    }
  }
  return { text: out, rawIndex: outRawIndex };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Field aliases are matched word by word, tolerating comma or semicolon
// separators between the words ("vs, diametrul telediastolic") exactly as
// Whisper dictates them. The trailing boundary allows a digit to follow the
// alias immediately so Whisper attachments like "E4", "EA1.2", "TDE9" still
// match the label and leave the number in the value window ("e"+"4", "ea"+"1.2").
// A following letter still ends the match, so "area" never matches bare "a".
function aliasPattern(alias: string): RegExp {
  const words = alias.split(' ').map((word) => escapeRegExp(word));
  return new RegExp(`(?<![a-z0-9])${words.join('[\\s,;]+')}(?![a-z])`, 'g');
}

// Qualitative aliases additionally allow a known value word to be attached
// with no space ("valve mitralesuple" → alias ends before "suple"). The known
// value is only looked ahead, never consumed, so it stays in the value window.
function qualitativeAliasPattern(alias: string): RegExp {
  const words = alias.split(' ').map((word) => escapeRegExp(word));
  const body = words.join('[\\s,;]+');
  const known = KNOWN_QUALITATIVE_VALUES.map((value) => escapeRegExp(value)).join('|');
  return new RegExp(
    `(?<![a-z0-9])${body}(?:(?![a-z])|(?=(?:${known})(?![a-z])))`,
    'g',
  );
}

type AnyMatch = {
  kind: 'context' | 'field' | 'qualitative';
  start: number;
  end: number;
  context?: FlowContext;
  def?: NumericFieldDef | QualitativeFieldDef;
};

function collectMatches(normalizedText: string): AnyMatch[] {
  const matches: AnyMatch[] = [];

  for (const [context, aliases] of Object.entries(CONTEXT_ALIASES) as [FlowContext, string[]][]) {
    for (const alias of aliases) {
      const pattern = aliasPattern(alias);
      for (const match of normalizedText.matchAll(pattern)) {
        matches.push({
          kind: 'context',
          start: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          context,
        });
      }
    }
  }

  for (const def of NUMERIC_FIELDS) {
    for (const alias of def.aliases) {
      const pattern = aliasPattern(alias);
      for (const match of normalizedText.matchAll(pattern)) {
        matches.push({
          kind: 'field',
          start: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          def,
        });
      }
    }
  }

  for (const def of QUALITATIVE_FIELDS) {
    for (const alias of def.aliases) {
      const pattern = qualitativeAliasPattern(alias);
      for (const match of normalizedText.matchAll(pattern)) {
        matches.push({
          kind: 'qualitative',
          start: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          def,
        });
      }
    }
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  return matches;
}

function countNumericValues(text: string): number {
  let count = 0;
  let rest = text;
  for (;;) {
    const found = findRomanianNumber(rest);
    if (!found) break;
    count += 1;
    rest = rest.slice(found.end);
  }
  return count;
}

// Returns the normalized index of the start of the Nth word before `from`.
function lookbackStart(text: string, from: number, wordCount: number): number {
  let pos = from;
  let seen = 0;
  while (pos > 0 && seen < wordCount) {
    let i = pos - 1;
    while (i >= 0 && /\s/.test(text[i])) i -= 1;
    if (i < 0) break;
    while (i >= 0 && !/\s/.test(text[i])) i -= 1;
    pos = i + 1;
    seen += 1;
  }
  return pos;
}

function confidenceFor(text: string): ConfidenceLevel {
  for (const pattern of LOW_CONFIDENCE_PATTERNS) {
    if (pattern.test(text)) return 'low';
  }
  for (const pattern of MEDIUM_CONFIDENCE_PATTERNS) {
    if (pattern.test(text)) return 'medium';
  }
  return 'high';
}

// Strips leading connective words ("este", "de", ...) from a qualitative value
// and returns the raw transcript text of the value. A leading field-separator
// comma after the alias ("lichid pericardic, absent") is not part of the value.
function qualitativeValue(rawWindow: string): string | null {
  const { text, rawIndex } = normalizeWithIndex(rawWindow);
  let pos = 0;
  let rest = text;
  for (;;) {
    const match = QUALITATIVE_CONNECTORS.exec(rest);
    if (match && match.index === 0) {
      pos += match[0].length;
      rest = rest.slice(match[0].length);
      continue;
    }
    break;
  }
  if (pos >= rawIndex.length) return null;
  const value = rawWindow
    .slice(rawIndex[pos])
    .replace(/^[\s,;]+/, '')
    .replace(/[\s,;]+$/g, '')
    .trim();
  return value || null;
}

function findNextPunctuation(raw: string, from: number, limit: number): number | null {
  const match = PUNCTUATION_BOUNDARY.exec(raw.slice(from, limit));
  return match ? from + (match.index ?? 0) : null;
}

const CONCLUSIONS_MARKER = /\bconcluzi(?:i|e)\s*[:.,-]?\s*/i;

function extractConclusions(transcript: string): string {
  const match = CONCLUSIONS_MARKER.exec(transcript);
  if (!match) return '';
  return transcript.slice(match.index + match[0].length).trim();
}

function beforeConclusions(transcript: string): string {
  const match = CONCLUSIONS_MARKER.exec(transcript);
  return match ? transcript.slice(0, match.index) : transcript;
}

// ---------------------------------------------------------------------------
// Patient data extraction ("Nume Popescu, prenume Ion, vârsta 65 de ani, ...")
// ---------------------------------------------------------------------------

const ROMANIAN_LETTER_CLASS = 'a-zA-ZăâîșțşţĂÂÎȘȚŞŢ';
const NO_LETTER_BEFORE = `(?<![${ROMANIAN_LETTER_CLASS}])`;
const NO_LETTER_AFTER = `(?![${ROMANIAN_LETTER_CLASS}])`;

// Words that terminate a dictated name: the next field label, a unit, or a
// connector. They are never part of a patient's name.
const PATIENT_NAME_STOP_WORDS = new Set([
  'si', 'și', 'de', 'cu', 'la',
  'nume', 'numele', 'prenume', 'prenumele', 'familie',
  'pacient', 'pacientul', 'pacienta', 'pacientului', 'pacientei',
  'varsta', 'vârsta', 'vârstă', 'varstă', 'an', 'ani',
  'greutate', 'greutatea', 'reutate', 'reutatea', 'kg', 'kilograme', 'kilogramele',
  'inaltime', 'inaltimea', 'înălțime', 'înălțimea', 'cm', 'centimetri',
  'data', 'examinare', 'examinarea', 'examinarii', 'examinării',
  'numar', 'număr', 'numărul', 'curent', 'curentul', 'concluzii',
]);

function patientLabelRegex(source: string): RegExp {
  return new RegExp(
    `${NO_LETTER_BEFORE}${source}${NO_LETTER_AFTER}\\s*[:.,-]?\\s*(?:de\\s+)?`,
    'i',
  );
}

const COMBINED_NAME_LABEL = new RegExp(
  `${NO_LETTER_BEFORE}nume[\\s,]+(?:și|si)[\\s,]+prenume${NO_LETTER_AFTER}\\s*[:.,-]?\\s*`,
  'i',
);
const LAST_NAME_LABEL = patientLabelRegex(
  'nume(?:le)?(?:\\s+de\\s+familie)?(?:\\s+pacientului|\\s+pacientei|\\s+pacienta|\\s+pacientul)?',
);
const FIRST_NAME_LABEL = patientLabelRegex(
  'prenume(?:le)?(?:\\s+pacientului|\\s+pacientei|\\s+pacienta|\\s+pacientul)?',
);
const AGE_LABEL = patientLabelRegex('v[âa]rst[aă]');
const WEIGHT_LABEL = patientLabelRegex('(?:g)?reutate[aă]?');
const HEIGHT_LABEL = patientLabelRegex('[îi]n[ăa]l[tțţ]ime[aă]?');

function captureNameWords(raw: string, from: number, maxWords: number): string[] {
  const wordPattern = new RegExp(
    `[${ROMANIAN_LETTER_CLASS}]+(?:-[${ROMANIAN_LETTER_CLASS}]+)*`,
    'g',
  );
  wordPattern.lastIndex = from;
  const words: string[] = [];
  const limit = Math.min(raw.length, from + 80);
  while (words.length < maxWords) {
    const match = wordPattern.exec(raw);
    if (!match || match.index >= limit) break;
    if (PATIENT_NAME_STOP_WORDS.has(match[0].toLocaleLowerCase('ro-RO'))) break;
    words.push(match[0]);
  }
  return words;
}

function capitalizeName(name: string): string {
  return name.replace(
    new RegExp(`(^|[\\s-])([${ROMANIAN_LETTER_CLASS}])`, 'g'),
    (_match, sep: string, letter: string) => sep + letter.toLocaleUpperCase('ro-RO'),
  );
}

/**
 * Extracts explicitly dictated patient data. Only the text before the
 * "Concluzii" marker is scanned: conclusions routinely mention the patient's
 * age ("pacient în vârstă de ...") and must not overwrite the form fields.
 */
function extractPatientInfo(transcript: string): ParsedPatientInfo {
  const patient: ParsedPatientInfo = {
    lastName: '',
    firstName: '',
    age: '',
    weight: '',
    height: '',
  };

  const conclusionsMatch = CONCLUSIONS_MARKER.exec(transcript);
  const scope = conclusionsMatch ? transcript.slice(0, conclusionsMatch.index) : transcript;
  if (!scope.trim()) return patient;

  // "Nume și prenume Popescu Ion" — first word is the family name.
  const combined = COMBINED_NAME_LABEL.exec(scope);
  if (combined) {
    const words = captureNameWords(scope, combined.index + combined[0].length, 3);
    if (words.length > 0) patient.lastName = capitalizeName(words[0]);
    if (words.length > 1) patient.firstName = capitalizeName(words.slice(1).join(' '));
  }

  if (!patient.lastName) {
    const match = LAST_NAME_LABEL.exec(scope);
    if (match) {
      const words = captureNameWords(scope, match.index + match[0].length, 2);
      if (words.length > 0) patient.lastName = capitalizeName(words.join(' '));
    }
  }

  if (!patient.firstName) {
    const match = FIRST_NAME_LABEL.exec(scope);
    if (match) {
      const words = captureNameWords(scope, match.index + match[0].length, 2);
      if (words.length > 0) patient.firstName = capitalizeName(words.join(' '));
    }
  }

  const assignNumber = (label: RegExp, key: 'age' | 'weight' | 'height') => {
    const match = label.exec(scope);
    if (!match) return;
    const start = match.index + match[0].length;
    const found = findRomanianNumber(scope.slice(start, start + 60));
    if (found) patient[key] = found.value;
  };

  assignNumber(AGE_LABEL, 'age');
  assignNumber(WEIGHT_LABEL, 'weight');
  assignNumber(HEIGHT_LABEL, 'height');

  return patient;
}

/**
 * Deterministically extracts only explicitly spoken Echo measurements.
 *
 * The parser never diagnoses, interprets, infers, or invents medical data:
 * a value is extracted only when a known field alias is followed by an
 * unambiguous number (or, for qualitative fields, by dictated text). Numbers
 * that cannot be bound to a field are left untouched for manual review.
 */
export function parseEchoTranscript(transcript: string): ParsedEchoData {
  const measurements: ParsedMeasurement[] = [];
  const conclusions = extractConclusions(transcript);
  const patient = extractPatientInfo(transcript);
  const raw = beforeConclusions(transcript);
  const { text, rawIndex } = normalizeWithIndex(raw);

  if (text.length === 0) {
    return { measurements, conclusions, patient };
  }

  const matches = collectMatches(text);
  const toRaw = (index: number): number =>
    index >= text.length ? raw.length : rawIndex[index];

  let activeContext: FlowContext | null = null;
  // Aliases that start inside an already-consumed alias span are skipped:
  // they are sub-phrases of the longer alias that won at that position
  // (e.g. "diametrul anteroposterior" inside "as diametrul anteroposterior").
  let consumedUntil = -1;

  let i = 0;
  while (i < matches.length) {
    const start = matches[i].start;
    let j = i;
    while (j < matches.length && matches[j].start === start) j += 1;
    const group = matches.slice(i, j);
    i = j;

    const end = group[0].end;
    if (start < consumedUntil) continue;
    consumedUntil = end;

    // The value window ends at the first match starting at or after this
    // alias ends — a nested sub-phrase alias must never cut the window.
    let k = i;
    while (k < matches.length && matches[k].start < end) k += 1;
    const windowEnd = k < matches.length ? matches[k].start : text.length;

    // The longest alias wins at a position ("unda e'" over "unda e"); when
    // several field definitions share that alias ("vmax" exists in several
    // flow sections), the one matching the active flow context is chosen.
    const longest = group.filter((m) => m.end === end);

    const contextMatch = longest.find((m) => m.kind === 'context');
    if (contextMatch) {
      activeContext = contextMatch.context ?? null;
      // A context alias may coincide with a field alias (e.g.
      // "regurgitare tricuspidiana" both names the tricuspid section and is
      // itself a qualitative field). When that happens we fall through and
      // extract the field as well; a pure section heading has no field
      // alias at the same span and is skipped below.
    }

    const defMatch = longest.find((m) => {
      if (m.kind === 'context' || m.def === undefined) return false;
      if ('context' in m.def) {
        if (m.def.context !== undefined && m.def.context !== activeContext) return false;
      }
      const excluded = 'excludeContexts' in m.def ? m.def.excludeContexts : undefined;
      if (excluded !== undefined && activeContext !== null && excluded.includes(activeContext)) {
        return false;
      }
      return true;
    });
    if (!defMatch || !defMatch.def) continue;
    const def = defMatch.def;

    const rawStart = toRaw(start);
    const rawWindowStart = toRaw(end);
    const rawWindowEnd = toRaw(windowEnd);

    const punctuation = findNextPunctuation(raw, rawWindowStart, rawWindowEnd);
    const bound = punctuation ?? rawWindowEnd;
    const rawWindow = raw.slice(rawWindowStart, bound);
    const normWindow = normalize(rawWindow);

    const sourceText = raw.slice(rawStart, bound).trim();
    const hedgeText = text.slice(lookbackStart(text, start, 5), windowEnd);
    const confidence = confidenceFor(hedgeText);

    if (defMatch.kind === 'qualitative') {
      const value = qualitativeValue(rawWindow);
      // Bare labels like "Pericard, lichid pericardic" are valid diagnoses by
      // themselves; in that case the value is the field name itself.
      const bareLabelValue = def.field === 'pericardialFluid' ? normalize(def.label) : null;
      const resolvedValue = value ?? (rawWindow.trim() ? null : bareLabelValue);
      if (!resolvedValue) continue;
      // Drop a trailing field separator before the next known field
      // ("Valve mitralesuple, valve tricuspide..." → source ends at "suple").
      const qualitativeSource = sourceText.replace(/[\s,;]+$/g, '');
      measurements.push({
        field: def.field,
        label: def.label,
        value: resolvedValue,
        kind: 'qualitative',
        confidence,
        sourceText: qualitativeSource || sourceText,
      });
      continue;
    }

    const numericDef = def as NumericFieldDef;
    if (numericDef.context && numericDef.context !== activeContext) continue;
    if (
      numericDef.excludeContexts &&
      activeContext !== null &&
      numericDef.excludeContexts.includes(activeContext)
    ) {
      continue;
    }

    const valueCount = countNumericValues(normWindow);
    if (valueCount === 0) continue;
    if (valueCount > 1) continue;

    const number = findRomanianNumber(normWindow);
    if (!number) continue;

    if (numericDef.field === 'lvEjectionFractionTeicholz' && normWindow.includes('simpson')) continue;

    const unitMatch = findUnit(normWindow.slice(number.end));

    measurements.push({
      field: numericDef.field,
      label: numericDef.label,
      value: number.value,
      unit: unitMatch?.unit,
      kind: 'numeric',
      confidence,
      sourceText,
    });
  }

  return { measurements, conclusions, patient };
}