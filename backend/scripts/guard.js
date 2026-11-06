// Seeders reset data and use a shared demo password, so they only run against a local
// database unless --force is passed explicitly.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', 'mongo'];

const assertLocalDatabase = (uri) => {
  if (process.argv.includes('--force')) return;

  let host;
  try {
    host = new URL(uri).hostname;
  } catch (_error) {
    host = '';
  }

  if (uri.startsWith('mongodb+srv://') || !LOCAL_HOSTS.includes(host)) {
    throw new Error(
      'Refusing to seed a non-local database. Seeders overwrite data and use demo passwords. ' +
        'Pass --force only if you are sure.'
    );
  }
};

module.exports = { assertLocalDatabase };
