import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Food, MealType, SavedMeal, ServingUnit } from '../types';
import { useStore } from '../store/useStore';
import { lookupBarcode } from '../services/foodApi';
import { analyzeMealText, AnalyzedItem } from '../services/mealPhoto';
import { BarcodeScanner } from '../components/BarcodeScanner';
import Svg, { Rect } from 'react-native-svg';
import { availableUnits, defaultAmount, toMultiplier } from '../utils/serving';
import { KeyboardDoneAccessory, DONE_ACCESSORY_ID } from '../components/KeyboardDoneAccessory';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

interface Props {
  route: { params: { meal: MealType; date: string } };
  navigation: any;
}

// Simple barcode icon drawn with react-native-svg (already a project dep).
// 7 alternating narrow/wide bars to suggest a barcode at small sizes.
function BarcodeIcon({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  const h = size;
  const bars = [2, 1, 3, 1, 2, 1, 3, 1, 2];
  let x = 0;
  const totalW = bars.reduce((a, b) => a + b, 0) + bars.length - 1;
  const scale = size / totalW;
  return (
    <Svg width={size} height={h} viewBox={`0 0 ${totalW} ${h}`}>
      {bars.map((w, i) => {
        const rx = x;
        x += w + 1;
        return i % 2 === 0 ? (
          <Rect key={i} x={rx} y={0} width={w} height={h} fill={color} />
        ) : null;
      })}
    </Svg>
  );
}

// Convert an AI-estimated item into a Food so it flows through the existing
// select → adjust serving → add panel exactly like any other food. When Gemini
// returns a gram weight, macros are "per that many grams" (so g/oz conversion
// works); otherwise the item is a unitless single serving.
function aiItemToFood(it: AnalyzedItem, idx: number): Food {
  const grams = it.serving_grams;
  return {
    id: `ai-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    name: it.name,
    brand: 'AI estimate',
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

export function LogFoodScreen({ route, navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { meal, date } = route.params;
  const [query, setQuery] = useState('');
  const [aiResults, setAiResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [unit, setUnit] = useState<ServingUnit>('serving');
  const [amount, setAmount] = useState('1');
  const addEntry = useStore((s) => s.addEntry);
  const addRecentFood = useStore((s) => s.addRecentFood);
  const recentFoods = useStore((s) => s.recentFoods);
  const favoriteFoods = useStore((s) => s.favoriteFoods);
  const customFoods = useStore((s) => s.customFoods);
  const savedMeals = useStore((s) => s.savedMeals);
  const toggleFavoriteFood = useStore((s) => s.toggleFavoriteFood);
  const saveMealToStore = useStore((s) => s.saveMeal);
  const deleteSavedMeal = useStore((s) => s.deleteSavedMeal);
  const copyMealFromDate = useStore((s) => s.copyMealFromDate);
  const logs = useStore((s) => s.logs);

  // Foods already logged for this meal today — used for "Save this meal".
  const mealEntries = useMemo(
    () => (logs[date] ?? []).filter((e) => e.meal === meal),
    [logs, date, meal]
  );

  // Custom foods are filtered locally and instantly — they're exact user data,
  // so they don't need (or want) an AI estimate.
  const q = query.trim().toLowerCase();
  const customMatches = useMemo(
    () =>
      q
        ? customFoods.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              (f.brand && f.brand.toLowerCase().includes(q))
          )
        : [],
    [q, customFoods]
  );

  // Your custom foods first, then anything the AI returned for this query.
  const results = useMemo(() => {
    const ids = new Set(customMatches.map((f) => f.id));
    return [...customMatches, ...aiResults.filter((f) => !ids.has(f.id))];
  }, [customMatches, aiResults]);

  function handleQueryChange(v: string) {
    setQuery(v);
    // Typing invalidates the previous AI estimate.
    setAiResults([]);
    setSearched(false);
  }

  // Send the typed description to the AI for a macro estimate. Explicit (a tap
  // or keyboard "search"), so it's bounded and intentional rather than firing
  // on every keystroke.
  async function runAiSearch() {
    const text = query.trim();
    if (text.length < 2) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(false);
    try {
      const items = await analyzeMealText(text);
      setAiResults(items.map(aiItemToFood));
      setSearched(true);
    } catch (e: any) {
      Alert.alert('AI estimate failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectFood(food: Food) {
    // Dismiss the search keyboard first so the amount field opens its own
    // fresh decimal-pad — this ensures the Done accessory bar connects properly.
    Keyboard.dismiss();
    setSelectedFood(food);
    setUnit('serving');
    setAmount('1');
  }

  function handleUnitChange(food: Food, newUnit: ServingUnit) {
    setUnit(newUnit);
    setAmount(String(defaultAmount(food, newUnit)));
  }

  function adjustAmount(delta: number) {
    if (!selectedFood) return;
    // Step by ~1 serving's worth in the current unit, min one step.
    const step = unit === 'serving' ? 0.5 : Math.max(1, Math.round(defaultAmount(selectedFood, unit) * 0.25));
    const next = Math.max(step, Math.round(((parseFloat(amount) || 0) + delta * step) * 10) / 10);
    setAmount(String(next));
  }

  async function handleBarcodeScanned(barcode: string) {
    setScannerVisible(false);
    setScanLoading(true);
    const food = await lookupBarcode(barcode);
    setScanLoading(false);
    if (food) {
      addRecentFood(food); // remember scanned products even before logging
      handleSelectFood(food);
    } else {
      Alert.alert(
        'Product Not Found',
        `No nutrition data found for barcode ${barcode}. Try searching by name instead.`
      );
    }
  }

  const multiplier = selectedFood
    ? toMultiplier(selectedFood, parseFloat(amount) || 0, unit)
    : 0;

  function handleAdd() {
    if (!selectedFood) return;
    if (multiplier <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    addEntry({
      id: `${Date.now()}-${Math.random()}`,
      food: selectedFood,
      servings: multiplier,
      amount: parseFloat(amount),
      unit,
      meal,
      timestamp: Date.now(),
      date,
    });
    navigation.goBack();
  }

  const preview = selectedFood
    ? {
        calories: Math.round(selectedFood.macros.calories * multiplier),
        protein: Math.round(selectedFood.macros.protein * multiplier),
        carbs: Math.round(selectedFood.macros.carbs * multiplier),
        fat: Math.round(selectedFood.macros.fat * multiplier),
      }
    : null;

  const showShortcuts = query.trim() === '';

  function prevDay(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  function handleCopyYesterday() {
    const count = copyMealFromDate(prevDay(date), date, meal);
    if (count === 0) {
      Alert.alert(
        'Nothing to copy',
        `No ${MEAL_LABELS[meal].toLowerCase()} was logged yesterday.`
      );
    } else {
      navigation.goBack();
    }
  }

  function handleSaveMeal() {
    if (mealEntries.length === 0) return;
    Alert.prompt(
      'Save Meal',
      `Name this ${MEAL_LABELS[meal].toLowerCase()} for quick re-logging:`,
      (name) => {
        if (!name?.trim()) return;
        saveMealToStore({
          id: `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: name.trim(),
          items: mealEntries.map((e) => ({ food: e.food, servings: e.servings })),
          createdAt: Date.now(),
        });
      },
      'plain-text'
    );
  }

  function handleLogSavedMeal(sm: SavedMeal) {
    const now = Date.now();
    for (const item of sm.items) {
      addEntry({
        id: `${now}-${Math.random()}`,
        food: item.food,
        servings: item.servings,
        meal,
        timestamp: now,
        date,
      });
    }
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add to {MEAL_LABELS[meal]}</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>✨</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Describe a food, e.g. 6 oz grilled chicken"
              value={query}
              onChangeText={handleQueryChange}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              placeholderTextColor={c.textFaint}
              returnKeyType="search"
              onSubmitEditing={runAiSearch}
            />
          </View>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => setScannerVisible(true)}
            activeOpacity={0.8}
          >
            <BarcodeIcon size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={() => navigation.navigate('MealPhoto', { meal, date })}
            activeOpacity={0.8}
          >
            <Text style={styles.scanBtnIcon}>✨</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mealBtn}
            onPress={() => navigation.navigate('BuildMeal', { meal, date })}
            activeOpacity={0.8}
          >
            <Text style={styles.scanBtnIcon}>🍽️</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={results}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            showShortcuts ? (
              <View style={styles.recentSection}>
                {/* Favorites */}
                {favoriteFoods.length > 0 && (
                  <>
                    <Text style={styles.recentTitle}>Favorites</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.recentRow}
                    >
                      {favoriteFoods.map((f) => (
                        <TouchableOpacity
                          key={f.id}
                          style={styles.recentChip}
                          onPress={() => handleSelectFood(f)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.recentChipName} numberOfLines={1}>
                            {f.name}
                          </Text>
                          <Text style={styles.recentChipCals}>
                            {f.macros.calories} kcal
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Saved meals */}
                {savedMeals.length > 0 && (
                  <>
                    <Text style={styles.recentTitle}>Saved Meals</Text>
                    {savedMeals.map((sm) => {
                      const totalCal = Math.round(
                        sm.items.reduce(
                          (s, i) => s + i.food.macros.calories * i.servings,
                          0
                        )
                      );
                      return (
                        <TouchableOpacity
                          key={sm.id}
                          style={styles.savedMealRow}
                          onPress={() => handleLogSavedMeal(sm)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.savedMealName}>{sm.name}</Text>
                            <Text style={styles.savedMealMeta}>
                              {sm.items.length} item{sm.items.length === 1 ? '' : 's'}{' '}
                              · {totalCal} kcal
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => deleteSavedMeal(sm.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}
                          >
                            <Text style={styles.savedMealDelete}>✕</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}

                {/* Shortcut buttons */}
                <View style={styles.shortcutRow}>
                  <TouchableOpacity
                    style={styles.shortcutBtn}
                    onPress={handleCopyYesterday}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.shortcutBtnText}>📋  Copy yesterday</Text>
                  </TouchableOpacity>
                  {mealEntries.length > 0 && (
                    <TouchableOpacity
                      style={styles.shortcutBtn}
                      onPress={handleSaveMeal}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.shortcutBtnText}>💾  Save this meal</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Recents */}
                {recentFoods.length > 0 && (
                  <>
                    <Text style={styles.recentTitle}>Recent</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.recentRow}
                    >
                      {recentFoods.map((f) => (
                        <TouchableOpacity
                          key={f.id}
                          style={styles.recentChip}
                          onPress={() => handleSelectFood(f)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.recentChipName} numberOfLines={1}>
                            {f.name}
                          </Text>
                          <Text style={styles.recentChipCals}>
                            {f.macros.calories} kcal
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

              </View>
            ) : (
              <View style={styles.aiHeader}>
                <TouchableOpacity
                  style={[styles.aiCta, loading && styles.aiCtaDisabled]}
                  onPress={runAiSearch}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.aiCtaText} numberOfLines={1}>
                      ✨  Estimate "{query.trim()}" with AI
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.aiHint}>
                  Include the amount for a sharper estimate — "1 cup", "200g", "2 slices".
                </Text>
                {customMatches.length > 0 && (
                  <Text style={styles.allFoodsLabel}>Your custom foods</Text>
                )}
              </View>
            )
          }
          renderItem={({ item }) => {
            const isFav = favoriteFoods.some((f) => f.id === item.id);
            return (
              <TouchableOpacity
                style={[
                  styles.foodItem,
                  selectedFood?.id === item.id && styles.foodItemSelected,
                ]}
                onPress={() => handleSelectFood(item)}
                activeOpacity={0.7}
              >
                <View style={styles.foodItemLeft}>
                  <Text style={styles.foodName}>{item.name}</Text>
                  {item.brand && (
                    <Text style={styles.foodBrand}>{item.brand}</Text>
                  )}
                  <Text style={styles.foodServing}>
                    per {item.serving_size}{item.serving_unit}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.starBtn}
                  onPress={() => toggleFavoriteFood(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                >
                  <Text style={[styles.starBtnText, isFav && styles.starBtnActive]}>
                    {isFav ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.foodItemRight}>
                  <Text style={styles.foodCals}>
                    {item.macros.calories} kcal
                  </Text>
                  <Text style={styles.foodMacro}>
                    P {item.macros.protein}g
                  </Text>
                  <Text style={styles.foodMacro}>
                    C {item.macros.carbs}g
                  </Text>
                  <Text style={styles.foodMacro}>
                    F {item.macros.fat}g
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator color={c.primary} />
                <Text style={styles.emptySubtext}>Estimating macros…</Text>
              </View>
            ) : query.trim() !== '' && searched ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No foods recognized</Text>
                <Text style={styles.emptySubtext}>
                  Try describing the food and amount differently, or scan a barcode.
                </Text>
              </View>
            ) : null
          }
        />

        {selectedFood && (
          <View style={styles.addPanel}>
            <View style={styles.addPanelHeader}>
              <Text style={styles.selectedName} numberOfLines={1}>
                {selectedFood.name}
              </Text>
            </View>

            {preview && (
              <View style={styles.previewRow}>
                <View style={styles.previewItem}>
                  <Text style={styles.previewValue}>{preview.calories}</Text>
                  <Text style={styles.previewLabel}>kcal</Text>
                </View>
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: c.info }]}>
                    {preview.protein}g
                  </Text>
                  <Text style={styles.previewLabel}>protein</Text>
                </View>
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: c.warning }]}>
                    {preview.carbs}g
                  </Text>
                  <Text style={styles.previewLabel}>carbs</Text>
                </View>
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: c.danger }]}>
                    {preview.fat}g
                  </Text>
                  <Text style={styles.previewLabel}>fat</Text>
                </View>
              </View>
            )}

            {/* Unit selector */}
            <View style={styles.unitRow}>
              {availableUnits(selectedFood).map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
                  onPress={() => handleUnitChange(selectedFood, u)}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
                    {u === 'serving' ? 'Serving' : u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount stepper */}
            <View style={styles.servingsRow}>
              <Text style={styles.servingsLabel}>
                {unit === 'serving'
                  ? `Amount (${selectedFood.serving_size}${selectedFood.serving_unit} each)`
                  : `Amount in ${unit}`}
              </Text>
              <View style={styles.servingsControl}>
                <TouchableOpacity style={styles.servingsBtn} onPress={() => adjustAmount(-1)}>
                  <Text style={styles.servingsBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.servingsInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  inputAccessoryViewID={DONE_ACCESSORY_ID}
                  selectTextOnFocus
                />
                <TouchableOpacity style={styles.servingsBtn} onPress={() => adjustAmount(1)}>
                  <Text style={styles.servingsBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
              <Text style={styles.addBtnText}>Add to {MEAL_LABELS[meal]}</Text>
            </TouchableOpacity>
          </View>
        )}
        <KeyboardDoneAccessory />
      </KeyboardAvoidingView>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
      />

      {scanLoading && (
        <View style={styles.scanOverlay}>
          <View style={styles.scanOverlayBox}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={styles.scanOverlayText}>Looking up product…</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.bg,
  },
  flex: {
    flex: 1,
  },
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
  backBtn: {
    padding: 4,
    width: 60,
  },
  backText: {
    fontSize: 16,
    color: c.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 12,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: c.card,
    borderRadius: 14,
    height: 46,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  scanBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  photoBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  mealBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scanBtnIcon: {
    fontSize: 22,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanOverlayBox: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  scanOverlayText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: c.gray700,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: c.text,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  recentSection: {
    marginBottom: 4,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 2,
  },
  recentRow: {
    gap: 8,
    paddingBottom: 4,
    paddingRight: 8,
  },
  recentChip: {
    backgroundColor: c.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: c.border,
  },
  recentChipName: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
  },
  recentChipCals: {
    fontSize: 11,
    color: c.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  allFoodsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 2,
  },
  aiHeader: {
    marginBottom: 4,
  },
  aiCta: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  aiCtaDisabled: {
    opacity: 0.7,
  },
  aiCtaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  aiHint: {
    fontSize: 12,
    color: c.textFaint,
    marginTop: 8,
    marginBottom: 4,
    marginLeft: 2,
    lineHeight: 16,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: c.cardMuted,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  shortcutBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.gray700,
  },
  savedMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  savedMealName: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text,
  },
  savedMealMeta: {
    fontSize: 12,
    color: c.textFaint,
    marginTop: 2,
  },
  savedMealDelete: {
    fontSize: 15,
    color: c.textFaint,
    paddingLeft: 12,
    fontWeight: '600',
  },
  starBtn: {
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  starBtnText: {
    fontSize: 20,
    color: c.textFaint,
  },
  starBtnActive: {
    color: c.warning,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  unitBtnActive: {
    backgroundColor: c.primarySoft,
    borderColor: c.primary,
  },
  unitBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textMuted,
  },
  unitBtnTextActive: {
    color: c.primary,
  },
  foodItem: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  foodItemSelected: {
    borderWidth: 2,
    borderColor: c.primary,
  },
  foodItemLeft: {
    flex: 1,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
  },
  foodBrand: {
    fontSize: 12,
    color: c.textFaint,
    marginTop: 2,
  },
  foodServing: {
    fontSize: 12,
    color: c.textMuted,
    marginTop: 4,
  },
  foodItemRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  foodCals: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
  },
  foodMacro: {
    fontSize: 11,
    color: c.textFaint,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: c.textMuted,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    color: c.textFaint,
    marginTop: 4,
  },
  addPanel: {
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
  addPanelHeader: {
    marginBottom: 12,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.cardMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  previewItem: {
    alignItems: 'center',
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
  },
  previewLabel: {
    fontSize: 11,
    color: c.textFaint,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  servingsLabel: {
    fontSize: 13,
    color: c.textMuted,
    flex: 1,
  },
  servingsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  servingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsBtnText: {
    fontSize: 20,
    fontWeight: '300',
    color: c.gray700,
  },
  servingsInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: c.text,
    backgroundColor: c.input,
  },
  addBtn: {
    backgroundColor: c.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: {
    color: c.onPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
});
