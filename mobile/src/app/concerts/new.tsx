import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConcerts } from '@/features/concerts/useConcerts';

/**
 * Quick-create concert form.
 * Fields: name, venue, date (YYYY-MM-DD), city — all required.
 */
export default function NewConcertScreen() {
  const { createConcert } = useConcerts();

  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!name.trim()) return 'Concert name is required.';
    if (!venue.trim()) return 'Venue is required.';
    if (!date.trim()) return 'Date is required (YYYY-MM-DD).';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return 'Date must be in YYYY-MM-DD format.';
    }
    if (!city.trim()) return 'City is required.';
    return null;
  };

  const handleCreate = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    setLoading(true);
    try {
      await createConcert({
        name: name.trim(),
        venue: venue.trim(),
        date: date.trim(),
        city: city.trim(),
      });
      router.back();
    } catch (err) {
      console.error('[NewConcertScreen] Failed to create concert:', err);
      Alert.alert('Error', 'Failed to create concert. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back">
            <Text style={styles.backText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New Concert</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Concert Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Summer Tour Night 1"
              accessibilityLabel="Concert Name"
              returnKeyType="next"
            />
          </View>

          {/* Venue */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Venue *</Text>
            <TextInput
              style={styles.input}
              value={venue}
              onChangeText={setVenue}
              placeholder="e.g. The Fillmore"
              accessibilityLabel="Venue"
              returnKeyType="next"
            />
          </View>

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date *</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              accessibilityLabel="Date"
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
            />
          </View>

          {/* City */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. San Francisco"
              accessibilityLabel="City"
              returnKeyType="done"
            />
          </View>
        </ScrollView>

        {/* Create button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.createBtn,
              pressed && styles.createBtnPressed,
              loading && styles.createBtnDisabled,
            ]}
            onPress={handleCreate}
            disabled={loading}
            accessibilityLabel="Create Concert"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Create Concert</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backText: {
    fontSize: 16,
    color: '#208AEF',
    fontWeight: '500',
    minWidth: 64,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    minHeight: 48,
  },
  footer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  createBtn: {
    backgroundColor: '#208AEF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#208AEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 54,
    justifyContent: 'center',
  },
  createBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
