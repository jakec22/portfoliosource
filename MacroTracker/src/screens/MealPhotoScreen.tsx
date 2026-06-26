import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/useStore';
import { analyzeMealPhoto, analyzeMealText, AnalyzedItem } from '../services/mealPhoto';
import { MealType, ServingUnit, Food } from '../types';
import { availableUnits, defaultAmount, toMultiplier } from '../utils/serving';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

interface ReviewItem extends AnalyzedItem {
  id: string;
  unit: ServingUnit;
  amount: string; // free-type; mirrors the amount field in LogFoodScreen
}

interface Props {
  route: { params: { meal: MealType; date: string } };
  navigation: any;
}

// Build a Food object from an AI-analyzed item so we can reuse the serving
// utilities (toMultiplier, availableUnits, defaultAmount) identically to
// manually-searched foods.
function buildFood(it: ReviewItem | AnalyzedItem): Food {
  const grams = (it as any).serving_grams as number | undefined;
  return {
    id: '',
    name: it.name,
    brand: 'AI estimate',
    // When Gemini returns a gram weight, macros are "per that many grams", so
    // toMultiplier can convert g → multiplier correctly. Without gram data we
    // fall back to serving_size=1 (unitless) and only offer 'serving'.
    serving_size: grams ?? 1,
    serving_unit: grams ? 'g' : 'serving',
    macros: {
      calories: it.calories,
      protein: it.protein,
      carbs: it.carbs,
      fat: it.fat,
      fiber: 0,
      sugar: 0,
    },
  };
}

// Units offered for an AI item — same logic as LogFoodScreen but gated on
// whether we have a gram weight to convert from.
function itemUnits(it: ReviewItem): ServingUnit[] {
  if (!it.serving_grams) return ['serving'];
  return availableUnits(buildFood(it));
}

