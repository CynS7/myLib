// Einstellungen, die nur auf diesem Gerät gespeichert werden.

const GOOGLE_KEY = 'mylib.googleApiKey';

export class Settings {
  constructor(storage) {
    this.storage = storage;
  }

  get googleApiKey() {
    return this.storage.getString(GOOGLE_KEY);
  }

  set googleApiKey(value) {
    if (!this.storage.setString(GOOGLE_KEY, String(value || '').trim())) {
      throw new Error('Speichern fehlgeschlagen.');
    }
  }
}
