// Fills the Issue/Receive letter template with the real transaction details
// and returns a ready-to-download .docx Buffer.
//
// The template (templates/issue-letter-template.docx or
// receive-letter-template.docx, or whatever custom one has been uploaded)
// uses docxtemplater tags in place of the old "(Goes Here)" placeholders:
//   {branchName}  {dateFormatted}  {receiverName}  {pfNumber}
//   {#items}{name} — {qty}{/items}   (one line per item, automatically)
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

function renderLetter(templatePath, data) {
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.render(data);
  return doc.getZip().generate({ type: 'nodebuffer' });
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

module.exports = { renderLetter, formatDate };
