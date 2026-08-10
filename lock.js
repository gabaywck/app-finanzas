const SALT_KEY = 'finanzas.salt';
const VAULT_KEY = 'finanzas.vaultData';
const PBKDF2_ITERATIONS = 150000;
const LEGACY_KEYS = [
  'finanzas.transactions',
  'finanzas.bankAccounts',
  'finanzas.crypto',
  'finanzas.stocks',
  'finanzas.finnhubKey',
  'finanzas.priceCache',
  'finanzas.goals',
];
const SCRIPT_SEQUENCE = ['shared.js', 'app.js', 'patrimonio.js', 'informe.js', 'objetivo.js'];
const ASSET_VERSION = '15';

let VAULT = {};
let vaultKey = null;
let persistTimer = null;

function loadJSON(key, fallback) {
  return Object.prototype.hasOwnProperty.call(VAULT, key) ? VAULT[key] : fallback;
}

function saveJSON(key, value) {
  VAULT[key] = value;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistVault, 150);
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function deriveKey(pin, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVault(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(obj));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const cipherBytes = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);
  return bytesToBase64(combined);
}

async function decryptVault(key, combinedB64) {
  const combined = base64ToBytes(combinedB64);
  const iv = combined.slice(0, 12);
  const cipherBytes = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

async function persistVault() {
  if (!vaultKey) return;
  const encoded = await encryptVault(vaultKey, VAULT);
  localStorage.setItem(VAULT_KEY, encoded);
}

function migrateLegacyData() {
  const migrated = {};
  let found = false;
  LEGACY_KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      found = true;
      if (key === 'finanzas.finnhubKey') {
        migrated[key] = raw;
      } else {
        try { migrated[key] = JSON.parse(raw); } catch { /* skip corrupt entry */ }
      }
    }
  });
  if (found) LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
  return migrated;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

async function bootApp() {
  for (const file of SCRIPT_SEQUENCE) {
    await loadScript(`${file}?v=${ASSET_VERSION}`);
  }
  document.getElementById('lockScreen').style.display = 'none';
  document.querySelector('.app').style.display = '';
}

const lockScreen = document.getElementById('lockScreen');
const lockTitle = document.getElementById('lockTitle');
const lockSubtitle = document.getElementById('lockSubtitle');
const pinInput = document.getElementById('pinInput');
const pinSubmit = document.getElementById('pinSubmit');
const lockError = document.getElementById('lockError');

const isFirstRun = !localStorage.getItem(SALT_KEY);
let mode = isFirstRun ? 'setup-1' : 'unlock';
let firstPin = null;

function setStage(stage) {
  mode = stage;
  lockError.textContent = '';
  pinInput.value = '';
  pinInput.focus();
  if (stage === 'unlock') {
    lockTitle.textContent = 'Introduce tu PIN';
    lockSubtitle.textContent = 'Tus datos están cifrados en este navegador.';
  } else if (stage === 'setup-1') {
    lockTitle.textContent = 'Crea tu PIN';
    lockSubtitle.textContent = 'Protegerá tus datos en este navegador. No hay forma de recuperarlo si lo olvidas.';
  } else if (stage === 'setup-2') {
    lockTitle.textContent = 'Confirma tu PIN';
    lockSubtitle.textContent = 'Escríbelo de nuevo para confirmarlo.';
  }
}

async function handleSubmit() {
  const value = pinInput.value;
  if (!value) return;

  if (mode === 'setup-1') {
    firstPin = value;
    setStage('setup-2');
    return;
  }

  if (mode === 'setup-2') {
    if (value !== firstPin) {
      lockError.textContent = 'Los PIN no coinciden. Empieza de nuevo.';
      firstPin = null;
      setStage('setup-1');
      return;
    }
    pinSubmit.disabled = true;
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(SALT_KEY, bytesToBase64(saltBytes));
    vaultKey = await deriveKey(value, saltBytes);
    VAULT = migrateLegacyData();
    await persistVault();
    await bootApp();
    return;
  }

  if (mode === 'unlock') {
    pinSubmit.disabled = true;
    try {
      const saltBytes = base64ToBytes(localStorage.getItem(SALT_KEY));
      const key = await deriveKey(value, saltBytes);
      const stored = localStorage.getItem(VAULT_KEY);
      VAULT = stored ? await decryptVault(key, stored) : {};
      vaultKey = key;
      await bootApp();
    } catch {
      lockError.textContent = 'PIN incorrecto. Inténtalo de nuevo.';
      pinInput.value = '';
      pinInput.focus();
      pinSubmit.disabled = false;
    }
  }
}

pinSubmit.addEventListener('click', handleSubmit);
pinInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSubmit();
});

setStage(mode);