export function MealPhotoScreen({ route, navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { meal, date } = route.params;
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const addEntry = useStore((s) => s.addEntry);

  async function pick(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        `Please allow ${source === 'camera' ? 'camera' : 'photo'} access in Settings.`,
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

  function runAnalysis(base64: string) {
    analyzeWith(
      () => analyzeMealPhoto(base64),
      'Try a clearer, well-lit photo of the meal.',
    );
  }

  async function runDescription() {
    const text = description.trim();
    if (text.length < 3) {
      Alert.alert('Describe your meal', 'Type what you ate and roughly how much.');
      return;
    }
    setImageUri(null); // text path has no photo to preview
    analyzeWith(
      () => analyzeMealText(text),
      'Try describing the foods and amounts more specifically.',
    );
  }

  // Shared analysis runner: takes a function that produces analyzed items and a
  // message to show if nothing comes back.
  async function analyzeWith(
    fn: () => Promise<AnalyzedItem[]>,
    emptyMessage: string,
  ) {
    setLoading(true);
    setAnalyzed(false);
    setItems([]);
    setExpandedId(null);
    try {
      const result = await fn();
      setItems(
        result.map((it, i) => ({
          ...it,
          id: `${Date.now()}-${i}`,
          unit: 'serving',
          amount: '1',
        })),
      );
      setAnalyzed(true);
      if (result.length === 0) {
        Alert.alert('No food detected', emptyMessage);
      }
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleUnitChange(id: string, newUnit: ServingUnit) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const food = buildFood(it);
        return { ...it, unit: newUnit, amount: String(defaultAmount(food, newUnit)) };
      }),
    );
  }

  function adjustAmount(id: string, delta: number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const food = buildFood(it);
        const step =
          it.unit === 'serving'
            ? 0.5
            : Math.max(1, Math.round(defaultAmount(food, it.unit) * 0.25));
        const next =
          Math.max(step, Math.round(((parseFloat(it.amount) || 0) + delta * step) * 10) / 10);
        return { ...it, amount: String(next) };
      }),
    );
  }

  function setAmount(id: string, value: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, amount: value } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function addAll() {
    const now = Date.now();
    let added = 0;
    items.forEach((it, i) => {
      const food = buildFood(it);
      food.id = `ai-${now}-${i}`;
      const multiplier = toMultiplier(food, parseFloat(it.amount) || 0, it.unit);
      if (multiplier <= 0) return;
      addEntry({
        id: `${now}-${i}-${Math.random()}`,
        food,
        servings: multiplier,
        amount: parseFloat(it.amount),
        unit: it.unit,
        meal,
        timestamp: now,
        date,
      });
      added++;
    });
    if (added === 0) {
      Alert.alert('Nothing to add', 'Enter a valid amount for at least one item.');
      return;
    }
    navigation.goBack();
  }

  // Running total at current user-chosen amounts.
  const totalCals = Math.round(
    items.reduce((s, it) => {
      const food = buildFood(it);
      const m = toMultiplier(food, parseFloat(it.amount) || 0, it.unit);
      return s + it.calories * m;
    }, 0),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Photo → {MEAL_LABELS[meal]}</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

          {!imageUri && !analyzed && (
            <View style={styles.intro}>
              <Text style={styles.introEmoji}>✨</Text>
              <Text style={styles.introTitle}>Analyze a meal</Text>
              <Text style={styles.introText}>
                Snap or pick a photo of your plate, or describe what you ate, and AI
                will estimate the foods and their macros. Tap any item to adjust its
                serving size before logging.
              </Text>
            </View>
          )}

          {!loading && (
            <>
              <View style={styles.pickRow}>
                <TouchableOpacity
                  style={styles.pickBtn}
                  onPress={() => pick('camera')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pickBtnIcon}>📷</Text>
                  <Text style={styles.pickBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pickBtn}
                  onPress={() => pick('library')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pickBtnIcon}>🖼️</Text>
                  <Text style={styles.pickBtnText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>

              {/* Or describe the meal in words */}
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or describe it</Text>
                <View style={styles.orLine} />
              </View>

              <View style={styles.describeBox}>
                <TextInput
                  style={styles.describeInput}
                  placeholder="e.g. 2 scrambled eggs, a slice of buttered toast, and a banana"
                  placeholderTextColor={c.textFaint}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[
                    styles.describeBtn,
                    description.trim().length < 3 && styles.describeBtnDisabled,
                  ]}
                  onPress={runDescription}
                  disabled={description.trim().length < 3}
                  activeOpacity={0.85}
                >
                  <Text style={styles.describeBtnText}>✨ Calculate macros</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={styles.loadingText}>Analyzing your meal…</Text>
            </View>
          )}

          {analyzed && items.length > 0 && (
            <View style={styles.results}>
              <Text style={styles.resultsLabel}>
                Detected items · tap to adjust serving
              </Text>

              {items.map((it) => {
                const food = buildFood(it);
                const multiplier = toMultiplier(food, parseFloat(it.amount) || 0, it.unit);
                const preview = {
                  calories: Math.round(it.calories * multiplier),
                  protein: Math.round(it.protein * multiplier),
                  carbs: Math.round(it.carbs * multiplier),
                  fat: Math.round(it.fat * multiplier),
                };
                const units = itemUnits(it);
                const isExpanded = expandedId === it.id;

                return (
                  <View key={it.id} style={[styles.itemCard, isExpanded && styles.itemCardExpanded]}>
                    {/* Always-visible summary row */}
                    <TouchableOpacity
                      style={styles.itemSummary}
                      onPress={() => toggleExpand(it.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.itemLeft}>
                        <Text style={styles.itemName}>{it.name}</Text>
                        {it.serving ? (
                          <Text style={styles.itemServing}>
                            AI estimate: {it.serving}
                          </Text>
                        ) : null}
                        <Text style={styles.itemMacros}>
                          {preview.calories} kcal · P{preview.protein} ·
                          C{preview.carbs} · F{preview.fat}
                        </Text>
                      </View>
                      <View style={styles.itemRight}>
                        <Text style={styles.amountBadge}>
                          {it.amount}
                          {it.unit === 'serving' ? '×' : ` ${it.unit}`}
                        </Text>
                        <Text style={styles.chevron}>{isExpanded ? '↑' : '↓'}</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Expanded editor */}
                    {isExpanded && (
                      <View style={styles.editor}>
                        <View style={styles.divider} />

                        {/* Unit selector */}
                        {units.length > 1 && (
                          <View style={styles.unitRow}>
                            {units.map((u) => (
                              <TouchableOpacity
                                key={u}
                                style={[styles.unitBtn, it.unit === u && styles.unitBtnActive]}
                                onPress={() => handleUnitChange(it.id, u)}
                              >
                                <Text
                                  style={[
                                    styles.unitBtnText,
                                    it.unit === u && styles.unitBtnTextActive,
                                  ]}
                                >
                                  {u === 'serving' ? 'Serving' : u}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        {/* Amount row */}
                        <View style={styles.amountRow}>
                          <Text style={styles.amountLabel}>
                            {it.unit === 'serving'
                              ? 'Servings (1 = AI estimated portion)'
                              : `Amount in ${it.unit}`}
                          </Text>
                          <View style={styles.amountControl}>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => adjustAmount(it.id, -1)}
                            >
                              <Text style={styles.stepBtnText}>−</Text>
                            </TouchableOpacity>
                            <TextInput
                              style={styles.amountInput}
                              value={it.amount}
                              onChangeText={(v) => setAmount(it.id, v)}
                              keyboardType="decimal-pad"
                              selectTextOnFocus
                            />
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() => adjustAmount(it.id, 1)}
                            >
                              <Text style={styles.stepBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Live macro preview */}
                        <View style={styles.previewRow}>
                          <MacroStat label="kcal" value={preview.calories} color={c.text} />
                          <MacroStat label="protein" value={preview.protein} color="#3B82F6" unit="g" />
                          <MacroStat label="carbs" value={preview.carbs} color="#F59E0B" unit="g" />
                          <MacroStat label="fat" value={preview.fat} color="#EF4444" unit="g" />
                        </View>

                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => removeItem(it.id)}
                        >
                          <Text style={styles.removeBtnText}>Remove item</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MacroStat({
  label,
  value,
  color,
  unit = '',
}: {
  label: string;
  value: number;
  color: string;
  unit?: string;
}) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.macroStat}>
      <Text style={[styles.macroStatValue, { color }]}>
        {value}{unit}
      </Text>
      <Text style={styles.macroStatLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: c.card,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: { padding: 4, width: 60 },
  backText: { fontSize: 16, color: c.primary, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: c.text },
  content: { padding: 16, paddingBottom: 32 },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: c.cardMuted,
  },
  intro: { alignItems: 'center', paddingVertical: 24 },
  introEmoji: { fontSize: 48, marginBottom: 12 },
  introTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 },
  introText: {
    fontSize: 14,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  pickRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  pickBtn: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  pickBtnIcon: { fontSize: 28, marginBottom: 6 },
  pickBtnText: { fontSize: 14, fontWeight: '600', color: c.gray700 },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: c.border },
  orText: { fontSize: 12, fontWeight: '600', color: c.textFaint, textTransform: 'uppercase', letterSpacing: 0.6 },
  describeBox: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  describeInput: {
    minHeight: 72,
    fontSize: 15,
    color: c.text,
    lineHeight: 21,
    marginBottom: 12,
  },
  describeBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  describeBtnDisabled: { backgroundColor: c.borderStrong },
  describeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14, color: c.textMuted, fontWeight: '500' },

  results: { marginTop: 20 },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  // Item card
  itemCard: {
    backgroundColor: c.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  itemCardExpanded: {
    borderColor: c.primary,
  },
  itemSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: c.text },
  itemServing: { fontSize: 12, color: c.textFaint, marginTop: 2 },
  itemMacros: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  itemRight: { alignItems: 'flex-end', gap: 4, marginLeft: 12 },
  amountBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: c.primary,
    backgroundColor: c.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chevron: { fontSize: 14, color: c.textFaint, fontWeight: '600' },

  // Expanded editor
  editor: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: c.border, marginBottom: 14 },
  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  unitBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  unitBtnActive: { backgroundColor: c.primarySoft, borderColor: c.primary },
  unitBtnText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
  unitBtnTextActive: { color: c.primary },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  amountLabel: { fontSize: 13, color: c.textMuted, flex: 1 },
  amountControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, fontWeight: '300', color: c.gray700 },
  amountInput: {
    width: 64,
    height: 34,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    backgroundColor: c.input,
  },
  previewRow: {
    flexDirection: 'row',
    backgroundColor: c.cardMuted,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    justifyContent: 'space-around',
  },
  macroStat: { alignItems: 'center' },
  macroStatValue: { fontSize: 16, fontWeight: '700' },
  macroStatLabel: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  removeBtn: { alignItems: 'center', paddingVertical: 6 },
  removeBtnText: { fontSize: 13, fontWeight: '600', color: c.danger },

  // Footer
  footer: {
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: c.shadow,
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
  totalLabel: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: '700', color: c.text },
  addBtn: {
    backgroundColor: c.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
});
