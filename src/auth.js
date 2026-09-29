import jose from 'node-jose'
import fs from 'fs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from './config.js'

let cachedKey = null

async function loadPrivateKey() {
  if (cachedKey) return cachedKey
  const ks = fs.readFileSync(config.keysFile)
  const keyStore = await jose.JWK.asKeyStore(ks.toString())
  const [key] = keyStore.all({ use: 'sig' })
  cachedKey = { pem: key.toPEM(true), kid: key.kid }
  return cachedKey
}

function buildAssertion(key) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: config.clientId,
    sub: config.clientId,
    aud: config.tokenUrl,
    jti: crypto.randomUUID(),
    exp: now + 240
  }
  return jwt.sign(payload, key.pem, {
    algorithm: 'RS384',
    header: { kid: key.kid, typ: 'JWT' }
  })
}

export async function getAccessToken() {
  const key = await loadPrivateKey()
  const assertion = buildAssertion(key)

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion
  })

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`Token request failed (${res.status}): ${JSON.stringify(data)}`)
  }
  console.log(`[auth] Got access token, expires in ${data.expires_in}s`)
  return data.access_token
}
