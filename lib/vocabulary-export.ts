import { strToU8, zipSync } from 'fflate';
import type { VocabularyEntry } from './types';

const heading = ['Inglês', 'Significado', 'Contexto', 'Livro', 'Capítulo'];
const line = (value: string) => value.replace(/[\t\r\n]+/g, ' ').trim();
const csv = (value: string) => {
  const safe = /^[\s\u0000-\u001f]*[=+@-]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
};
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function workbook(rows: string[][]) {
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const relationship = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const data = rows.map((row, index) => {
    const cells = row.map((value, column) => `<c r="${'ABCDE'[column]}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('');
    return `<row r="${index + 1}">${cells}</row>`;
  }).join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8(`<Relationships xmlns="${relationship}"><Relationship Id="rId1" Type="${office}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<workbook xmlns="${main}" xmlns:r="${office}"><sheets><sheet name="Vocabulário" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships xmlns="${relationship}"><Relationship Id="rId1" Type="${office}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet xmlns="${main}"><cols><col min="1" max="2" width="38" customWidth="1"/><col min="3" max="3" width="72" customWidth="1"/><col min="4" max="5" width="32" customWidth="1"/></cols><sheetData>${data}</sheetData></worksheet>`),
  });
}

export function exportVocabulary(entries: VocabularyEntry[], format: string) {
  const rows = entries.map(({ text, meaning, context, bookTitle, chapterTitle }) => [text, meaning, context, bookTitle, chapterTitle]);
  const cards = entries.map(({ text, meaning, context }) => [line(text), line(meaning || context || 'A revisar')]);
  switch (format) {
    case 'csv': return { extension: 'csv', mime: 'text/csv', body: '\ufeff' + [heading, ...rows].map((row) => row.map(csv).join(',')).join('\r\n') };
    case 'noji': return { extension: 'csv', mime: 'text/csv', body: cards.map((row) => row.map(csv).join(',')).join('\r\n') };
    case 'anki': return { extension: 'txt', mime: 'text/plain', body: '#separator:Tab\n#html:false\n' + cards.map((row) => row.map((value) => '"' + value.replaceAll('"', '""') + '"').join('\t')).join('\n') };
    case 'flashcards': return { extension: 'txt', mime: 'text/plain', body: cards.map((row) => row.join('\t')).join('\n') };
    case 'txt': return { extension: 'txt', mime: 'text/plain', body: rows.map((row) => row.map((value, index) => value ? `${heading[index]}: ${value}` : '').filter(Boolean).join('\n')).join('\n\n') };
    case 'xlsx': return { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: Uint8Array.from(workbook([heading, ...rows])) };
    default: return null;
  }
}
