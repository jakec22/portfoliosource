import React, { useState, useEffect, useMemo } from 'react';
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
import { useSnackbar } from '../store/useSnackbar';
import { searchFoods } from '../data/foods';
import { searchFoodsApi, lookupBarcode } from '../services/foodApi';
import { analyzeLabelPhoto } from '../services/mealPhoto';
import { BarcodeScanner } from '../components/BarcodeScanner';
import Svg, { Rect } from 'react-native-svg';
import { availableUnits, defaultAmount, toMultiplier } from '../utils/serving';
import { KeyboardDoneAccessory, DONE_ACCESSORY_ID } from '../components/KeyboardDoneAccessory';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';
import { radius, space, type } from '../theme/tokens';
import { Icon } from '../components/Icon';

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
function BarcodeIcon({ size = 22, color }: { size?: number; color: string }) {
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

export function LogFoodScreen({ route, navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { meal, date } = route.params;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>(() => searchFoods(''));
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanLoadingText, setScanLoadingText] = useState('Looking up product…');
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
  const restoreSavedMeal = useStore((s) => s.restoreSavedMeal);
  const showSnackbar = useSnackbar((s) => s.show);
  const copyMealFromDate = useStore((s) => s.copyMealFromDate);
  const logs = useStore((s) => s.logs);

  // Foods already logged for this meal today — used for "Save this meal".
  const mealEntries = useMemo(
    () => (logs[date] ?? []).filter((e) => e.meal === meal),
    [logs, date, meal]
  );

  // Every food the user has ever logged, most-recently-eaten first and
  // deduplicated by food id — replaces the old static "All Foods" database
  // dump with something actually personalized to re-add from.
  const historyFoods = useMemo(() => {
    const entries = Object.values(logs).flat().sort((a, b) => b.timestamp - a.timestamp);
    const seen = new Set<string>();
    const foods: Food[] = [];
    for (const e of entries) {
      if (seen.has(e.food.id)) continue;
      seen.add(e.food.id);
      foods.push(e.food);
    }
    return foods;
  }, [logs]);
  const HISTORY_PAGE_SIZE = 20;
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const visibleHistory = useMemo(
    () => historyFoods.slice(0, historyLimit),
    [historyFoods, historyLimit]
  );

  // Previously-logged foods matching the typed query — surfaced ahead of
  // fresh search results so re-adding something you've already eaten doesn't
  // get buried under a generic database match.
  const historyMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return historyFoods.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.brand && f.brand.toLowerCase().includes(q))
    );
  }, [historyFoods, query]);
  const historyMatchIds = useMemo(
    () => new Set(historyMatches.map((f) => f.id)),
    [historyMatches]
  );

  // Debounced live search against USDA (falls back to local foods offline).
  // Custom foods are merged in front of API results when their name matches.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchFoodsApi(query, controller.signal)
        .then((r) => {
          if (active) {
            const q = query.toLowerCase().trim();
            const customMatches = q
              ? customFoods.filter(
                  (f) =>
                    f.name.toLowerCase().includes(q) ||
                    (f.brand && f.brand.toLowerCase().includes(q))
                )
              : customFoods;
            const apiIds = new Set(r.map((f) => f.id));
            setResults([
              ...customMatches.filter((f) => !apiIds.has(f.id)),
              ...r,
            ]);
            setLoading(false);
          }
        })
        .catch(() => {
          /* aborted by a newer query — ignore */
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
      controller.abort();
    };
  }, [query, customFoods]);

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
    setScanLoadingText('Looking up product…');
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

  // Reads exact macros off a photographed Nutrition Facts label — a fallback
  // for when a barcode database's numbers don't match what's actually printed
  // on the package.
  async function handleLabelCaptured(base64: string) {
    setScannerVisible(false);
    setScanLoadingText('Reading nutrition label…');
    setScanLoading(true);
    try {
      const items = await analyzeLabelPhoto(base64);
      const item = items[0];
      if (!item) {
        Alert.alert(
          'Label Not Readable',
          "Couldn't read a Nutrition Facts label in that photo. Try a clearer, well-lit shot with the label filling the frame."
        );
        return;
      }
      const food: Food = {
        id: `label-${Date.now()}`,
        name: item.name,
        brand: 'Scanned label',
        serving_size: item.serving_grams ?? 1,
        serving_unit: item.serving_grams ? 'g' : 'serving',
        macros: {
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
        },
      };
      addRecentFood(food);
      handleSelectFood(food);
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.message ?? 'Please try again.');
    } finally {
      setScanLoading(false);
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
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <View style={styles.backRow}>
              <Icon name="back" size="sm" color={c.primary} />
              <Text style={styles.backText}>Back</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>Add to {MEAL_LABELS[meal]}</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Icon name="search" size="sm" color={c.textFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search foods..."
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              placeholderTextColor={c.textFaint}
            />
            {loading && <ActivityIndicator size="small" color={c.primary} />}
          </View>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => setScannerVisible(true)}
            activeOpacity={0.8}
          >
            <BarcodeIcon size={22} color={c.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={() => navigation.navigate('MealPhoto', { meal, date })}
            activeOpacity={0.8}
          >
            <Icon name="aiEstimate" size="md" color={c.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mealBtn}
            onPress={() => navigation.navigate('BuildMeal', { meal, date })}
            activeOpacity={0.8}
          >
            <Icon name="meal" size="md" color={c.onPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
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
                            onPress={() => {
                              deleteSavedMeal(sm.id);
                              showSnackbar(`Deleted ${sm.name}`, {
                                label: 'Undo',
                                onPress: () => restoreSavedMeal(sm),
                              });
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}
                          >
                            <Icon name="close" size="sm" color={c.textFaint} />
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
                    <Icon name="templates" size="sm" color={c.gray700} />
                    <Text style={styles.shortcutBtnText}>Copy yesterday</Text>
                  </TouchableOpacity>
                  {mealEntries.length > 0 && (
                    <TouchableOpacity
                      style={styles.shortcutBtn}
                      onPress={handleSaveMeal}
                      activeOpacity={0.7}
                    >
                      <Icon name="save" size="sm" color={c.gray700} />
                      <Text style={styles.shortcutBtnText}>Save this meal</Text>
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

                <Text style={styles.allFoodsLabel}>History</Text>
              </View>
            ) : null
          }
          data={
            showShortcuts
              ? visibleHistory
              : [...historyMatches, ...results.filter((f) => !historyMatchIds.has(f.id))]
          }
          renderItem={({ item }) => {
            const isFav = favoriteFoods.some((f) => f.id === item.id);
            const isHistoryMatch = !showShortcuts && historyMatchIds.has(item.id);
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
                  <View style={styles.foodNameRow}>
                    <Text style={styles.foodName}>{item.name}</Text>
                    {isHistoryMatch && (
                      <View style={styles.historyTag}>
                        <Text style={styles.historyTagText}>History</Text>
                      </View>
                    )}
                  </View>
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
                  <Icon
                    name={isFav ? 'favorite' : 'favoriteOff'}
                    size="md"
                    color={isFav ? c.warning : c.textFaint}
                  />
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
                <Text style={styles.emptySubtext}>Searching foods…</Text>
              </View>
            ) : showShortcuts ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nothing logged yet</Text>
                <Text style={styles.emptySubtext}>
                  Foods you log will show up here for quick re-adding
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No foods found</Text>
                <Text style={styles.emptySubtext}>
                  Try a different search term or scan a barcode
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            showShortcuts && historyLimit < historyFoods.length ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
                activeOpacity={0.7}
              >
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
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
                <TouchableOpacity style={styles.servingsBtn} hitSlop={4} onPress={() => adjustAmount(-1)}>
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
                <TouchableOpacity style={styles.servingsBtn} hitSlop={4} onPress={() => adjustAmount(1)}>
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
        onLabelCaptured={handleLabelCaptured}
      />

      {scanLoading && (
        <View style={styles.scanOverlay}>
          <View style={styles.scanOverlayBox}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={styles.scanOverlayText}>{scanLoadingText}</Text>
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
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: c.card,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  backBtn: {
    padding: space.xs,
    width: 60,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  backText: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: c.primary,
  },
  title: {
    ...type.subhead(c),
    color: c.text,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.md,
    marginVertical: space.md,
    gap: space.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: c.card,
    borderRadius: radius.card,
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
    borderRadius: radius.control,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  photoBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: space.sm,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  mealBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.control,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.sm,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
    borderRadius: radius.sheet,
    padding: space.xxl,
    alignItems: 'center',
  },
  scanOverlayText: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    marginTop: space.md,
    color: c.gray700,
  },
  searchInput: {
    ...type.body(c),
    flex: 1,
    color: c.text,
  },
  listContent: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  recentSection: {
    marginBottom: space.xs,
  },
  recentTitle: {
    ...type.overline(c),
    color: c.textFaint,
    marginBottom: space.sm,
    marginLeft: space.xxs,
  },
  recentRow: {
    gap: space.sm,
    paddingBottom: space.xs,
    paddingRight: space.sm,
  },
  recentChip: {
    backgroundColor: c.card,
    borderRadius: radius.control,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: c.border,
  },
  recentChipName: {
    ...type.captionStrong(c),
    color: c.text,
  },
  recentChipCals: {
    ...type.micro(c),
    fontFamily: c.fontBodySemi,
    color: c.primary,
    marginTop: space.xxs,
  },
  allFoodsLabel: {
    ...type.overline(c),
    color: c.textFaint,
    marginTop: space.md,
    marginBottom: space.xs,
    marginLeft: space.xxs,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: space.lg,
    marginTop: space.xs,
  },
  loadMoreText: { ...type.bodyStrong(c), color: c.primary },
  shortcutRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    justifyContent: 'center',
    backgroundColor: c.cardMuted,
    borderRadius: radius.control,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  shortcutBtnText: {
    ...type.captionStrong(c),
    color: c.gray700,
  },
  savedMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  savedMealName: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: c.text,
  },
  savedMealMeta: {
    ...type.caption(c),
    color: c.textFaint,
    marginTop: space.xxs,
  },
  starBtn: {
    paddingHorizontal: space.sm,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  unitRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.lg,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.control,
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
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: c.textMuted,
  },
  unitBtnTextActive: {
    color: c.primary,
  },
  foodItem: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.sm,
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
  foodNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  foodName: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: c.text,
  },
  historyTag: {
    backgroundColor: c.primarySoft,
    borderRadius: radius.hairline,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  historyTagText: {
    ...type.micro(c),
    fontFamily: c.fontBodyBold,
    color: c.primaryDark,
  },
  foodBrand: {
    ...type.caption(c),
    color: c.textFaint,
    marginTop: space.xxs,
  },
  foodServing: {
    ...type.caption(c),
    color: c.textMuted,
    marginTop: space.xs,
  },
  foodItemRight: {
    alignItems: 'flex-end',
    gap: space.xxs,
  },
  foodCals: {
    ...type.bodyStrong(c),
    color: c.text,
  },
  foodMacro: {
    ...type.micro(c),
    color: c.textFaint,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space.xxxl,
  },
  emptyText: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: c.textMuted,
  },
  emptySubtext: {
    ...type.caption(c),
    color: c.textFaint,
    marginTop: space.xs,
  },
  addPanel: {
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: space.xl,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  addPanelHeader: {
    marginBottom: space.md,
  },
  selectedName: {
    ...type.bodyStrong(c),
    color: c.text,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.cardMuted,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.lg,
  },
  previewItem: {
    alignItems: 'center',
  },
  previewValue: {
    ...type.subhead(c),
    color: c.text,
  },
  previewLabel: {
    ...type.micro(c),
    color: c.textFaint,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  servingsLabel: {
    ...type.caption(c),
    color: c.textMuted,
    flex: 1,
  },
  servingsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  servingsBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsBtnText: {
    ...type.heading(c),
    color: c.gray700,
  },
  servingsInput: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.control,
    textAlign: 'center',
    color: c.text,
    backgroundColor: c.input,
  },
  addBtn: {
    backgroundColor: c.primary,
    borderRadius: radius.control,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  addBtnText: {
    ...type.subhead(c),
    color: c.onPrimary,
  },
});
