import { MEASUREMENT_FIELDS } from '../config/measurementFields.js';
import { convertUnit, MEASUREMENT_UNITS } from '../config/measurementUnits.js';
import { findRomanianNumber } from './romanianNumberParser.js';
import { findUnit } from './unitNormalizer.js';
const CONTEXT_ALIASES = {
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
const NUMERIC_FIELDS = [
    // Secțiune longitudinală parasternală
    {
        field: 'lvEndDiastolicDiameter',
        aliases: [
            'vs diametrul telediastolic',
            'vs diametrul telediastoric',
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
            'siv diastolic',
            'siv diastoric',
            // Known Whisper transcription variants of "diastolic".
            'siv diametrul siastolic',
            'siv diam siastolic',
            'siv diametrul diasolic',
            'siv diam diasolic',
            // Whisper hears "SIV" as "SIF".
            'sif diametrul diastolic',
            'sif diametru diastolic',
            'sif diam diastolic',
            'sif diastolic',
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
        ],
    },
    {
        field: 'shorteningFraction',
        aliases: ['fractie de scurtare', 'fractia de scurtare'],
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
            'as diametrul anterior postior',
            'as diametru anterior postior',
            'atriul stang diametrul antero posterior',
            // Dictated without the "AS" prefix ("Diametrul anteroposterior, 3 cm").
            'diametrul anteroposterior',
            'diametrul antero posterior',
            'diametru anteroposterior',
            'diametru antero posterior',
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
            'aorta la nivelul crossii',
            'aorta la crosa',
            'aortel la nivelul crossei',
            'aortel la nivelul crosei',
            'aortel la crosa',
        ],
    },
    {
        field: 'pulmonaryArtery',
        aliases: ['artera pulmonara', 'atera pulmonara', 'aorta la pulmonara'],
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
            'vs diametrul ateromedian',
            'vs diametru ateromedian',
            'vs diam ateromedian',
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
        aliases: ['mapse'],
    },
    {
        field: 'tapse',
        aliases: ['tapse'],
    },
    // Alte măsurători
    {
        field: 'laArea',
        aliases: ['aria as', 'area as', 'aria atriului stang'],
    },
    {
        field: 'raArea',
        aliases: ['aria ad', 'area ad', 'aria atriului drept'],
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
            'fatie de ejectie simpsong',
            'fatia de ejectie simpsong',
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
        field: 'mitralValveArea',
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
    { field: 'aorticVmax', aliases: ['vmax', 'v max'], context: 'aortic' },
    { field: 'aorticPmax', aliases: ['pmax', 'p max'], context: 'aortic' },
    { field: 'aorticPmean', aliases: ['pmediu', 'p mediu'], context: 'aortic' },
    // Doppler — flux LVOT
    { field: 'lvotVmax', aliases: ['vmax', 'v max'], context: 'lvot' },
    { field: 'lvotPmax', aliases: ['pmax', 'p max'], context: 'lvot' },
    { field: 'lvotVti', aliases: ['vti', 'v t i', 'pti', 'p t i', 'fti', 'f t i'], context: 'lvot' },
    // Doppler — flux mitral
    // Bare "e"/"a"/"ea" are only matched while the mitral context is active, so
    // Whisper forms like "E4", "A5", "EA1.2" never leak into other sections.
    { field: 'mitralE', aliases: ['unda e', 'onda e', 'e'], context: 'mitral' },
    { field: 'mitralA', aliases: ['unda a', 'onda a', 'a'], context: 'mitral' },
    { field: 'mitralEaRatio', aliases: ['e/a', 'e a', 'ea', 'epa'], context: 'mitral' },
    { field: 'mitralDecelerationTime', aliases: ['tde', 'timp de deceleratie'], context: 'mitral' },
    { field: 'mitralTriv', aliases: ['triv'], context: 'mitral' },
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
    { field: 'pulmonaryVti', aliases: ['vti', 'v t i', 'pti', 'p t i', 'fti', 'f t i'], context: 'pulmonary' },
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
const QUALITATIVE_FIELDS = [
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
    { field: 'wallMotion', aliases: ['cinetica parietala'] },
    { field: 'aorticValves', aliases: ['valve aortice'] },
    { field: 'mitralValves', aliases: ['valve mitrale'] },
    { field: 'tricuspidValves', aliases: ['valve tricuspide'] },
    { field: 'pulmonaryValves', aliases: ['valve pulmonare'] },
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
const LOW_CONFIDENCE_PATTERNS = [
    /\b(?:probabil|posibil|nesigur|banuiesc)\b/,
    /\bnu\s+sunt\s+sigur\b/,
    /\bnu\s+stiu\b/,
];
const MEDIUM_CONFIDENCE_PATTERNS = [
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
function isSpace(ch) {
    return /\s/.test(ch);
}
function normalizeChar(ch) {
    const lower = ch.toLocaleLowerCase('ro-RO');
    const decomposed = lower.normalize('NFD');
    let out = '';
    for (const part of decomposed) {
        if (/\p{M}/u.test(part))
            continue;
        out += part;
    }
    return out.replace(/[șş]/g, 's').replace(/[țţ]/g, 't');
}
// Single source of truth for the text rewrites applied before matching; used
// by normalizeWithIndex() and therefore by normalize() as well, so alias
// matching and value extraction always see the same normalized text.
//
// Dotted abbreviations like "V.S." / "V S" / "V, S" -> "vs" for chamber
// prefixes that Whisper often splits. They run on already-lowercased
// normalized text (a-z only). Commas/semicolons between letters are also
// normalized because Whisper often dictates "V, S," with commas.
const ABBREVIATION_REPLACEMENTS = [
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
const TYPO_REPLACEMENTS = [
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
];
function normalize(text) {
    return normalizeWithIndex(text).text;
}
// Collapses whitespace/hyphens and records the raw position of every
// normalized character so that spans can be mapped back to the transcript.
// Also protects decimal commas, including Whisper's "4, 5" with a space,
// while keeping rawIndex accurate (removed spaces don't get an entry).
function normalizeWithIndex(raw) {
    let text = '';
    const rawIndex = [];
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (isSpace(ch) || ch === '-') {
            if (text.length > 0 && text[text.length - 1] !== ' ') {
                text += ' ';
                rawIndex.push(i);
            }
            continue;
        }
        const normalized = normalizeChar(ch);
        text += normalized;
        for (let k = 0; k < normalized.length; k += 1)
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
    let outRawIndex = [];
    for (let i = 0; i < trimmed.length; i += 1) {
        const ch = trimmed[i];
        if (ch === ',' &&
            i > 0 &&
            i + 1 < trimmed.length &&
            /\d/.test(trimmed[i - 1]) &&
            /\d/.test(trimmed[i + 1])) {
            out += '.';
            outRawIndex.push(trimmedRawIndex[i]);
            continue;
        }
        if (ch === ' ' &&
            i > 1 &&
            trimmed[i - 1] === ',' &&
            /\d/.test(trimmed[i - 2]) &&
            i + 1 < trimmed.length &&
            /\d/.test(trimmed[i + 1])) {
            // Space inside decimal "4, 5" -> skip it (already converted comma to dot)
            continue;
        }
        out += ch;
        outRawIndex.push(trimmedRawIndex[i]);
    }
    // Normalize dotted abbreviations "V.S." / "V S" / "V, S" -> "vs" etc., keeping rawIndex
    // aligned by preserving only the letter positions (dots/spaces/commas are dropped).
    // This ensures "Masa V.S. 5" and "V, S, daimetru ..." match alias "masa vs" / "vs diametru".
    for (const { pattern, target } of ABBREVIATION_REPLACEMENTS) {
        // Reset regex state for each iteration after mutation
        let match;
        // Use while loop with manual index tracking because we mutate out
        pattern.lastIndex = 0;
        while ((match = pattern.exec(out)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            // Collect raw indices of letters a-z in the matched substring to map to target
            const letterIndices = [];
            for (let k = start; k < end; k += 1) {
                if (/[a-z]/.test(out[k]))
                    letterIndices.push(outRawIndex[k]);
            }
            // Fallback: if letter extraction failed, just use first N indices
            const mappedRaw = letterIndices.slice(0, target.length);
            while (mappedRaw.length < target.length)
                mappedRaw.push(outRawIndex[start]);
            const newOut = out.slice(0, start) + target + out.slice(end);
            const newRaw = [...outRawIndex.slice(0, start), ...mappedRaw, ...outRawIndex.slice(end)];
            out = newOut;
            outRawIndex = newRaw;
            pattern.lastIndex = start + target.length;
            // For patterns like "v s" that could overlap, restart from start
            // to avoid missing consecutive abbreviations after replacement.
            if (pattern.lastIndex > out.length)
                break;
        }
    }
    // Length-changing typo fixes drop the rawIndex entry of the removed letter;
    // same-length replacements keep all indices.
    for (const { pattern, target } of TYPO_REPLACEMENTS) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(out)) !== null) {
            const s = m.index;
            const e = s + m[0].length;
            let mapped;
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
            }
            else if (m[0] === 'vese' && target === 'vse') {
                // v e s e (4) -> v s e (3) : drop 'e' at offset 1
                mapped = [outRawIndex[s], outRawIndex[s + 2], outRawIndex[s + 3]];
            }
            else {
                // Same length: keep all indices
                mapped = outRawIndex.slice(s, e);
                // If target length differs unexpectedly, pad/truncate
                if (mapped.length !== target.length) {
                    mapped = mapped.slice(0, target.length);
                    while (mapped.length < target.length)
                        mapped.push(outRawIndex[s]);
                }
            }
            out = out.slice(0, s) + target + out.slice(e);
            outRawIndex = [...outRawIndex.slice(0, s), ...mapped, ...outRawIndex.slice(e)];
            pattern.lastIndex = s + target.length;
            if (pattern.lastIndex > out.length)
                break;
        }
    }
    return { text: out, rawIndex: outRawIndex };
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Field aliases are matched word by word, tolerating comma or semicolon
// separators between the words ("vs, diametrul telediastolic") exactly as
// Whisper dictates them. The trailing boundary allows a digit to follow the
// alias immediately so Whisper attachments like "E4", "EA1.2", "TDE9" still
// match the label and leave the number in the value window ("e"+"4", "ea"+"1.2").
// A following letter still ends the match, so "area" never matches bare "a".
function aliasPattern(alias) {
    const words = alias.split(' ').map((word) => escapeRegExp(word));
    return new RegExp(`(?<![a-z0-9])${words.join('[\\s,;]+')}(?![a-z])`, 'g');
}
// Qualitative aliases additionally allow a known value word to be attached
// with no space ("valve mitralesuple" → alias ends before "suple"). The known
// value is only looked ahead, never consumed, so it stays in the value window.
function qualitativeAliasPattern(alias) {
    const words = alias.split(' ').map((word) => escapeRegExp(word));
    const body = words.join('[\\s,;]+');
    const known = KNOWN_QUALITATIVE_VALUES.map((value) => escapeRegExp(value)).join('|');
    return new RegExp(`(?<![a-z0-9])${body}(?:(?![a-z])|(?=(?:${known})(?![a-z])))`, 'g');
}
// Compiled once: the transcript is re-parsed on every keystroke.
let aliasMatchers = null;
function getAliasMatchers() {
    if (aliasMatchers)
        return aliasMatchers;
    const matchers = [];
    for (const [context, aliases] of Object.entries(CONTEXT_ALIASES)) {
        for (const alias of aliases) {
            matchers.push({ kind: 'context', context, pattern: aliasPattern(alias) });
        }
    }
    for (const def of NUMERIC_FIELDS) {
        for (const alias of def.aliases) {
            matchers.push({ kind: 'field', def, pattern: aliasPattern(alias) });
        }
    }
    for (const def of QUALITATIVE_FIELDS) {
        for (const alias of def.aliases) {
            matchers.push({ kind: 'qualitative', def, pattern: qualitativeAliasPattern(alias) });
        }
    }
    aliasMatchers = matchers;
    return matchers;
}
function collectMatches(normalizedText) {
    const matches = [];
    for (const { pattern, ...matcher } of getAliasMatchers()) {
        // matchAll() iterates a copy of the regex, so the shared pattern's
        // lastIndex is never touched.
        for (const match of normalizedText.matchAll(pattern)) {
            const start = match.index ?? 0;
            matches.push({ ...matcher, start, end: start + match[0].length });
        }
    }
    matches.sort((a, b) => a.start - b.start || b.end - a.end);
    return matches;
}
function countNumericValues(text) {
    let count = 0;
    let rest = text;
    for (;;) {
        const found = findRomanianNumber(rest);
        if (!found)
            break;
        count += 1;
        rest = rest.slice(found.end);
    }
    return count;
}
// Returns the normalized index of the start of the Nth word before `from`.
function lookbackStart(text, from, wordCount) {
    let pos = from;
    let seen = 0;
    while (pos > 0 && seen < wordCount) {
        let i = pos - 1;
        while (i >= 0 && /\s/.test(text[i]))
            i -= 1;
        if (i < 0)
            break;
        while (i >= 0 && !/\s/.test(text[i]))
            i -= 1;
        pos = i + 1;
        seen += 1;
    }
    return pos;
}
function confidenceFor(text) {
    for (const pattern of LOW_CONFIDENCE_PATTERNS) {
        if (pattern.test(text))
            return 'low';
    }
    for (const pattern of MEDIUM_CONFIDENCE_PATTERNS) {
        if (pattern.test(text))
            return 'medium';
    }
    return 'high';
}
// Strips leading connective words ("este", "de", ...) from a qualitative value
// and returns the raw transcript text of the value. A leading field-separator
// comma after the alias ("lichid pericardic, absent") is not part of the value.
function qualitativeValue(rawWindow) {
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
    if (pos >= rawIndex.length)
        return null;
    const value = rawWindow
        .slice(rawIndex[pos])
        .replace(/^[\s,;]+/, '')
        .replace(/[\s,;]+$/g, '')
        .trim();
    return value || null;
}
function findNextPunctuation(raw, from, limit) {
    const match = PUNCTUATION_BOUNDARY.exec(raw.slice(from, limit));
    return match ? from + (match.index ?? 0) : null;
}
const CONCLUSIONS_MARKER = /\bconcluzi(?:i|e)\s*[:.,-]?\s*/i;
function extractConclusions(transcript) {
    const match = CONCLUSIONS_MARKER.exec(transcript);
    if (!match)
        return '';
    return transcript.slice(match.index + match[0].length).trim();
}
function beforeConclusions(transcript) {
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
function patientLabelRegex(source) {
    return new RegExp(`${NO_LETTER_BEFORE}${source}${NO_LETTER_AFTER}\\s*[:.,-]?\\s*(?:de\\s+)?`, 'i');
}
const COMBINED_NAME_LABEL = new RegExp(`${NO_LETTER_BEFORE}nume[\\s,]+(?:și|si)[\\s,]+prenume${NO_LETTER_AFTER}\\s*[:.,-]?\\s*`, 'i');
const LAST_NAME_LABEL = patientLabelRegex('nume(?:le)?(?:\\s+de\\s+familie)?(?:\\s+pacientului|\\s+pacientei|\\s+pacienta|\\s+pacientul)?');
const FIRST_NAME_LABEL = patientLabelRegex('prenume(?:le)?(?:\\s+pacientului|\\s+pacientei|\\s+pacienta|\\s+pacientul)?');
const AGE_LABEL = patientLabelRegex('v[âa]rst[aă]');
const WEIGHT_LABEL = patientLabelRegex('(?:g)?reutate[aă]?');
const HEIGHT_LABEL = patientLabelRegex('[îi]n[ăa]l[tțţ]ime[aă]?');
function captureNameWords(raw, from, maxWords) {
    const wordPattern = new RegExp(`[${ROMANIAN_LETTER_CLASS}]+(?:-[${ROMANIAN_LETTER_CLASS}]+)*`, 'g');
    wordPattern.lastIndex = from;
    const words = [];
    const limit = Math.min(raw.length, from + 80);
    while (words.length < maxWords) {
        const match = wordPattern.exec(raw);
        if (!match || match.index >= limit)
            break;
        if (PATIENT_NAME_STOP_WORDS.has(match[0].toLocaleLowerCase('ro-RO')))
            break;
        words.push(match[0]);
    }
    return words;
}
function capitalizeName(name) {
    return name.replace(new RegExp(`(^|[\\s-])([${ROMANIAN_LETTER_CLASS}])`, 'g'), (_match, sep, letter) => sep + letter.toLocaleUpperCase('ro-RO'));
}
/**
 * Extracts explicitly dictated patient data. Only the text before the
 * "Concluzii" marker is scanned: conclusions routinely mention the patient's
 * age ("pacient în vârstă de ...") and must not overwrite the form fields.
 */
function extractPatientInfo(transcript) {
    const patient = {
        lastName: '',
        firstName: '',
        age: '',
        weight: '',
        height: '',
    };
    const conclusionsMatch = CONCLUSIONS_MARKER.exec(transcript);
    const scope = conclusionsMatch ? transcript.slice(0, conclusionsMatch.index) : transcript;
    if (!scope.trim())
        return patient;
    // "Nume și prenume Popescu Ion" — first word is the family name.
    const combined = COMBINED_NAME_LABEL.exec(scope);
    if (combined) {
        const words = captureNameWords(scope, combined.index + combined[0].length, 3);
        if (words.length > 0)
            patient.lastName = capitalizeName(words[0]);
        if (words.length > 1)
            patient.firstName = capitalizeName(words.slice(1).join(' '));
    }
    if (!patient.lastName) {
        const match = LAST_NAME_LABEL.exec(scope);
        if (match) {
            const words = captureNameWords(scope, match.index + match[0].length, 2);
            if (words.length > 0)
                patient.lastName = capitalizeName(words.join(' '));
        }
    }
    if (!patient.firstName) {
        const match = FIRST_NAME_LABEL.exec(scope);
        if (match) {
            const words = captureNameWords(scope, match.index + match[0].length, 2);
            if (words.length > 0)
                patient.firstName = capitalizeName(words.join(' '));
        }
    }
    const assignNumber = (label, key) => {
        const match = label.exec(scope);
        if (!match)
            return;
        const start = match.index + match[0].length;
        const found = findRomanianNumber(scope.slice(start, start + 60));
        if (!found)
            return;
        // Height is stored in centimeters; "1,75" (meters) becomes "175".
        const meters = Number(found.value);
        patient[key] = key === 'height' && meters > 0 && meters < 3
            ? String(Math.round(meters * 100))
            : found.value;
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
export function parseEchoTranscript(transcript) {
    const measurements = [];
    const conclusions = extractConclusions(transcript);
    const patient = extractPatientInfo(transcript);
    const raw = beforeConclusions(transcript);
    const { text, rawIndex } = normalizeWithIndex(raw);
    if (text.length === 0) {
        return { measurements, conclusions, patient };
    }
    const matches = collectMatches(text);
    const toRaw = (index) => index >= text.length ? raw.length : rawIndex[index];
    let activeContext = null;
    // Aliases that start inside an already-consumed alias span are skipped:
    // they are sub-phrases of the longer alias that won at that position
    // (e.g. "diametrul anteroposterior" inside "as diametrul anteroposterior").
    let consumedUntil = -1;
    let i = 0;
    while (i < matches.length) {
        const start = matches[i].start;
        let j = i;
        while (j < matches.length && matches[j].start === start)
            j += 1;
        const group = matches.slice(i, j);
        i = j;
        const end = group[0].end;
        if (start < consumedUntil)
            continue;
        consumedUntil = end;
        // The value window ends at the first match starting at or after this
        // alias ends — a nested sub-phrase alias must never cut the window.
        let k = i;
        while (k < matches.length && matches[k].start < end)
            k += 1;
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
            if (m.kind === 'context' || m.def === undefined)
                return false;
            if ('context' in m.def) {
                if (m.def.context !== undefined && m.def.context !== activeContext)
                    return false;
            }
            const excluded = 'excludeContexts' in m.def ? m.def.excludeContexts : undefined;
            if (excluded !== undefined && activeContext !== null && excluded.includes(activeContext)) {
                return false;
            }
            return true;
        });
        if (!defMatch || !defMatch.def)
            continue;
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
            const bareLabelValue = def.field === 'pericardialFluid' ? 'lichid pericardic' : null;
            const resolvedValue = value ?? (rawWindow.trim() ? null : bareLabelValue);
            if (!resolvedValue)
                continue;
            // Drop a trailing field separator before the next known field
            // ("Valve mitralesuple, valve tricuspide..." → source ends at "suple").
            const qualitativeSource = sourceText.replace(/[\s,;]+$/g, '');
            measurements.push({
                field: def.field,
                label: MEASUREMENT_FIELDS[def.field].reviewLabel,
                value: resolvedValue,
                kind: 'qualitative',
                confidence,
                sourceText: qualitativeSource || sourceText,
            });
            continue;
        }
        const numericDef = def;
        if (numericDef.context && numericDef.context !== activeContext)
            continue;
        if (numericDef.excludeContexts &&
            activeContext !== null &&
            numericDef.excludeContexts.includes(activeContext)) {
            continue;
        }
        const valueCount = countNumericValues(normWindow);
        if (valueCount === 0)
            continue;
        const ambiguous = valueCount > 1;
        const number = findRomanianNumber(normWindow);
        if (!number)
            continue;
        if (numericDef.field === 'lvEjectionFractionTeicholz' && normWindow.includes('simpson'))
            continue;
        const spokenUnit = findUnit(normWindow.slice(number.end))?.unit;
        const expectedUnit = MEASUREMENT_UNITS[numericDef.field];
        let value = number.value;
        let unit = spokenUnit;
        let convertedFrom;
        let unitMismatch;
        if (spokenUnit && expectedUnit && spokenUnit !== expectedUnit) {
            const converted = convertUnit(number.value, spokenUnit, expectedUnit);
            if (converted !== null) {
                value = converted;
                unit = expectedUnit;
                convertedFrom = spokenUnit;
            }
            else {
                unitMismatch = true;
            }
        }
        measurements.push({
            field: numericDef.field,
            label: MEASUREMENT_FIELDS[numericDef.field].reviewLabel,
            value,
            unit,
            kind: 'numeric',
            confidence: ambiguous ? 'low' : confidence,
            sourceText,
            ...(ambiguous ? { ambiguousValue: true } : {}),
            ...(convertedFrom ? { convertedFrom } : {}),
            ...(unitMismatch ? { unitMismatch } : {}),
        });
    }
    return { measurements, conclusions, patient };
}
