import { DERIVED_MEASUREMENT_KEYS, MEASUREMENT_FIELDS } from '../config/measurementFields.js';
import { calculateBmi } from '../utils/bmi.js';
import { calculateDerivedMeasurements } from '../utils/derivedMeasurements.js';
// Pure report-state logic shared by App.tsx; kept free of React and browser
// APIs so it can be unit tested with node:test.
// Derived ratio -> [explanation shown as source text, source fields]; labels
// come from the field registry.
const DERIVED_DEFINITIONS = [
    ['mitralEaRatio', 'Calculat automat: Undă E / Undă A', ['mitralE', 'mitralA']],
    ['tricuspidEaRatio', 'Calculat automat: Undă E / Undă A', ['tricuspidE', 'tricuspidA']],
    ['septalEaPrimeRatio', "Calculat automat: Undă E' / Undă A'", ['septalEPrime', 'septalAPrime']],
    ['eePrimeRatio', "Calculat automat: Undă E mitrală / Undă E'", ['mitralE', 'septalEPrime']],
];
/** Returns the number that follows a valid positive integer, or null. */
export function getFollowingCurrentNumber(value) {
    const currentNumber = Number(value.trim());
    return Number.isInteger(currentNumber) && currentNumber > 0 ? currentNumber + 1 : null;
}
/**
 * Fields dictated more than once with different values ("VS ... 4,4" and a
 * misheard "VS ... 3,5"). Their rows must never be applied silently: the
 * doctor has to pick one.
 */
export function conflictingDuplicateFields(items) {
    const valuesByField = new Map();
    for (const item of items) {
        const values = valuesByField.get(item.field) ?? new Set();
        values.add(item.value);
        valuesByField.set(item.field, values);
    }
    const conflicting = new Set();
    for (const [field, values] of valuesByField) {
        if (values.size > 1)
            conflicting.add(field);
    }
    return conflicting;
}
// A field repeated with the same value is one finding; only the first row is kept.
function withoutRepeatedValues(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = `${item.field}|${item.value}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function addCalculatedMeasurements(dictated, existing) {
    const parsedMeasurements = withoutRepeatedValues(dictated);
    const duplicates = conflictingDuplicateFields(parsedMeasurements);
    const values = { ...existing };
    const parsedFields = new Set(parsedMeasurements.map((item) => item.field));
    for (const item of parsedMeasurements) {
        values[item.field] = item.value;
    }
    const calculated = calculateDerivedMeasurements(values);
    const detected = parsedMeasurements.filter((item) => !DERIVED_MEASUREMENT_KEYS.includes(item.field));
    for (const [field, sourceText, sourceFields] of DERIVED_DEFINITIONS) {
        // A ratio built from a field with conflicting dictated values would show
        // an arbitrary result; it is recalculated once the doctor picks a value.
        if (sourceFields.some((sourceField) => duplicates.has(sourceField)))
            continue;
        if (sourceFields.some((sourceField) => parsedFields.has(sourceField)) && calculated[field] !== '') {
            detected.push({
                field,
                label: MEASUREMENT_FIELDS[field].reviewLabel,
                value: calculated[field],
                kind: 'numeric',
                confidence: 'high',
                sourceText,
            });
        }
    }
    return detected;
}
/** Builds the review list (measurements, derived ratios, conclusions) for a parse. */
export function buildDetectedItems(data, existing) {
    const detected = addCalculatedMeasurements(data.measurements, existing);
    if (data.conclusions) {
        detected.push({
            field: 'conclusions',
            label: 'Concluzii',
            value: data.conclusions,
            kind: 'qualitative',
            confidence: 'high',
            sourceText: data.conclusions,
        });
    }
    return detected;
}
/** Merges the doctor-approved review items into the report. */
export function applyDetectedItems(report, selected) {
    const measurements = { ...report.measurements };
    let conclusions = report.conclusions;
    for (const item of selected) {
        if (item.field === 'conclusions') {
            conclusions = item.value;
        }
        else {
            measurements[item.field] = item.value;
        }
    }
    return { ...report, measurements: calculateDerivedMeasurements(measurements), conclusions };
}
const PATIENT_KEYS = ['lastName', 'firstName', 'age', 'weight', 'height'];
/**
 * Returns only the dictated patient fields that changed since the previous
 * parse (other fields empty), so editing one part of the transcript never
 * re-applies values the doctor has since corrected in the form.
 */
export function changedPatientFields(previous, next) {
    const changed = { lastName: '', firstName: '', age: '', weight: '', height: '' };
    let any = false;
    for (const key of PATIENT_KEYS) {
        if (next[key] && next[key] !== previous?.[key]) {
            changed[key] = next[key];
            any = true;
        }
    }
    return any ? changed : null;
}
/** Fills the non-empty dictated fields into the patient form and refreshes the BMI. */
export function mergeParsedPatient(current, parsed) {
    const weight = parsed.weight || current.weight;
    const height = parsed.height || current.height;
    return {
        ...current,
        lastName: parsed.lastName || current.lastName,
        firstName: parsed.firstName || current.firstName,
        age: parsed.age || current.age,
        weight,
        height,
        bmi: calculateBmi(weight, height) || current.bmi,
    };
}
