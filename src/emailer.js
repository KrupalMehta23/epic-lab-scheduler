import nodemailer from 'nodemailer'
import { config } from './config.js'

function renderHtml(byPatient) {
  const sections = [...byPatient.entries()]
    .map(([patientRef, labs]) => {
      const rows = labs
        .map(
          (l) => `
        <tr style="background:${l.status === 'abnormal' ? '#fdecea' : '#eafaf1'}">
          <td style="padding:6px 10px;border:1px solid #ddd;">${l.testName}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${l.value}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-transform:capitalize;font-weight:bold;color:${
            l.status === 'abnormal' ? '#b00020' : '#137333'
          }">${l.status}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;${l.referenceRange ? '' : 'color:#999;font-style:italic;'}">${l.referenceRange || 'Not provided'}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${l.effectiveDate}</td>
        </tr>`
        )
        .join('')

      return `
      <h3 style="margin-top:24px;">Patient: ${patientRef}</h3>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
        <thead>
          <tr style="background:#333;color:#fff;">
            <th style="padding:6px 10px;text-align:left;">Test</th>
            <th style="padding:6px 10px;text-align:left;">Result</th>
            <th style="padding:6px 10px;text-align:left;">Status</th>
            <th style="padding:6px 10px;text-align:left;">Reference Range</th>
            <th style="padding:6px 10px;text-align:left;">Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
    })
    .join('')

  const totalLabs = [...byPatient.values()].reduce((sum, arr) => sum + arr.length, 0)

  return `
    <div style="font-family:sans-serif;">
      <h2>Daily Lab Report — Epic Sandbox</h2>
      <p>Generated ${new Date().toISOString()}. ${byPatient.size} patient(s), ${totalLabs} lab result(s).</p>
      ${sections || '<p>No lab results found in this run.</p>'}
    </div>`
}

export async function sendLabReportEmail(byPatient) {
  // Ethereal gives you a disposable test SMTP inbox on the fly — no signup needed.
  const testAccount = await nodemailer.createTestAccount()

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  })

  const info = await transporter.sendMail({
    from: config.reportFrom,
    to: config.reportTo,
    subject: `Daily Lab Report — ${new Date().toDateString()}`,
    html: renderHtml(byPatient)
  })

  console.log('[emailer] Message sent:', info.messageId)
  console.log('[emailer] Preview URL:', nodemailer.getTestMessageUrl(info))
}
