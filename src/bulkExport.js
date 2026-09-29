import { config } from './config.js'

const POLL_INTERVAL_MS = 10_000
const MAX_POLL_MS = 10 * 60 * 1000 // give up after 10 minutes

/**
 * Kicks off a Group-level bulk export for both Observation (lab results)
 * and Patient resources, then polls until Epic signals completion, then
 * downloads and parses every NDJSON output file.
 *
 * Patient is included so we can resolve each Observation's subject
 * reference to an actual name — bulk export payloads are often "lean"
 * and don't include a display name on the reference itself.
 *
 * Returns { observations, patients } where patients is a Map of
 * "Patient/<id>" -> formatted display name.
 */
export async function fetchAllLabData(accessToken) {
  const typeFilter = encodeURIComponent('Observation?category=laboratory')
  const kickoffUrl = `${config.fhirBaseUrl}/Group/${config.groupId}/$export?_type=Observation,Patient&_typeFilter=${typeFilter}`

  console.log('[bulkExport] Kicking off export:', kickoffUrl)
  const kickoffRes = await fetch(kickoffUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
      Prefer: 'respond-async'
    }
  })

  if (kickoffRes.status !== 202) {
    const text = await kickoffRes.text()
    throw new Error(`Bulk export kickoff failed (${kickoffRes.status}): ${text}`)
  }

  const statusUrl = kickoffRes.headers.get('content-location')
  if (!statusUrl) throw new Error('No Content-Location header returned from kickoff')
  console.log('[bulkExport] Polling status at:', statusUrl)

  const manifest = await pollUntilComplete(statusUrl, accessToken)

  const observations = []
  const patients = new Map()

  for (const file of manifest.output ?? []) {
    if (file.type !== 'Observation' && file.type !== 'Patient') continue
    console.log('[bulkExport] Downloading', file.url)
    const fileRes = await fetch(file.url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+ndjson'
      }
    })
    const text = await fileRes.text()
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const resource = JSON.parse(trimmed)

      if (file.type === 'Observation') {
        observations.push(resource)
      } else if (file.type === 'Patient') {
        patients.set(`Patient/${resource.id}`, formatPatientName(resource))
      }
    }
  }

  console.log(`[bulkExport] Collected ${observations.length} Observations, ${patients.size} Patients`)
  return { observations, patients }
}

function formatPatientName(patient) {
  const names = patient.name ?? []
  const name = names.find((n) => n.use === 'official') || names[0]
  if (!name) return patient.id

  const given = (name.given ?? []).join(' ')
  const family = name.family ?? ''
  const full = `${given} ${family}`.trim()
  return full || name.text || patient.id
}

async function pollUntilComplete(statusUrl, accessToken) {
  const start = Date.now()
  while (Date.now() - start < MAX_POLL_MS) {
    const res = await fetch(statusUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    })

    if (res.status === 200) {
      return res.json()
    }
    if (res.status === 202) {
      const progress = res.headers.get('x-progress')
      console.log(`[bulkExport] Still processing... ${progress ?? ''}`)
      await sleep(POLL_INTERVAL_MS)
      continue
    }
    const text = await res.text()
    throw new Error(`Bulk export failed while polling (${res.status}): ${text}`)
  }
  throw new Error('Bulk export timed out waiting for completion')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
