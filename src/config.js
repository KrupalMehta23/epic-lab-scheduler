import 'dotenv/config'

function required(name, fallback) {
  const val = process.env[name] ?? fallback
  if (!val) throw new Error(`Missing required env var: ${name}`)
  return val
}

export const config = {
  clientId: required('CLIENT_ID'),
  tokenUrl: required('TOKEN_URL', 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token'),
  fhirBaseUrl: required('FHIR_BASE_URL', 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4'),
  groupId: required('GROUP_ID'),
  keysFile: required('KEYS_FILE', './keys.json'),
  cronSchedule: process.env.CRON_SCHEDULE || '0 0 * * *',
  reportTo: process.env.REPORT_TO || 'lab-reports@example.com',
  reportFrom: process.env.REPORT_FROM || '"Epic Lab Bot" <lab-bot@example.com>'
}
