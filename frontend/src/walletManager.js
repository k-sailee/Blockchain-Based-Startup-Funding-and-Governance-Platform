import { BrowserProvider } from "ethers";

const listeners = new Set();
const wallets = new Map();
const cleanups = new Map();
let discovered = false;
let selectedId = "";
let monitoring = false;

function devLog(message, details) {
  if (import.meta.env.DEV) console.debug(`[wallet] ${message}`, details);
}

function notify() {
  const state = getWalletState();
  listeners.forEach((listener) => listener(state));
}

function normalizeInfo(info, fallbackId) {
  const rdns = info?.rdns || "";
  const isRabby = rdns === "io.rabby";
  const isMetaMask = rdns === "io.metamask";
  return {
    uuid: info?.uuid || fallbackId,
    name: isRabby ? "Rabby Wallet" : isMetaMask ? "MetaMask" : info?.name || "Browser wallet",
    rdns,
    icon: info?.icon || "",
  };
}

function normalizeChainId(chainHex) {
  if (typeof chainHex === "number") return chainHex;
  if (typeof chainHex === "string") {
    return Number.parseInt(chainHex, chainHex.startsWith("0x") ? 16 : 10);
  }
  throw new Error("Wallet returned an invalid chain ID.");
}

function providerIdentity(wallet) {
  return {
    name: wallet.info.name,
    rdns: wallet.info.rdns,
    uuid: wallet.info.uuid,
    isMetaMask: wallet.provider.isMetaMask === true,
    isRabby: wallet.provider.isRabby === true,
  };
}

function addWallet(info, provider) {
  if (!provider) return;
  const normalized = normalizeInfo(info, `injected-${wallets.size}`);
  const existing = wallets.get(normalized.uuid);
  if (existing?.provider !== provider) {
    cleanups.get(normalized.uuid)?.();
    cleanups.delete(normalized.uuid);
  }
  wallets.set(normalized.uuid, {
    info: normalized,
    provider,
    account: existing?.account || "",
    chainId: existing?.chainId || null,
    connected: existing?.connected || false,
    signer: existing?.signer || null,
    isConnecting: false,
    connectionError: "",
    rawChainId: existing?.rawChainId || "",
    lastChainChanged: existing?.lastChainChanged || "",
    providerIdentity: providerIdentity({
      info: normalized,
      provider,
    }),
    refreshToken: existing?.provider === provider ? existing.refreshToken : 0,
  });
  if (monitoring) monitorWallet(normalized.uuid);
}

function addLegacyProviders() {
  const injected = window.ethereum;
  if (!injected) return;

  const providers = Array.isArray(injected.providers)
    ? injected.providers
    : [injected];

  providers.forEach((provider, index) => {
    const isRabby = provider.isRabby === true;
    const isMetaMask = provider.isMetaMask === true && !isRabby;
    const name = isRabby ? "Rabby Wallet" : isMetaMask ? "MetaMask" : "Injected wallet";
    const rdns = isRabby ? "io.rabby" : isMetaMask ? "io.metamask" : `injected.${index}`;
    addWallet({ uuid: `legacy-${rdns}`, name, rdns }, provider);
  });
}

export function discoverWallets() {
  if (discovered || typeof window === "undefined") return;
  discovered = true;

  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = event.detail;
    addWallet(detail?.info, detail?.provider);
    notify();
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  window.setTimeout(() => {
    if (wallets.size === 0) addLegacyProviders();
    notify();
  }, 300);
}

export function subscribeWallets(listener) {
  discoverWallets();
  listeners.add(listener);
  listener(getWalletState());
  return () => listeners.delete(listener);
}

export function getWalletState() {
  const selected = wallets.get(selectedId) || null;
  return {
    wallets: Array.from(wallets.values()),
    selectedId,
    selected,
    provider: selected?.connected ? selected.provider : null,
    signer: selected?.connected ? selected.signer : null,
    account: selected?.connected ? selected.account : "",
    chainId: selected?.connected ? selected.chainId : null,
    isConnected: Boolean(selected?.connected && selected.account),
    isConnecting: Boolean(selected?.isConnecting),
    connectionError: selected?.connectionError || "",
    rawChainId: selected?.connected ? selected.rawChainId : "",
    lastChainChanged: selected?.lastChainChanged || "",
    providerIdentity: selected?.providerIdentity || null,
    connected: Boolean(selected?.connected && selected.account),
  };
}

export function selectWallet(uuid) {
  if (!wallets.has(uuid)) return false;
  selectedId = uuid;
  notify();
  return true;
}

export function getSelectedProvider() {
  return wallets.get(selectedId)?.connected
    ? wallets.get(selectedId).provider
    : null;
}

export function getWalletLabel(wallet) {
  return wallet?.info?.name || "Browser wallet";
}

async function readWalletState(wallet) {
  const [accounts, chainHex] = await Promise.all([
    wallet.provider.request({ method: "eth_accounts" }),
    wallet.provider.request({ method: "eth_chainId" }),
  ]);
  return {
    account: accounts[0] || "",
    chainId: normalizeChainId(chainHex),
    rawChainId: String(chainHex),
  };
}

function updateWalletChainImmediately(wallet, chainHex) {
  wallet.refreshToken += 1;
  wallet.rawChainId = String(chainHex);
  wallet.chainId = normalizeChainId(chainHex);
  wallet.signer = null;
  wallet.connectionError = "";
  notify();
}

