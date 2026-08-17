import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEchoTranscript } from '../src/services/medicalParser.js';
import { parseRomanianNumber } from '../src/services/romanianNumberParser.js';
function parsed(transcript, field) {
    const found = parseEchoTranscript(transcript).measurements.find((measurement) => measurement.field === field);
    assert.ok(found, `Expected ${field} to be extracted.`);
    return found;
}
test('parses VS telediastolic diameter with a spoken decimal and unit', () => {
    const result = parsed('VS diametrul telediastolic patru virgulă opt centimetri', 'lvEndDiastolicDiameter');
    assert.deepEqual({ value: result.value, unit: result.unit, confidence: result.confidence }, { value: '4.8', unit: 'cm', confidence: 'high' });
});
test('parses VS telesistolic diameter with a spoken decimal', () => {
    const result = parsed('VS diametrul telesistolic trei virgulă doi centimetri', 'lvEndSystolicDiameter');
    assert.equal(result.value, '3.2');
    assert.equal(result.unit, 'cm');
});
test('parses TAPSE in millimetres', () => {
    const result = parsed('TAPSE douăzeci și unu de milimetri', 'tapse');
    assert.equal(result.value, '21');
    assert.equal(result.unit, 'mm');
    assert.equal(result.sourceText, 'TAPSE douăzeci și unu de milimetri');
});
test('parses generic LV ejection fraction as Teicholz without interpreting it', () => {
    const result = parsed('fracția de ejecție șaizeci și doi la sută', 'lvEjectionFractionTeicholz');
    assert.equal(result.value, '62');
    assert.equal(result.unit, '%');
});
test('uses aortic flow context for Vmax', () => {
    const result = parsed('flux aortic Vmax o sută cincizeci centimetri pe secundă', 'aorticVmax');
    assert.equal(result.value, '150');
    assert.equal(result.unit, 'cm/s');
});
test('keeps mitral flow context across comma-separated clauses', () => {
    const data = parseEchoTranscript('flux mitral unda E șaptezeci, unda A cincizeci, E/A unu virgulă patru');
    assert.equal(data.measurements.find((item) => item.field === 'mitralE')?.value, '70');
    assert.equal(data.measurements.find((item) => item.field === 'mitralA')?.value, '50');
    assert.equal(data.measurements.find((item) => item.field === 'mitralEaRatio')?.value, '1.4');
});
test('keeps qualitative mitral regurgitation exactly as dictated', () => {
    const result = parsed('regurgitare mitrală ușoară', 'mitralRegurgitation');
    assert.equal(result.value, 'ușoară');
    assert.equal(result.kind, 'qualitative');
});
test('does not extract a measurement without a value', () => {
    assert.equal(parseEchoTranscript('TAPSE').measurements.length, 0);
});
test('does not guess a Vmax field without a flow context', () => {
    assert.equal(parseEchoTranscript('Vmax o sută cincizeci').measurements.length, 0);
});
test('marks approximate spoken values as medium parsing certainty', () => {
    const result = parsed('TAPSE aproximativ douăzeci și unu de milimetri', 'tapse');
    assert.equal(result.confidence, 'medium');
});
test('marks explicitly uncertain spoken values as low parsing certainty', () => {
    const result = parsed('probabil TAPSE douăzeci de milimetri', 'tapse');
    assert.equal(result.confidence, 'low');
});
test('parses digit variants and spoken Romanian numbers', () => {
    assert.equal(parseRomanianNumber('4,8'), '4.8');
    assert.equal(parseRomanianNumber('21'), '21');
    assert.equal(parseRomanianNumber('o sută douăzeci'), '120');
    assert.equal(parseRomanianNumber('zero virgulă nouă'), '0.9');
});
test('extracts several independent measurements without filling absent fields', () => {
    const data = parseEchoTranscript('TAPSE douăzeci și unu milimetri. VS diametrul telediastolic 4.8 cm. Flux tricuspidian Vmax două sute centimetri pe secundă. Regurgitare tricuspidiană moderată.');
    assert.deepEqual(data.measurements.map((item) => item.field), [
        'tapse', 'lvEndDiastolicDiameter', 'tricuspidVmax', 'tricuspidRegurgitation',
    ]);
    assert.equal(data.measurements.find((item) => item.field === 'tricuspidRegurgitation')?.value, 'moderată');
});
