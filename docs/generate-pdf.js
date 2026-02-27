#!/usr/bin/env node
/**
 * Generira PDF iz HTML uporabniškega priročnika.
 * Zahteva: npx puppeteer (ali npm install puppeteer)
 * Uporaba: node docs/generate-pdf.js
 * 
 * Ali z npx: npx puppeteer --no-sandbox docs/uporabniski-prirocnik-admin.html --format=pdf --path=docs/uporabniski-prirocnik-admin.pdf
 * Opomba: zgornji ukaz uporabi puppeteer CLI, ki morda ni na voljo. Namesto tega uporabite brskalnik:
 * Odprite docs/uporabniski-prirocnik-admin.html in Ctrl+P > Shrani kot PDF.
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'uporabniski-prirocnik-admin.html');
const pdfPath = path.join(__dirname, 'uporabniski-prirocnik-admin.pdf');

async function generatePdf() {
  try {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
    await browser.close();
    console.log('PDF ustvarjen:', pdfPath);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('Puppeteer ni nameščen. Namesto skripte:');
      console.log('1. Odprite docs/uporabniski-prirocnik-admin.html v brskalniku');
      console.log('2. Pritisnite Ctrl+P (ali Cmd+P na Macu)');
      console.log('3. Izberite "Shrani kot PDF"');
      console.log('');
      console.log('Za namestitev Puppeteer: npm install puppeteer');
      process.exit(1);
    }
    throw err;
  }
}

generatePdf().catch(err => {
  console.error('Napaka:', err.message);
  process.exit(1);
});
