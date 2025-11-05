// App.js - Feelings Messenger with Firebase (React Native)
// 
// FIREBASE SETUP (DO THIS FIRST):
// 1. Go to https://console.firebase.google.com/
// 2. Click "Add project" and create a new project
// 3. Click "Add app" and select the Web icon (</>)
// 4. Register your app and copy the firebaseConfig object
// 5. In Firebase Console, go to "Build" > "Realtime Database"
// 6. Click "Create Database" and choose a location
// 7. Start in "Test mode" (we'll secure it later)
// 8. Replace the firebaseConfig below with YOUR config
//
// PROJECT SETUP:
// 1. npx create-expo-app FeelingsApp
// 2. cd FeelingsApp
// 3. npm install firebase expo-notifications @react-native-async-storage/async-storage
// 4. Replace App.js with this code
// 5. Update firebaseConfig with your Firebase credentials
// 6. Update app.json (see instructions below)
// 7. npx expo start
//
// IMPORTANT: Add to app.json for background notifications:
// {
//   "expo": {
//     "plugins": [
//       [
//         "expo-notifications",
//         {
//           "sounds": ["./assets/notification.wav"]
//         }
//       ]
//     ],
//     "android": {
//       "useNextNotificationsApi": true
//     }
//   }
// }

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  Vibration,
  Alert,
  Platform,
  AppState,
  KeyboardAvoidingView,  
  ScrollView,            
  Clipboard,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, query, orderByChild, limitToLast, off, serverTimestamp, onDisconnect, remove } from 'firebase/database';

