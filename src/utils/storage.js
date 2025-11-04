const STORAGE_KEYS = {
  API_KEY: 'autodocs_api_key',
  PROVIDER: 'autodocs_provider',
  MODEL: 'autodocs_model'
};

export function saveApiKey(key) {
  if (!key) {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  } catch (error) {
    console.error('Failed to save API key:', error);
  }
}

export function getStoredApiKey() {
  try {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return '';
  }
}

export function saveProvider(provider) {
  if (!provider) {
    localStorage.removeItem(STORAGE_KEYS.PROVIDER);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.PROVIDER, provider);
  } catch (error) {
    console.error('Failed to save provider:', error);
  }
}

export function getStoredProvider() {
  try {
    return localStorage.getItem(STORAGE_KEYS.PROVIDER) || 'openai';
  } catch (error) {
    console.error('Failed to retrieve provider:', error);
    return 'openai';
  }
}

export function saveModel(model) {
  if (!model) {
    localStorage.removeItem(STORAGE_KEYS.MODEL);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.MODEL, model);
  } catch (error) {
    console.error('Failed to save model:', error);
  }
}

export function getStoredModel() {
  try {
    return localStorage.getItem(STORAGE_KEYS.MODEL) || 'gpt-4';
  } catch (error) {
    console.error('Failed to retrieve model:', error);
    return 'gpt-4';
  }
}

export function clearStoredCredentials() {
  try {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    localStorage.removeItem(STORAGE_KEYS.PROVIDER);
    localStorage.removeItem(STORAGE_KEYS.MODEL);
  } catch (error) {
    console.error('Failed to clear credentials:', error);
  }
}