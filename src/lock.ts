import type { LockSettings } from './types';

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = (s: string) => {
  const str = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(str, (c) => c.charCodeAt(0));
};

/** PBKDF2 hash of the PIN, so the PIN itself is never stored. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: 150_000, hash: 'SHA-256' }, key, 256);
  return b64(bits);
}

export async function makeLock(pin: string): Promise<LockSettings> {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, pinHash: await hashPin(pin, salt), pinLength: pin.length };
}

export async function checkPin(lock: LockSettings, pin: string): Promise<boolean> {
  return (await hashPin(pin, lock.salt)) === lock.pinHash;
}

/** Fingerprint / face unlock via the device's built-in authenticator (WebAuthn). */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function registerBiometric(name: string): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Fagitire' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: name || 'fagitire', displayName: name || 'Fagitire' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('cancelled');
  return b64(cred.rawId);
}

/** Asks the device to verify the user (fingerprint, face or device PIN). */
export async function verifyBiometric(credentialId: string): Promise<boolean> {
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!res;
  } catch {
    return false;
  }
}
