import { defineConfig } from 'cypress';
import coverage from '@cypress/code-coverage/task';
import eyesPlugin from '@applitools/eyes-cypress';

// Load cypress-image-snapshot plugin via wrapper to avoid ES module issues in CI
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { addMatchImageSnapshotPlugin } = require('./cypress-image-snapshot-loader.js');

export default eyesPlugin(
  defineConfig({
    projectId: 'n2sma2',
    viewportWidth: 1440,
    viewportHeight: 1024,
    e2e: {
      specPattern: 'cypress/integration/**/*.{js,ts}',
      setupNodeEvents(on, config) {
        coverage(on, config);
        on('before:browser:launch', (browser, launchOptions) => {
          if (browser.name === 'chrome' && browser.isHeadless) {
            launchOptions.args.push('--window-size=1440,1024', '--force-device-scale-factor=1');
          }
          return launchOptions;
        });
        addMatchImageSnapshotPlugin(on, config);
        // copy any needed variables from process.env to config.env
        config.env.useAppli = process.env.USE_APPLI ? true : false;

        // do not forget to return the changed config object!
        return config;
      },
    },
    video: false,
  })
);
