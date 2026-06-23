import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/useStore';
import { analyzeMealPhoto, AnalyzedItem } from '../services/mealPhoto';
import { MealType } from '../types';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

interface ReviewItem extends AnalyzedItem {
  id: string;
  qty: number; // serving multiplier the user can adjust
}

interface Props {
  route: { params: { meal: MealType; date: string } };
  navigation: any;
}

export function MealPhotoScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const addEntry = useStore((s) => s.addEntry);

  async function pick(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        `Please allow ${source === 'camera' ? 'camera' : 'photo'} access in Settings to use this feature.`,
      );
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      base64: true,
      quality: 0.4,
    };
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    setImageUri(asset.uri);
    runAnalysis(asset.base64!);
  }

  async function runAnalysis(base64: string) {
    setLoading(true);
    setAnalyzed(false);
    setItems([]);
    try {
      const result = await analyzeMealPhoto(base64);
      setItems(result.map((it, i) => ({ ...it, id: `${Date.now()}-${i}`, qty: 1 })));
      setAnalyzed(true);
      if (result.length === 0) {
        Alert.alert('No food detected', 'Try a clearer, well-lit photo of the meal.');
      }
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateQty(id: string, delta: number) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, qty: Math.max(0.5, Math.round((it.qty + delta) * 2) / 2) } : it,
      ),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function addAll() {
    const now = Date.now();
    items.forEach((it, i) => {
      addEntry({
        id: `${now}-${i}-${Math.random()}`,
        food: {
          id: `ai-${now}-${i}`,
          name: it.name,
          brand: 'AI estimate',
          serving_size: 1,
          serving_unit: 'serving',
          macros: {
            calories: it.calories,
            protein: it.protein,
            carbs: it.carbs,
            fat: it.fat,
            fiber: 0,
            sugar: 0,
          },
        },
        servings: it.qty,
        amount: it.qty,
        unit: 'serving',
        meal,
        timestamp: now,
        date,
      });
    });
    navigation.goBack();
  }

  const totalCals = Math.round(items.reduce((s, it) => s + it.calories * it.qty, 0));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Photo → {MEAL_LABELS[meal]}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

        {!imageUri && (
          <View style={styles.intro}>
            <Text style={styles.introEmoji}>🍽️</Text>
            <Text style={styles.introTitle}>Analyze a meal photo</Text>
            <Text style={styles.introText}>
              Snap or pick a photo of your plate and AI will estimate the foods and
              their macros. Results are estimates — adjust the amounts before adding.
            </Text>
          </View>
        )}

        {!loading && (
          <View style={styles.pickRow}>
            <TouchableOpacity style={styles.pickBtn} onPress={() => pick('camera')} activeOpacity={0.85}>
              <Text style={styles.pickBtnIcon}>📷</Text>
              <Text style={styles.pickBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickBtn} onPress={() => pick('library')} activeOpacity={0.85}>
              <Text style={styles.pickBtnIcon}>🖼️</Text>
              <Text style={styles.pickBtnText}>Choose Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Analyzing your meal…</Text>
          </View>
        )}

        {analyzed && items.length > 0 && (
          <View style={styles.results}>
            <Text style={styles.resultsLabel}>Detected items</Text>
            {items.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  {it.serving ? <Text style={styles.itemServing}>{it.serving}</Text> : null}
                  <Text style={styles.itemMacros}>
                    {Math.round(it.calories * it.qty)} kcal · P{Math.round(it.protein * it.qty)} ·
                    C{Math.round(it.carbs * it.qty)} · F{Math.round(it.fat * it.qty)}
                  </Text>
                </View>
                <View style={styles.qtyControl}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(it.id, -0.5)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{it.qty}×</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(it.id, 0.5)}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeItem(it.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {analyzed && items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{totalCals} kcal</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={addAll} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>
              Add {items.length} {items.length === 1 ? 'item' : 'items'} to {MEAL_LABELS[meal]}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4, width: 60 },
  backText: { fontSize: 16, color: '#10B981', fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 32 },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#E5E7EB',
  },
  intro: { alignItems: 'center', paddingVertical: 24 },
  introEmoji: { fontSize: 48, marginBottom: 12 },
  introTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  introText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  pickRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  pickBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  pickBtnIcon: { fontSize: 28, marginBottom: 6 },
  pickBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280', fontWeight: '500' },
  results: { marginTop: 20 },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemServing: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  itemMacros: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 18, fontWeight: '300', color: '#374151' },
  qtyValue: { fontSize: 13, fontWeight: '600', color: '#111827', minWidth: 28, textAlign: 'center' },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  footer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  addBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
