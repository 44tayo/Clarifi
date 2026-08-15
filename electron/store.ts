import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const KEYTAR_SERVICE = 'clarifi'

async function loadKeytar(): Promise<{
  setPassword: (service: string, account: string, password: string) => Promise<void>
  getPassword: (service: string, account: string) => Promise<string | null>
  deletePassword: (service: string, account: string) => Promise<boolean>
} | null> {
  try {
    const keytarModule = await import('keytar')
    const keytar = keytarModule.default ?? keytarModule
    return keytar as {
      setPassword: (service: string, account: string, password: string) => Promise<void>
      getPassword: (service: string, account: string) => Promise<string | null>
      deletePassword: (service: string, account: string) => Promise<boolean>
    }
  } catch {
    return null
  }
}

function encryptedFilePath(service: string): string {
  return path.join(app.getPath('userData'), `${service}.enc`)
}

function writeEncryptedFile(service: string, key: string): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false
    const encrypted = safeStorage.encryptString(key)
    fs.writeFileSync(encryptedFilePath(service), encrypted)
    return true
  } catch {
    return false
  }
}

function readEncryptedFile(service: string): string | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const filePath = encryptedFilePath(service)
    if (!fs.existsSync(filePath)) return null
    const encrypted = fs.readFileSync(filePath)
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

/**
 * Persist a secret to the macOS keychain (when available) and also to an
 * encrypted file under userData. Dual-write keeps pairing alive across
 * keytar/safeStorage availability changes between app launches.
 */
export async function saveKey(service: string, key: string): Promise<void> {
  let stored = false

  try {
    const keytar = await loadKeytar()
    if (keytar) {
      await keytar.setPassword(KEYTAR_SERVICE, service, key)
      stored = true
    }
  } catch {
    // continue to file backup
  }

  if (writeEncryptedFile(service, key)) {
    stored = true
  }

  if (!stored) {
    throw new Error('No secure storage available')
  }
}

export async function getKey(service: string): Promise<string | null> {
  try {
    const keytar = await loadKeytar()
    if (keytar) {
      const fromKeytar = await keytar.getPassword(KEYTAR_SERVICE, service)
      if (fromKeytar) {
        // Keep encrypted file in sync so restarts still work if keytar flickers.
        writeEncryptedFile(service, fromKeytar)
        return fromKeytar
      }
    }
  } catch {
    // fall through to encrypted file
  }

  const fromFile = readEncryptedFile(service)
  if (fromFile) {
    try {
      const keytar = await loadKeytar()
      if (keytar) {
        await keytar.setPassword(KEYTAR_SERVICE, service, fromFile)
      }
    } catch {
      // file value is enough
    }
    return fromFile
  }

  return null
}

export async function deleteKey(service: string): Promise<void> {
  try {
    const keytar = await loadKeytar()
    if (keytar) {
      await keytar.deletePassword(KEYTAR_SERVICE, service)
    }
  } catch {
    // continue cleanup
  }

  try {
    const filePath = encryptedFilePath(service)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch {
    // ignore cleanup errors
  }
}
