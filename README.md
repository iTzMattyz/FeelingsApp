# 💕 Feelings Messenger

Feelings Messenger is a simple, real-time React Native (Expo) app for sharing your "feelings" (emojis) instantly with friends. It uses Firebase Realtime Database for instant data sync and Expo Notifications to send push notifications, even when the app is in the background or closed.

This app is perfect as a "thinking of you" or "nudge" app for couples, close friends, or family.

## 🌟 Features

* **Real-time Communication:** Send and receive feelings instantly, powered by Firebase.
* **Lobby System:** Create a private lobby with a unique 6-character code to share with one or more people.
* **Persistent Session:** The app remembers your name and lobby using AsyncStorage.
* **Push Notifications:** Receive a push notification (with vibration) whenever a new feeling is sent in your lobby, even if the app is closed.
* **In-App Notifications:** A sleek, animated banner appears for new messages when the app is open.
* **User Presence:** See a list of who is currently online in the lobby.
* **Message Cooldown:** A built-in 8-second cooldown prevents spamming.

## 🛠️ Technologies Used

* **React Native**
* **Expo** (Managed Workflow)
* **Firebase Realtime Database** (for data sync and presence)
* **Expo Notifications** (for local and push notifications)
* **AsyncStorage** (for session persistence)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

### 1. Firebase Setup (Required)

This project requires a Firebase backend.

1.  Go to the [Firebase Console](https://console.firebase.google.com/) and click **"Add project"**.
2.  Give your project a name (e.g., "FeelingsApp") and follow the setup steps.
3.  Once in your project, click **"Add app"** and select the **Web icon** (`</>`).
4.  Register your app. Firebase will provide you with a `firebaseConfig` object. **Copy this object.**
5.  In the Firebase console, go to **Build > Realtime Database**.
6.  Click **"Create Database"** and choose a location.
7.  Start in **"Test mode"** when prompted for security rules. This will allow read/write access for 30 days.

### 2. Project Setup

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/your-username/feelings-app.git](https://github.com/your-username/feelings-app.git)
    cd feelings-app
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```
    This will install React Native, Expo, Firebase, and other necessary packages.

### 3. Configuration

1.  **Add Firebase Credentials:**
    Open `App.js` and find the `firebaseConfig` object (around line 46). Replace the placeholder object with the one you copied from your Firebase project.

    ```javascript
    // 🔥 REPLACE THIS WITH YOUR FIREBASE CONFIG
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      databaseURL: "YOUR_DATABASE_URL",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID",
      measurementId: "YOUR_MEASUREMENT_ID" // (Optional)
    };
    ```

2.  **Configure `app.json` for Notifications:**
    For background notifications and custom sounds to work, you must update your `app.json` file. Ensure it contains the `plugins` and `android.useNextNotificationsApi` keys as shown below.

    ```json
    {
      "expo": {
        // ... other settings (name, slug, etc.)
        "plugins": [
          [
            "expo-notifications",
            {
              "sounds": ["./assets/notification.wav"]
            }
          ]
        ],
        "android": {
          "useNextNotificationsApi": true
          // ... other android settings
        }
      }
    }
    ```

## 📱 Running the App

Once all dependencies are installed and configurations are set, you can run the app.

1.  **Start the Expo server:**
    ```sh
    npx expo start
    ```

2.  **Open the app:**
    * Scan the QR code generated in the terminal using the **Expo Go** app on your iOS or Android device.
    * You can also press `a` to run on an Android emulator or `i` to run on an iOS simulator (if installed).

## 📄 License

This project is licensed under the MIT License.
