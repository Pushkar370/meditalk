import { jsPDF } from 'jspdf';

/**
 * Generates a branded clinical prescription PDF and triggers browser download.
 * @param {object} rx - Prescription object (medications, additionalInstructions, date, id, status)
 * @param {object} doctor - { name, id, specialty }
 * @param {object} patient - { name, id, age, gender }
 */
export function generatePrescriptionPdf(rx, doctor, patient) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210; // A4 width mm
  const margin = 15;
  const contentW = W - margin * 2;
  let y = 0;

  // ── Header band ────────────────────────────────────────────────────────
  doc.setFillColor(30, 107, 82); // #1e6b52 — primary teal
  doc.rect(0, 0, W, 36, 'F');

  // Clinic name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MediTalk Health System', margin, 14);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Connecting Patients with Trusted Doctors', margin, 20);

  // Address line
  doc.setFontSize(7);
  doc.text('123 Medical Plaza, Health Street · contact@meditalk.health · +91 98765 43210', margin, 26);

  // Rx symbol (top-right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255, 0.4);
  doc.text('℞', W - margin - 8, 28, { align: 'right' });

  y = 42;

  // ── Doctor & Patient Info Block ────────────────────────────────────────
  doc.setTextColor(30, 30, 30);

  // Left: Doctor info
  doc.setFillColor(245, 249, 247);
  doc.roundedRect(margin, y, contentW / 2 - 4, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 107, 82);
  doc.text('PRESCRIBING DOCTOR', margin + 5, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(doctor?.name || 'Dr. Unknown', margin + 5, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Specialty: ${doctor?.specialty || 'General Practice'}`, margin + 5, y + 20);
  doc.text(`ID: ${doctor?.id || '—'}`, margin + 5, y + 26);

  // Right: Patient info
  const col2X = margin + contentW / 2 + 4;
  const col2W = contentW / 2 - 4;
  doc.setFillColor(245, 249, 247);
  doc.roundedRect(col2X, y, col2W, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 107, 82);
  doc.text('PATIENT', col2X + 5, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(patient?.name || 'Unknown Patient', col2X + 5, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const ageGender = [patient?.age && `Age: ${patient.age}`, patient?.gender && patient.gender].filter(Boolean).join(' · ');
  if (ageGender) doc.text(ageGender, col2X + 5, y + 20);
  doc.text(`ID: ${patient?.id || '—'}`, col2X + 5, y + 26);

  y += 38;

  // Date & Prescription ID
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const issueDate = rx.date ? new Date(rx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(`Date of Issue: ${issueDate}`, margin, y);
  doc.text(`Prescription ID: ${rx.id || 'DRAFT'}`, W - margin, y, { align: 'right' });

  y += 6;

  // Divider
  doc.setDrawColor(30, 107, 82);
  doc.setLineWidth(0.5);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // ── Medications Table ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 107, 82);
  doc.text('PRESCRIBED MEDICATIONS', margin, y);
  y += 6;

  // Table header
  const cols = { num: 8, med: 60, dosage: 22, freq: 22, dur: 22, instr: contentW - 134 };
  const colXs = {
    num: margin,
    med: margin + cols.num,
    dosage: margin + cols.num + cols.med,
    freq: margin + cols.num + cols.med + cols.dosage,
    dur: margin + cols.num + cols.med + cols.dosage + cols.freq,
    instr: margin + cols.num + cols.med + cols.dosage + cols.freq + cols.dur,
  };

  doc.setFillColor(30, 107, 82);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', colXs.num + 1, y + 5);
  doc.text('Medicine', colXs.med + 1, y + 5);
  doc.text('Dosage', colXs.dosage + 1, y + 5);
  doc.text('Frequency', colXs.freq + 1, y + 5);
  doc.text('Duration', colXs.dur + 1, y + 5);
  doc.text('Instructions', colXs.instr + 1, y + 5);
  y += 7;

  const meds = rx.medications || [];
  meds.forEach((m, i) => {
    const rowH = 9;
    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(246, 250, 248);
      doc.rect(margin, y, contentW, rowH, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text(`${i + 1}.`, colXs.num + 1, y + 6);
    doc.text(m.medicine || '—', colXs.med + 1, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(m.dosage || '—', colXs.dosage + 1, y + 6);
    doc.text(m.frequency || '—', colXs.freq + 1, y + 6);
    doc.text(m.duration || '—', colXs.dur + 1, y + 6);

    // Wrap instructions
    const instrText = m.instructions || '';
    doc.setFontSize(7);
    doc.text(instrText, colXs.instr + 1, y + 6, { maxWidth: cols.instr - 2 });
    y += rowH;
  });

  // Table border
  doc.setDrawColor(200, 220, 210);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - meds.length * 9 - 7, contentW, meds.length * 9 + 7, 'S');

  y += 10;

  // ── Additional Instructions ────────────────────────────────────────────
  if (rx.additionalInstructions) {
    doc.setFillColor(255, 248, 220); // soft yellow
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F');
    doc.setDrawColor(200, 170, 80);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 18, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 70, 0);
    doc.text('SPECIAL INSTRUCTIONS / NOTES', margin + 5, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 40, 0);
    doc.text(rx.additionalInstructions, margin + 5, y + 13, { maxWidth: contentW - 10 });
    y += 24;
  }

  y += 8;

  // ── Signature block ────────────────────────────────────────────────────
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.4);
  doc.line(W - margin - 60, y, W - margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Doctor\'s Signature', W - margin - 30, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 20);
  doc.text(doctor?.name || 'Doctor', W - margin - 30, y + 11, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(doctor?.specialty || '', W - margin - 30, y + 16, { align: 'center' });

  // ── Footer ──────────────────────────────────────────────────────────────
  const footerY = 287;
  doc.setFillColor(30, 107, 82);
  doc.rect(0, footerY, W, 10, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('This is an electronically generated prescription from MediTalk Health System.', W / 2, footerY + 4, { align: 'center' });
  doc.text('Confidential — For authorized recipients only. Valid for 30 days from date of issue.', W / 2, footerY + 8, { align: 'center' });

  // ── Save ────────────────────────────────────────────────────────────────
  const filename = `Prescription-${rx.id || 'DRAFT'}-${patient?.name?.replace(/\s+/g, '_') || 'Patient'}.pdf`;
  doc.save(filename);
}
