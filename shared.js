function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const BANK_KEY = 'finanzas.bankAccounts';
let bankAccounts = loadJSON(BANK_KEY, []);

function saveBankAccounts() {
  saveJSON(BANK_KEY, bankAccounts);
  document.dispatchEvent(new CustomEvent('bank-accounts-changed'));
}

function adjustBankBalance(accountId, delta) {
  const acc = bankAccounts.find(a => a.id === accountId);
  if (!acc) return;
  acc.balance += delta;
  saveBankAccounts();
}

function getAccountName(accountId) {
  const acc = bankAccounts.find(a => a.id === accountId);
  return acc ? acc.name : null;
}