export async function connectWallet(uuid) {
  const wallet = wallets.get(uuid);
  if (!wallet) throw new Error("Selected wallet is not installed.");

  selectedId = uuid;
  wallet.refreshToken += 1;
  wallet.isConnecting = true;
  wallet.connectionError = "";
  notify();
  try {
    if (wallet.info.rdns === "io.metamask" && wallet.provider.isMetaMask !== true) {
      throw new Error("The selected provider is not MetaMask.");
    }
    if (wallet.info.rdns === "io.rabby" && wallet.provider.isRabby !== true) {
      throw new Error("The selected provider is not Rabby Wallet.");
    }
    let accounts = await wallet.provider.request({ method: "eth_accounts" });
    if (!accounts?.[0]) {
      accounts = await wallet.provider.request({ method: "eth_requestAccounts" });
    }
    if (!accounts?.[0]) throw new Error(`${getWalletLabel(wallet)} returned no account.`);
    const chainHex = await wallet.provider.request({ method: "eth_chainId" });
    const provider = new BrowserProvider(wallet.provider);
    wallet.account = accounts[0];
    wallet.chainId = normalizeChainId(chainHex);
    wallet.rawChainId = String(chainHex);
    wallet.signer = await provider.getSigner(accounts[0]);
    wallet.connected = true;
    devLog("connected", {
      wallet: wallet.info.name,
      provider: wallet.providerIdentity,
      account: wallet.account,
      rawChainId: wallet.rawChainId,
      chainId: wallet.chainId,
    });
    return wallet;
  } catch (error) {
    wallet.account = "";
    wallet.chainId = null;
    wallet.rawChainId = "";
    wallet.signer = null;
    wallet.connected = false;
    wallet.connectionError =
      error?.code === 4001 ? "Connection request was rejected." : error?.message || "Wallet connection failed.";
    throw new Error(wallet.connectionError);
  } finally {
    wallet.isConnecting = false;
    notify();
  }
}

export async function refreshWallet(uuid) {
  const wallet = wallets.get(uuid);
  if (!wallet?.connected) return;
  const refreshToken = ++wallet.refreshToken;
  try {
    const state = await readWalletState(wallet);
    if (refreshToken !== wallet.refreshToken) return;
    wallet.account = state.account;
    wallet.chainId = state.chainId;
    wallet.rawChainId = state.rawChainId;
    wallet.connected = Boolean(state.account);
    wallet.signer = wallet.connected
      ? await new BrowserProvider(wallet.provider).getSigner(state.account)
      : null;
    devLog("wallet state refreshed", {
      wallet: wallet.info.name,
      account: wallet.account,
      rawChainId: wallet.rawChainId,
      chainId: wallet.chainId,
    });
  } catch {
    if (refreshToken !== wallet.refreshToken) return;
    wallet.account = "";
    wallet.chainId = null;
    wallet.rawChainId = "";
    wallet.connected = false;
    wallet.signer = null;
  }
  notify();
}

export function disconnectWallet(uuid = selectedId) {
  const wallet = wallets.get(uuid);
  if (!wallet) return;
  wallet.account = "";
  wallet.refreshToken += 1;
  wallet.chainId = null;
  wallet.rawChainId = "";
  wallet.lastChainChanged = "";
  wallet.connected = false;
  wallet.signer = null;
  if (selectedId === uuid) selectedId = "";
  notify();
}

export async function connectWalletConnect(provider, account, chainId) {
  if (!provider || !account || chainId === undefined) return;
  addWallet(
    {
      uuid: "walletconnect",
      name: "WalletConnect",
      rdns: "walletconnect",
    },
    provider
  );
  const wallet = wallets.get("walletconnect");
  const accounts = await provider.request({ method: "eth_accounts" });
  const rawChainId = await provider.request({ method: "eth_chainId" });
  wallet.account = accounts?.[0] || account;
  wallet.chainId = normalizeChainId(rawChainId);
  wallet.rawChainId = String(rawChainId);
  wallet.connected = true;
  wallet.signer = await new BrowserProvider(provider).getSigner(account);
  selectedId = "walletconnect";
  devLog("WalletConnect selected", {
    provider: wallet.providerIdentity,
    account: wallet.account,
    rawChainId: wallet.rawChainId,
    chainId: wallet.chainId,
  });
  notify();
}

export function startWalletMonitoring() {
  discoverWallets();
  monitoring = true;
  wallets.forEach((_, uuid) => monitorWallet(uuid));
  return () => {
    monitoring = false;
    cleanups.forEach((cleanup) => cleanup());
    cleanups.clear();
  };
}

function monitorWallet(uuid) {
  if (cleanups.has(uuid)) return;
  const wallet = wallets.get(uuid);
  if (!wallet) return;

  const handleAccountsChanged = (accounts) => {
    if (Array.isArray(accounts) && accounts.length === 0) {
      disconnectWallet(uuid);
      return;
    }
    wallet.refreshToken += 1;
    wallet.account = accounts?.[0] || "";
    wallet.signer = null;
    notify();
    refreshWallet(uuid);
  };
  const handleChainChanged = (chainHex) => {
    wallet.lastChainChanged = String(chainHex);
    updateWalletChainImmediately(wallet, chainHex);
    devLog("chainChanged", {
      wallet: wallet.info.name,
      provider: wallet.providerIdentity,
      rawChainId: wallet.lastChainChanged,
    });
    refreshWallet(uuid);
  };
  const handleDisconnect = () => {
    devLog("wallet disconnected", { wallet: wallet.info.name });
    disconnectWallet(uuid);
  };
  wallet.provider.on?.("accountsChanged", handleAccountsChanged);
  wallet.provider.on?.("chainChanged", handleChainChanged);
  wallet.provider.on?.("disconnect", handleDisconnect);
  cleanups.set(uuid, () => {
    wallet.provider.removeListener?.("accountsChanged", handleAccountsChanged);
    wallet.provider.removeListener?.("chainChanged", handleChainChanged);
    wallet.provider.removeListener?.("disconnect", handleDisconnect);
  });
}
