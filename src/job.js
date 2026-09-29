import { getAccessToken } from './auth.js'
import { fetchAllLabData } from './bulkExport.js'
import { buildLabReport } from './classifyLabs.js'
import { sendLabReportEmail } from './emailer.js'

export async function runLabReportJob() {
  console.log(`\n=== Lab report job started at ${new Date().toISOString()} ===`)
  try {
    const token = await getAccessToken()
    const { observations, patients } = await fetchAllLabData(token)
    const byPatient = buildLabReport(observations, patients)
    await sendLabReportEmail(byPatient)
    console.log('=== Lab report job completed successfully ===\n')
  } catch (err) {
    console.error('=== Lab report job FAILED ===')
    console.error(err)
  }
}
