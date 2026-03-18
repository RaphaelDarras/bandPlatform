import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function buildYears() {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 1; y <= current + 5; y++) years.push(y);
  return years;
}

interface ColumnProps {
  data: (string | number)[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

function PickerColumn({ data, selectedIndex, onChange }: ColumnProps) {
  const ref = useRef<FlatList>(null);

  const handleMomentumEnd = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    onChange(clamped);
  };

  return (
    <View style={col.wrapper}>
      <View style={col.highlight} pointerEvents="none" />
      <FlatList
        ref={ref}
        data={data}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialScrollIndex={selectedIndex}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item, index }) => (
          <View style={col.item}>
            <Text style={[col.itemText, index === selectedIndex && col.itemTextSelected]}>
              {item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const col = StyleSheet.create({
  wrapper: {
    flex: 1,
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#208AEF',
    zIndex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 16,
    color: '#888',
  },
  itemTextSelected: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
});

/**
 * Quick-create concert form.
 * Fields: venue, date, city, country — all required.
 */
export default function NewConcertScreen() {
  const { createConcert } = useConcerts();

  const today = new Date();
  const years = buildYears();

  const submittingRef = useRef(false);
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const numDays = daysInMonth(selectedMonth, selectedYear);
  const days = Array.from({ length: numDays }, (_, i) => i + 1);
  const monthNames = MONTHS;

  const formattedDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const displayDate = `${MONTHS[selectedMonth - 1]} ${selectedDay}, ${selectedYear}`;

  const handleMonthChange = (index: number) => {
    setSelectedMonth(index + 1);
    const maxDay = daysInMonth(index + 1, selectedYear);
    if (selectedDay > maxDay) setSelectedDay(maxDay);
  };

  const handleYearChange = (index: number) => {
    setSelectedYear(years[index]);
    const maxDay = daysInMonth(selectedMonth, years[index]);
    if (selectedDay > maxDay) setSelectedDay(maxDay);
  };

  const validate = (): string | null => {
    if (!venue.trim()) return 'Venue is required.';
    if (!city.trim()) return 'City is required.';
    if (!country.trim()) return 'Country is required.';
    return null;
  };

  const handleCreate = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;

    const validationError = validate();
    if (validationError) {
      submittingRef.current = false;
      Alert.alert('Validation Error', validationError);
      return;
    }

    setLoading(true);
    try {
      await createConcert({
        venue: venue.trim(),
        date: formattedDate,
        city: city.trim(),
        country: country.trim(),
        currency,
      });
      router.back();
    } catch (err) {
      console.error('[NewConcertScreen] Failed to create concert:', err);
      Alert.alert('Error', 'Failed to create concert. Please try again.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
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
            <Pressable
              style={styles.dateInputWrapper}
              onPress={() => setShowPicker(true)}
              accessibilityLabel="Select date"
            >
              <View style={styles.dateInput}>
                <Text style={styles.dateInputText}>{displayDate}</Text>
                <Text style={styles.dateInputIcon}>📅</Text>
              </View>
            </Pressable>
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
              returnKeyType="next"
            />
          </View>

          {/* Country */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Country *</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="e.g. United States"
              accessibilityLabel="Country"
              returnKeyType="done"
            />
          </View>

          {/* Currency */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.chipRow}>
              {(['EUR', 'GBP', 'USD', 'CAD'] as const).map((c) => (
                <Pressable
                  key={c}
                  style={[styles.chip, currency === c && styles.chipSelected]}
                  onPress={() => setCurrency(c)}
                  accessibilityLabel={c}
                >
                  <Text style={[styles.chipText, currency === c && styles.chipTextSelected]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Create button */}
        <View style={styles.footer}>
          <Pressable
            style={styles.createBtnWrapper}
            onPress={handleCreate}
            disabled={loading}
            accessibilityLabel="Create Concert"
          >
            {({ pressed }) => (
              <View style={[
                styles.createBtn,
                pressed && styles.createBtnPressed,
                loading && styles.createBtnDisabled,
              ]}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createBtnText}>Create Concert</Text>
                )}
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Date picker modal */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setShowPicker(false)}>
                <Text style={styles.pickerDone}>Done</Text>
              </Pressable>
            </View>
            <View style={styles.pickerColumns}>
              <PickerColumn
                data={monthNames}
                selectedIndex={selectedMonth - 1}
                onChange={handleMonthChange}
              />
              <PickerColumn
                data={days}
                selectedIndex={selectedDay - 1}
                onChange={(i) => setSelectedDay(i + 1)}
              />
              <PickerColumn
                data={years}
                selectedIndex={years.indexOf(selectedYear)}
                onChange={handleYearChange}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipSelected: { backgroundColor: '#EBF4FF', borderColor: '#208AEF' },
  chipText: { fontSize: 14, color: '#666', fontWeight: '500' },
  chipTextSelected: { color: '#208AEF', fontWeight: '700' },
  dateInputWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  dateInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  dateInputIcon: {
    fontSize: 18,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#208AEF',
  },
  pickerColumns: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  createBtnWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
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
