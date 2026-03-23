# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Running on Android Emulator

There are two ways to run the app on an Android emulator. Make sure your emulator is running (via Android Studio) before launching.

### `npx expo start --android`

- Starts the **Metro bundler** and connects to **Expo Go** or a development client.
- No native build step — only bundles JavaScript.
- Faster to start, but relies on a pre-built native app.
- Best for **day-to-day JS development** when the native layer hasn't changed.

### `npx expo run:android` (aliased as `npm run android`)

- Runs a **full native Android build** (Gradle), then installs the APK on the emulator.
- Required when you change native code, add native modules, or modify files in the `android/` directory.
- Slower, but produces a standalone native binary.

**When to use which:**

| Scenario | Command |
|---|---|
| Everyday JS/UI development | `npx expo start --android` |
| Added a new native dependency | `npx expo run:android` |
| Changed native config (`app.json` native fields, `android/` files) | `npx expo run:android` |
| Just editing React components or screens | `npx expo start --android` |

## Building an APK for a real device

To build an installable APK using EAS (Expo Application Services):

1. Update `EXPO_PUBLIC_API_URL` in `eas.json` with your production API URL.

2. Build the APK:

   ```bash
   npx eas-cli build --platform android --profile preview
   ```

3. Once the build completes, download the APK from the link provided and install it on your phone.

Available build profiles (configured in `eas.json`):

| Profile | Purpose |
|---|---|
| `development` | Dev client for emulator (uses `10.0.2.2` localhost) |
| `preview` | Installable APK for real devices |
| `production` | AAB for Play Store distribution |

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
