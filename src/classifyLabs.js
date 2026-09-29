const ABNORMAL_CODES = new Set(['H', 'HH', 'L', 'LL', 'A', 'AA', 'HU', 'LU'])

/**
 * Determines normal vs abnormal using, in order of preference:
 * 1. The explicit interpretation coding Epic returns (H/L/A/N etc.)
 * 2. A fallback comparison of valueQuantity against referenceRange, if present
 * If neither is available, the result can't be confirmed as normal, so it's
 * treated as "abnormal" — a conservative default so nothing questionable
 * gets silently passed through unflagged.
 */
function classify(obs) {
  const interp = obs.interpretation?.[0]?.coding?.[0]?.code
  if (interp) {
    return ABNORMAL_CODES.has(interp.toUpperCase()) ? 'abnormal' : 'normal'
  }

  const value = obs.valueQuantity?.value
  const range = obs.referenceRange?.[0]
  if (typeof value === 'number' && range) {
    const low = range.low?.value
    const high = range.high?.value
    if (typeof low === 'number' && value < low) return 'abnormal'
    if (typeof high === 'number' && value > high) return 'abnormal'
    if (typeof low === 'number' || typeof high === 'number') return 'normal'
  }

  return 'abnormal'
}

function formatValue(obs) {
  if (obs.valueQuantity) {
    return `${obs.valueQuantity.value ?? ''} ${obs.valueQuantity.unit ?? ''}`.trim()
  }
  if (obs.valueString) return obs.valueString
  if (obs.valueCodeableConcept?.text) return obs.valueCodeableConcept.text
  if (obs.component?.length) {
    return obs.component
      .map((c) => {
        const name = c.code?.text || c.code?.coding?.[0]?.display || 'component'
        const val = c.valueQuantity ? `${c.valueQuantity.value} ${c.valueQuantity.unit ?? ''}` : ''
        return `${name}: ${val}`.trim()
      })
      .join(', ')
  }
  return 'N/A'
}

export function buildLabReport(observations, patients = new Map()) {
  const byPatient = new Map()

  for (const obs of observations) {
    const ref = obs.subject?.reference
    // Prefer the real name from the exported Patient resource; fall back to
    // a display name on the reference itself, then the raw "Patient/id".
    const patientLabel = (ref && patients.get(ref)) || obs.subject?.display || ref || 'Unknown patient'
    const testName = obs.code?.text || obs.code?.coding?.[0]?.display || 'Unnamed test'
    const status = classify(obs)
    const range = obs.referenceRange?.[0]
    let rangeText = ''
    if (range?.low || range?.high) {
      rangeText = `${range.low?.value ?? '?'}–${range.high?.value ?? '?'} ${range.low?.unit ?? range.high?.unit ?? ''}`.trim()
    } else if (range?.text) {
      rangeText = range.text
    }

    const entry = {
      testName,
      value: formatValue(obs),
      status,
      referenceRange: rangeText,
      effectiveDate: obs.effectiveDateTime || obs.effectivePeriod?.start || 'Unknown date'
    }

    if (!byPatient.has(patientLabel)) byPatient.set(patientLabel, [])
    byPatient.get(patientLabel).push(entry)
  }

  return byPatient
}
