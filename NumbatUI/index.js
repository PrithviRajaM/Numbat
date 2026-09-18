import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go, a web browser, or a
// native build, the environment is set up appropriately for all platforms.
registerRootComponent(App);