// 🔥 REPLACE THIS WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "", 
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Configure notifications to work in background
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [lobbyCode, setLobbyCode] = useState('');
  const [currentLobby, setCurrentLobby] = useState(null);
  const [userName, setUserName] = useState('');
  const [notificationAnim] = useState(new Animated.Value(-100));
  const [currentNotification, setCurrentNotification] = useState(null);
  const [lastMessageId, setLastMessageId] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showUsersList, setShowUsersList] = useState(false);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const messagesListenerRef = useRef(null);
  const usersListenerRef = useRef(null);
  const userPresenceRef = useRef(null);

  const emojis = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '😡', label: 'Angry' },
    { emoji: '😍', label: 'Love' },
    { emoji: '😴', label: 'Tired' },
    { emoji: '🤗', label: 'Excited' },
    { emoji: '😰', label: 'Anxious' },
    { emoji: '😌', label: 'Calm' },
    { emoji: '🤔', label: 'Thinking' },
    { emoji: '😋', label: 'Hungry' },
    { emoji: '🥳', label: 'Party' },
    { emoji: '😭', label: 'Crying' },
  ];

  useEffect(() => {
    requestNotificationPermissions();
    loadSavedSession();
    setupBackgroundNotificationListener();

    // Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
      }

      appState.current = nextAppState;
      setAppStateVisible(appState.current);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (currentLobby && userName) {
      setupMessageListener();
      setupUsersListener();
      setupUserPresence();
      saveSession();
    }

    return () => {
      cleanupListeners();
    };
  }, [currentLobby, userName]);

  const setupBackgroundNotificationListener = () => {
    // Listen for notifications received while app is in background
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    return () => subscription.remove();
  };

  const loadSavedSession = async () => {
    try {
      const savedLobby = await AsyncStorage.getItem('currentLobby');
      const savedUserName = await AsyncStorage.getItem('userName');
      const savedLastMessageId = await AsyncStorage.getItem('lastMessageId');

      if (savedLobby && savedUserName) {
        setCurrentLobby(savedLobby);
        setUserName(savedUserName);
        if (savedLastMessageId) {
          setLastMessageId(savedLastMessageId);
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const saveSession = async () => {
    try {
      if (currentLobby) {
        await AsyncStorage.setItem('currentLobby', currentLobby);
      }
      if (userName) {
        await AsyncStorage.setItem('userName', userName);
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const setupUserPresence = async () => {
    if (!currentLobby || !userName) return;

    const userStatusRef = ref(database, `lobbies/${currentLobby}/users/${userName}`);
    userPresenceRef.current = userStatusRef;

    // Set user as online
    await set(userStatusRef, {
      name: userName,
      online: true,
      lastSeen: Date.now()
    });

    // Remove user on disconnect
    onDisconnect(userStatusRef).remove();
  };

  const setupUsersListener = () => {
    if (!currentLobby) return;

    const usersRef = ref(database, `lobbies/${currentLobby}/users`);
    const previousUsers = new Set();

    usersListenerRef.current = onValue(usersRef, (snapshot) => {
      const users = [];
      const currentUsers = new Set();

      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        users.push(userData);
        currentUsers.add(userData.name);
      });

      setConnectedUsers(users);

      // Check for new users
      currentUsers.forEach(user => {
        if (!previousUsers.has(user) && user !== userName) {
          // New user joined
          showNotification('👋', `${user} joined`, false);
          sendPushNotification('👋 User Joined', `${user} joined the lobby`);
        }
      });

      // Update previous users set
      previousUsers.clear();
      currentUsers.forEach(user => previousUsers.add(user));
    });
  };

  const setupMessageListener = () => {
    cleanupMessageListener();

    const messagesRef = ref(database, `lobbies/${currentLobby}/messages`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(50));
    
    messagesListenerRef.current = onValue(messagesQuery, async (snapshot) => {
      const messages = [];
      snapshot.forEach((childSnapshot) => {
        messages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
      
      // Get the latest message that's not from the current user
      const latestMessage = messages
        .filter(msg => msg.from !== userName)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      
      if (latestMessage && latestMessage.id !== lastMessageId) {
        setLastMessageId(latestMessage.id);
        await AsyncStorage.setItem('lastMessageId', latestMessage.id);
        await handleNewMessage(latestMessage);
      }
    });
  };

  const cleanupMessageListener = () => {
    if (messagesListenerRef.current && currentLobby) {
      const messagesRef = ref(database, `lobbies/${currentLobby}/messages`);
      off(messagesRef);
      messagesListenerRef.current = null;
    }
  };

  const cleanupUsersListener = () => {
    if (usersListenerRef.current && currentLobby) {
      const usersRef = ref(database, `lobbies/${currentLobby}/users`);
      off(usersRef);
      usersListenerRef.current = null;
    }
  };

  const cleanupListeners = () => {
    cleanupMessageListener();
    cleanupUsersListener();
    
    // Remove user presence
    if (userPresenceRef.current) {
      remove(userPresenceRef.current);
      userPresenceRef.current = null;
    }
  };

  const requestNotificationPermissions = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('feelings', {
        name: 'Feelings',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B5CF6',
        sound: 'default',
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please enable notifications to receive feelings even when the app is closed');
    }
  };

  const generateLobbyCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createLobby = async () => {
    if (!userName.trim()) {
      Alert.alert('Name required', 'Please enter your name');
      return;
    }
    
    const code = generateLobbyCode();
    const lobbyRef = ref(database, `lobbies/${code}`);
    
    try {
      await set(lobbyRef, {
        creator: userName,
        createdAt: Date.now(),
        active: true
      });
      
      await AsyncStorage.setItem('userName', userName);
      await AsyncStorage.setItem('currentLobby', code);
      setCurrentLobby(code);
      Vibration.vibrate(50);
    } catch (error) {
      Alert.alert('Error', 'Failed to create lobby: ' + error.message);
    }
  };

  const joinLobby = async () => {
    if (!userName.trim()) {
      Alert.alert('Name required', 'Please enter your name');
      return;
    }
    if (!lobbyCode.trim()) {
      Alert.alert('Code required', 'Please enter a lobby code');
      return;
    }
    
    const lobbyRef = ref(database, `lobbies/${lobbyCode.toUpperCase()}`);
    
    try {
      onValue(lobbyRef, async (snapshot) => {
        if (snapshot.exists()) {
          await AsyncStorage.setItem('userName', userName);
          await AsyncStorage.setItem('currentLobby', lobbyCode.toUpperCase());
          setCurrentLobby(lobbyCode.toUpperCase());
          Vibration.vibrate(50);
        } else {
          Alert.alert('Not found', 'Lobby code not found');
        }
      }, { onlyOnce: true });
    } catch (error) {
      Alert.alert('Error', 'Failed to join lobby: ' + error.message);
    }
  };

  const sendEmoji = async (emoji) => {
    if (!currentLobby) return;
    
    const messagesRef = ref(database, `lobbies/${currentLobby}/messages`);
    const newMessageRef = push(messagesRef);
    
    try {
      await set(newMessageRef, {
        emoji,
        from: userName,
        timestamp: Date.now()
      });
      
      Vibration.vibrate(50);
      
      // Only show in-app notification if app is active
      if (appStateVisible === 'active') {
        showNotification(emoji, 'You', true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send emoji: ' + error.message);
    }
  };

  const sendPushNotification = async (title, body) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  };

  const handleNewMessage = async (message) => {
    // Always send push notification (works even when app is closed)
    await sendPushNotification('💕 New Feeling', `${message.from} sent you ${message.emoji}`);
    
    // Show in-app notification only if app is active
    if (appStateVisible === 'active') {
      showNotification(message.emoji, message.from, false);
      Vibration.vibrate([0, 100, 50, 100]);
    }
  };

  const showNotification = (emoji, sender, isOwn) => {
    setCurrentNotification({ emoji, sender, isOwn });
    
    Animated.sequence([
      Animated.spring(notificationAnim, {
        toValue: 20,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.delay(2500),
      Animated.timing(notificationAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setCurrentNotification(null));
  };

  const disconnect = async () => {
    cleanupListeners();
    await AsyncStorage.removeItem('currentLobby');
    await AsyncStorage.removeItem('lastMessageId');
    setCurrentLobby(null);
    setLobbyCode('');
    setLastMessageId(null);
    setConnectedUsers([]);
  };

  const copyLobbyCode = () => {
    Clipboard.setString(currentLobby);
    Alert.alert('Copied!', 'Lobby code copied to clipboard');
    Vibration.vibrate(50);
  };

  if (!currentLobby) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.setupContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>💕 Feelings</Text>
              <Text style={styles.subtitle}>Share emotions instantly</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.input}
                value={userName}
                onChangeText={setUserName}
                placeholder="Enter your name"
                placeholderTextColor="#999"
              />

              <TouchableOpacity style={styles.primaryButton} onPress={createLobby}>
                <Text style={styles.primaryButtonText}>Create New Lobby</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.label}>Lobby Code</Text>
              <TextInput
                style={styles.input}
                value={lobbyCode}
                onChangeText={(text) => setLobbyCode(text.toUpperCase())}
                placeholder="Enter code"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />

              <TouchableOpacity style={styles.secondaryButton} onPress={joinLobby}>
                <Text style={styles.secondaryButtonText}>Join Lobby</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Notification */}
      {currentNotification && (
        <Animated.View
          style={[
            styles.notification,
            { transform: [{ translateY: notificationAnim }] },
            currentNotification.isOwn ? styles.notificationSent : styles.notificationReceived
          ]}
        >
          <Text style={styles.notificationEmoji}>{currentNotification.emoji}</Text>
          <View>
            <Text style={styles.notificationTitle}>
              {currentNotification.isOwn ? 'You sent' : `${currentNotification.sender}`}
            </Text>
            <Text style={styles.notificationSubtitle}>
              {currentNotification.isOwn ? 'Delivered!' : 'New feeling!'}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.connectedHeader}>
        <View>
          <Text style={styles.lobbyLabel}>Lobby Code</Text>
          <TouchableOpacity onPress={copyLobbyCode}>
            <Text style={styles.lobbyCode}>{currentLobby} 📋</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.usersButton}
          onPress={() => setShowUsersList(!showUsersList)}
        >
          <Text style={styles.usersCount}>👥 {connectedUsers.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Users List */}
      {showUsersList && (
        <View style={styles.usersList}>
          <Text style={styles.usersListTitle}>Connected Users</Text>
          {connectedUsers.map((user, index) => (
            <View key={index} style={styles.userItem}>
              <View style={styles.userOnlineDot} />
              <Text style={styles.userItemText}>{user.name}</Text>
              {user.name === userName && (
                <Text style={styles.youLabel}>(You)</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.userInfo}>
        <Text style={styles.userText}>Signed in as <Text style={styles.userBold}>{userName}</Text></Text>
        <TouchableOpacity onPress={disconnect}>
          <Text style={styles.disconnectButton}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      {/* Emoji Grid */}
      <View style={styles.mainContent}>
        <Text style={styles.sectionTitle}>Send a Feeling</Text>
        <View style={styles.emojiGrid}>
          {emojis.map((item) => (
            <TouchableOpacity
              key={item.emoji}
              style={styles.emojiButton}
              onPress={() => sendEmoji(item.emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.emojiIcon}>{item.emoji}</Text>
              <Text style={styles.emojiLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.footer}>Share the lobby code with your friend</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#8B5CF6',
  },
  setupContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  notification: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  notificationSent: {
    backgroundColor: '#3B82F6',
  },
  notificationReceived: {
    backgroundColor: '#10B981',
  },
  notificationEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  notificationTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  notificationSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  connectedHeader: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lobbyLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  lobbyCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  usersButton: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  usersCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  usersList: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  usersListTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  userOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  userItemText: {
    fontSize: 14,
    color: '#374151',
  },
  youLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  userText: {
    color: '#fff',
    fontSize: 14,
  },
  userBold: {
    fontWeight: 'bold',
  },
  disconnectButton: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 24,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emojiButton: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: '#F3E8FF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emojiIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  emojiLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  footer: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
});
