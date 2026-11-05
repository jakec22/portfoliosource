import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActionSheetIOS,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Food, MealType, SavedMeal, ServingUnit } from '../types';
import { useStore } from '../store/useStore';
import { useSnackbar } from '../store/useSnackbar';
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

// The merged list carries two row shapes: a saved meal (multi-item) and a
// single food. They share one list because they are the same answer to the
// same question — something you've had before — and splitting them into
// sections is what made this screen a search for the search.
type Row = { kind: 'meal'; meal: SavedMeal } | { kind: 'food'; food: Food };

// analyzeMealText needs something to work with; below this the AI row would
// only produce a shrug.
const MIN_AI_CHARS = 3;

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
  // Search results only — empty until something is typed. This used to be
  // seeded with the whole 25-item curated list, which never showed while the
  // field was empty (the list renders history then) but *was* still sitting in
  // state the instant you typed: for the debounce plus the round trip you got
  // all 25 generic foods, unfiltered, under your query. That stale dump is the
  // "default food list" problem.
  const [results, setResults] = useState<Food[]>([]);
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

  // One list, not three.
  //
  // Favorites, Recent and History were three separate sections — two chip
  // strips and a card list — holding the same kind of thing: a food you've
  // had before. Three shapes for one concept pushed the actual list below the
  // fold and gave the eye three places to look before it found a food. They
  // are now one ordered list: starred first (the star is already on every row,
  // so it does the sorting), then recently handled, then everything else by
  // recency. Nothing the three sections showed is lost — `recentFoods` carries
  // scanned-but-not-yet-logged products, which never reach `logs`.
  const yourFoods = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    for (const list of [favoriteFoods, recentFoods, historyFoods]) {
      for (const f of list) {
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        out.push(f);
      }
    }
    return out;
  }, [favoriteFoods, recentFoods, historyFoods]);

  const PAGE_SIZE = 20;
  const [listLimit, setListLimit] = useState(PAGE_SIZE);

  // Foods you already have matching the typed query — surfaced ahead of fresh
  // search results so re-adding something you've eaten doesn't get buried
  // under a generic database match.
  const yourMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return yourFoods.filter(
      (f) => f.name.toLowerCase().includes(q) || (f.brand && f.brand.toLowerCase().includes(q))
    );
  }, [yourFoods, query]);
  const yourMatchIds = useMemo(
    () => new Set(yourMatches.map((f) => f.id)),
    [yourMatches]
  );

  // Saved meals sit at the top of the same list rather than in a section of
  // their own, and filter with it. They are multi-item, so they keep their own
  // row shape — but they are still "something you've had before", which is
  // what this list is.
  const matchingSavedMeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedMeals;
    return savedMeals.filter((m) => m.name.toLowerCase().includes(q));
  }, [savedMeals, query]);

  // Debounced live search against USDA (falls back to local foods offline).
  // Custom foods are merged in front of API results when their name matches.
  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchFoodsApi(query, controller.signal)
        .then((r) => {
          if (active) {
            const customMatches = customFoods.filter(
              (f) =>
                f.name.toLowerCase().includes(q) ||
                (f.brand && f.brand.toLowerCase().includes(q))
            );
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

  const searching = query.trim() !== '';

  // The one list, in display order: saved meals, then your foods. In search
  // mode the same list filters, with fresh database results appended behind
  // what you already have.
  const rows = useMemo<Row[]>(() => {
    const meals: Row[] = matchingSavedMeals.map((m) => ({ kind: 'meal', meal: m }));
    const foods = searching
      ? [...yourMatches, ...results.filter((f) => !yourMatchIds.has(f.id))]
      : yourFoods.slice(0, listLimit);
    return [...meals, ...foods.map((f): Row => ({ kind: 'food', food: f }))];
  }, [matchingSavedMeals, searching, yourMatches, yourMatchIds, results, yourFoods, listLimit]);

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

  // Meal-level actions — build a multi-item meal, copy yesterday's, save this
  // one — are things you do to the meal, not ways to find a food. As three
  // always-visible controls they competed with the list for the same glance;
  // behind one header button they cost nothing until you want them.
  function handleMoreActions() {
    const actions: { label: string; run: () => void }[] = [
      { label: 'Build a meal', run: () => navigation.navigate('BuildMeal', { meal, date }) },
      { label: 'Copy yesterday', run: handleCopyYesterday },
    ];
    if (mealEntries.length > 0) {
      actions.push({ label: 'Save this meal', run: handleSaveMeal });
    }
    const labels = actions.map((a) => a.label);
    // ActionSheetIOS is iOS-only; Android gets the equivalent alert, as
    // elsewhere in the app.
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: MEAL_LABELS[meal], options: ['Cancel', ...labels], cancelButtonIndex: 0 },
        (index) => {
          if (index > 0) actions[index - 1].run();
        }
      );
    } else {
      Alert.alert(MEAL_LABELS[meal], undefined, [
        ...actions.map((a) => ({ text: a.label, onPress: a.run })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
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
          <TouchableOpacity
            onPress={handleMoreActions}
            style={[styles.backBtn, styles.moreBtn]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="more" size="lg" color={c.primary} />
          </TouchableOpacity>
        </View>

        {/* The field is the only thing above the list.
            It takes a search term *or* a description — typing "2 eggs and
            sourdough toast" used to be a dead end, because the field could
            only match a database, and the AI route was a separate button you
            had to notice before you started typing. Now the typing is the
            route: the AI row below offers to estimate whatever is in here.
            Barcode sits inside the field because it is the one capture method
            that can't start from text. */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Icon name="search" size="sm" color={c.textFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search or describe what you ate"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              placeholderTextColor={c.textFaint}
            />
            {loading && <ActivityIndicator size="small" color={c.primary} />}
          </View>
        </View>

        {/* The two routes where the machine does the reading sit in the same
            slot, one at a time, so the eye only ever learns one place: scan
            when the field is empty, estimate once you've typed something for
            it to estimate. They share a treatment because they are the same
            kind of offer — don't look this up yourself. */}
        {!searching && (
          <TouchableOpacity
            style={[styles.offerRow, styles.offerRowStandalone]}
            onPress={() => setScannerVisible(true)}
            activeOpacity={0.8}
          >
            <BarcodeIcon size={24} color={c.primary} />
            <View style={styles.offerText}>
              <Text style={styles.offerTitle}>Scan barcode or label</Text>
              <Text style={styles.offerSub} numberOfLines={1}>
                Exact macros off the package
              </Text>
            </View>
            <Icon name="forward" size="md" color={c.primary} />
          </TouchableOpacity>
        )}

        <FlatList
          keyExtractor={(r) => (r.kind === 'meal' ? `m:${r.meal.id}` : `f:${r.food.id}`)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {/* Typing is the AI route. The estimate offer sits at the head of
                  the results rather than in a button above them, so the thing
                  you just typed is what it acts on. */}
              {searching && query.trim().length >= MIN_AI_CHARS && (
                <TouchableOpacity
                  style={styles.offerRow}
                  onPress={() =>
                    navigation.navigate('MealPhoto', {
                      meal,
                      date,
                      description: query.trim(),
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Icon name="aiEstimate" size="lg" color={c.primary} />
                  <View style={styles.offerText}>
                    <Text style={styles.offerTitle}>Estimate with AI</Text>
                    <Text style={styles.offerSub} numberOfLines={1}>
                      “{query.trim()}”
                    </Text>
                  </View>
                  <Icon name="forward" size="md" color={c.primary} />
                </TouchableOpacity>
              )}
              {rows.length > 0 && (
                <Text style={styles.listLabel}>
                  {searching ? 'Results' : 'Your foods'}
                </Text>
              )}
            </>
          }
          data={rows}
          renderItem={({ item: row }) => {
            if (row.kind === 'meal') {
              const sm = row.meal;
              const totalCal = Math.round(
                sm.items.reduce((s, i) => s + i.food.macros.calories * i.servings, 0)
              );
              return (
                <TouchableOpacity
                  style={styles.savedMealRow}
                  onPress={() => handleLogSavedMeal(sm)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.foodNameRow}>
                      <Text style={styles.savedMealName}>{sm.name}</Text>
                      <View style={styles.mealTag}>
                        <Text style={styles.mealTagText}>Meal</Text>
                      </View>
                    </View>
                    <Text style={styles.savedMealMeta}>
                      {sm.items.length} item{sm.items.length === 1 ? '' : 's'} · {totalCal} kcal
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
            }

            const item = row.food;
            const isFav = favoriteFoods.some((f) => f.id === item.id);
            // Only worth tagging while searching: in the idle list every row
            // is already one of yours, so the tag would be on all of them.
            const isYours = searching && yourMatchIds.has(item.id);
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
                    {isYours && (
                      <View style={styles.historyTag}>
                        <Text style={styles.historyTagText}>Yours</Text>
                      </View>
                    )}
                  </View>
                  {item.brand && <Text style={styles.foodBrand}>{item.brand}</Text>}
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
                  <Text style={styles.foodCals}>{item.macros.calories} kcal</Text>
                  <Text style={styles.foodMacro}>P {item.macros.protein}g</Text>
                  <Text style={styles.foodMacro}>C {item.macros.carbs}g</Text>
                  <Text style={styles.foodMacro}>F {item.macros.fat}g</Text>
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
            ) : searching ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No match in the database</Text>
                <Text style={styles.emptySubtext}>
                  Tap Estimate with AI above, or scan the barcode
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nothing logged yet</Text>
                <Text style={styles.emptySubtext}>
                  Describe what you ate in the field above, or scan a barcode —
                  everything you log collects here for one-tap re-adding
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            !searching && listLimit < yourFoods.length ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setListLimit((n) => n + PAGE_SIZE)}
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
  moreBtn: { alignItems: 'flex-end' },
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
    marginTop: space.md,
    marginBottom: space.sm,
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
  // Shared by the scan offer and the AI offer — one shape, one slot, so the
  // two never read as competing controls.
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.primarySoft,
    borderWidth: 1,
    borderColor: c.primary,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
  },
  // The scan offer sits outside the FlatList, so it carries the horizontal
  // inset the list's contentContainer supplies to the AI offer.
  offerRowStandalone: { marginHorizontal: space.md },
  offerText: { flex: 1, minWidth: 0 },
  offerTitle: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    color: c.text,
  },
  offerSub: {
    ...type.caption(c),
    color: c.textMuted,
    marginTop: space.xxs,
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
  listLabel: {
    ...type.overline(c),
    color: c.textFaint,
    marginBottom: space.sm,
    marginLeft: space.xxs,
  },
  mealTag: {
    backgroundColor: c.cardMuted,
    borderRadius: radius.hairline,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
  },
  mealTagText: {
    ...type.micro(c),
    fontFamily: c.fontBodyBold,
    color: c.textMuted,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: space.lg,
    marginTop: space.xs,
  },
  loadMoreText: { ...type.bodyStrong(c), color: c.primary },
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
