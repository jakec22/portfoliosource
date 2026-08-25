import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import type { Food, MealType, SavedMeal, ServingUnit } from '../types';
import { searchFoodsApi } from '../services/foodApi';
import { analyzeMealText } from '../services/mealPhoto';
import type { AnalyzedItem } from '../services/mealPhoto';
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

interface BuildItem {
  id: string;
  food: Food;
  amount: string;
  unit: ServingUnit;
}

interface Props {
  route: { params: { meal: MealType; date: string } };
  navigation: any;
}

function foodFromAI(it: AnalyzedItem, idx: number): Food {
  const grams = it.serving_grams;
  return {
    id: `ai-build-${Date.now()}-${idx}`,
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
    },
  };
}

function itemMultiplier(it: BuildItem): number {
  return toMultiplier(it.food, parseFloat(it.amount) || 0, it.unit);
}

export function BuildMealScreen({ route, navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { meal, date } = route.params;

  const addEntry = useStore((s) => s.addEntry);
  const saveMealToStore = useStore((s) => s.saveMeal);
  const customFoods = useStore((s) => s.customFoods);

  const [description, setDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [items, setItems] = useState<BuildItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isSearching = searchQuery.trim().length > 0;

  // Debounced food search — prepends matching custom foods
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setSearchLoading(true);
    const t = setTimeout(() => {
      searchFoodsApi(searchQuery.trim(), controller.signal)
        .then((r) => {
          if (!active) return;
          const q = searchQuery.toLowerCase().trim();
          const customMatches = customFoods.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              (f.brand && f.brand.toLowerCase().includes(q))
          );
          const apiIds = new Set(r.map((f) => f.id));
          setSearchResults([...customMatches.filter((f) => !apiIds.has(f.id)), ...r]);
          setSearchLoading(false);
        })
        .catch(() => {});
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
      controller.abort();
    };
  }, [searchQuery, customFoods]);

  async function handleGenerate() {
    const text = description.trim();
    if (text.length < 3) {
      Alert.alert('Describe your meal', 'Type what you want to eat and roughly how much.');
      return;
    }
    setAiLoading(true);
    try {
      const analyzed = await analyzeMealText(text);
      if (analyzed.length === 0) {
        Alert.alert('Nothing found', 'Try describing the foods and portions more specifically.');
        return;
      }
      const now = Date.now();
      const newItems: BuildItem[] = analyzed.map((it, i) => ({
        id: `${now}-${i}`,
        food: foodFromAI(it, i),
        amount: '1',
        unit: 'serving',
      }));
      setItems((prev) => [...prev, ...newItems]);
      setDescription('');
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.message ?? 'Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  function addFoodFromSearch(food: Food) {
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        food,
        amount: '1',
        unit: 'serving',
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function handleUnitChange(id: string, unit: ServingUnit) {
    setItems((prev) =>
      prev.map((it) =>
        it.id !== id
          ? it
          : { ...it, unit, amount: String(defaultAmount(it.food, unit)) }
      )
    );
  }

  function adjustAmount(id: string, delta: number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const step =
          it.unit === 'serving'
            ? 0.5
            : Math.max(1, Math.round(defaultAmount(it.food, it.unit) * 0.25));
        const next = Math.max(
          step,
          Math.round(((parseFloat(it.amount) || 0) + delta * step) * 10) / 10
        );
        return { ...it, amount: String(next) };
      })
    );
  }

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, it) => {
          const m = itemMultiplier(it);
          return {
            calories: acc.calories + it.food.macros.calories * m,
            protein: acc.protein + it.food.macros.protein * m,
            carbs: acc.carbs + it.food.macros.carbs * m,
            fat: acc.fat + it.food.macros.fat * m,
          };
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [items]
  );

  function handleAddAll() {
    if (items.length === 0) return;
    const now = Date.now();
    let added = 0;
    for (const it of items) {
      const multiplier = itemMultiplier(it);
      if (multiplier <= 0) continue;
      addEntry({
        id: `${now}-${Math.random()}`,
        food: it.food,
        servings: multiplier,
        amount: parseFloat(it.amount),
        unit: it.unit,
        meal,
        timestamp: now,
        date,
      });
      added++;
    }
    if (added === 0) {
      Alert.alert('Nothing to add', 'Set a valid amount for at least one item.');
      return;
    }
    navigation.goBack();
  }

  function handleSaveAsMeal() {
    if (items.length === 0) return;
    Alert.prompt(
      'Save as Meal',
      'Give this meal a name for quick re-logging later:',
      (name) => {
        if (!name?.trim()) return;
        const saved: SavedMeal = {
          id: `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: name.trim(),
          items: items.map((it) => ({ food: it.food, servings: itemMultiplier(it) })),
          createdAt: Date.now(),
        };
        saveMealToStore(saved);
        Alert.alert(
          'Saved',
          `"${name.trim()}" is now in your Saved Meals — tap it to log it in one tap next time.`
        );
      },
      'plain-text'
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.sideBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Build a Meal</Text>
          <View style={styles.sideBtn} />
        </View>

        {/* Search bar — always visible */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search to add a specific food…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              placeholderTextColor={c.textFaint}
            />
            {searchLoading && <ActivityIndicator size="small" color={c.primary} />}
          </View>
        </View>

        {/* Body: search results OR meal builder */}
        {isSearching ? (
          <FlatList
            data={searchResults}
            keyExtractor={(f) => f.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResult}
                onPress={() => addFoodFromSearch(item)}
                activeOpacity={0.7}
              >
                <View style={styles.searchResultLeft}>
                  <Text style={styles.searchResultName}>{item.name}</Text>
                  {item.brand && (
                    <Text style={styles.searchResultBrand}>{item.brand}</Text>
                  )}
                  <Text style={styles.searchResultServing}>
                    per {item.serving_size}{item.serving_unit}
                  </Text>
                </View>
                <View style={styles.searchResultRight}>
                  <Text style={styles.searchResultCals}>{item.macros.calories} kcal</Text>
                  <Text style={styles.searchResultMacro}>P {item.macros.protein}g</Text>
                  <Text style={styles.searchResultMacro}>C {item.macros.carbs}g</Text>
                  <Text style={styles.searchResultMacro}>F {item.macros.fat}g</Text>
                </View>
                <View style={styles.addBadge}>
                  <Text style={styles.addBadgeText}>+</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              searchLoading ? (
                <View style={styles.emptyBox}>
                  <ActivityIndicator color={c.primary} />
                  <Text style={styles.emptyText}>Searching…</Text>
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No foods found</Text>
                </View>
              )
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {/* AI description box */}
            <View style={styles.aiBox}>
              <Text style={styles.aiLabel}>✨  Generate with AI</Text>
              <TextInput
                style={styles.aiInput}
                placeholder={
                  'e.g. grilled salmon with roasted sweet potato and steamed broccoli, ' +
                  'medium portions'
                }
                placeholderTextColor={c.textFaint}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[
                  styles.aiBtn,
                  (description.trim().length < 3 || aiLoading) && styles.aiBtnDisabled,
                ]}
                onPress={handleGenerate}
                disabled={description.trim().length < 3 || aiLoading}
                activeOpacity={0.85}
              >
                {aiLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.aiBtnText}>Generate meal breakdown</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Empty state */}
            {items.length === 0 && (
              <View style={styles.emptyMeal}>
                <Text style={styles.emptyMealIcon}>🍽️</Text>
                <Text style={styles.emptyMealText}>
                  Describe your meal above to auto-generate a breakdown, or search for foods to build it manually.
                </Text>
              </View>
            )}

            {/* Item list */}
            {items.length > 0 && (
              <>
                <View style={styles.itemsHeader}>
                  <Text style={styles.itemsLabel}>Meal · tap an item to adjust</Text>
                  <Text style={styles.itemsCount}>
                    {items.length} item{items.length === 1 ? '' : 's'}
                  </Text>
                </View>

                {items.map((it) => {
                  const m = itemMultiplier(it);
                  const preview = {
                    calories: Math.round(it.food.macros.calories * m),
                    protein: Math.round(it.food.macros.protein * m),
                    carbs: Math.round(it.food.macros.carbs * m),
                    fat: Math.round(it.food.macros.fat * m),
                  };
                  const units = availableUnits(it.food);
                  const isExpanded = expandedId === it.id;

                  return (
                    <View
                      key={it.id}
                      style={[styles.itemCard, isExpanded && styles.itemCardExpanded]}
                    >
                      <TouchableOpacity
                        style={styles.itemSummary}
                        onPress={() => setExpandedId(isExpanded ? null : it.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.itemLeft}>
                          <Text style={styles.itemName}>{it.food.name}</Text>
                          <Text style={styles.itemMacros}>
                            {preview.calories} kcal · P{preview.protein} · C{preview.carbs} · F{preview.fat}g
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

                      {isExpanded && (
                        <View style={styles.editor}>
                          <View style={styles.divider} />

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

                          <View style={styles.amountRow}>
                            <Text style={styles.amountLabel}>
                              {it.unit === 'serving' ? 'Servings' : `Amount in ${it.unit}`}
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
                                onChangeText={(v) =>
                                  setItems((prev) =>
                                    prev.map((x) => (x.id === it.id ? { ...x, amount: v } : x))
                                  )
                                }
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                                inputAccessoryViewID={DONE_ACCESSORY_ID}
                              />
                              <TouchableOpacity
                                style={styles.stepBtn}
                                onPress={() => adjustAmount(it.id, 1)}
                              >
                                <Text style={styles.stepBtnText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          <View style={styles.previewRow}>
                            <MacroStat label="kcal" value={preview.calories} color={c.text} />
                            <MacroStat label="protein" value={preview.protein} color={c.macroProtein} unit="g" />
                            <MacroStat label="carbs" value={preview.carbs} color={c.macroCarbs} unit="g" />
                            <MacroStat label="fat" value={preview.fat} color={c.macroFat} unit="g" />
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
              </>
            )}
          </ScrollView>
        )}

        {/* Footer — only when items exist and not in search mode */}
        {items.length > 0 && !isSearching && (
          <View style={styles.footer}>
            <View style={styles.totalsRow}>
              <MacroStat label="kcal" value={Math.round(totals.calories)} color={c.text} />
              <MacroStat label="protein" value={Math.round(totals.protein)} color={c.macroProtein} unit="g" />
              <MacroStat label="carbs" value={Math.round(totals.carbs)} color={c.macroCarbs} unit="g" />
              <MacroStat label="fat" value={Math.round(totals.fat)} color={c.macroFat} unit="g" />
            </View>
            <View style={styles.footerBtns}>
              <TouchableOpacity
                style={styles.saveMealBtn}
                onPress={handleSaveAsMeal}
                activeOpacity={0.8}
              >
                <Text style={styles.saveMealBtnText}>Save as Meal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addAllBtn}
                onPress={handleAddAll}
                activeOpacity={0.85}
              >
                <Text style={styles.addAllBtnText}>Add to {MEAL_LABELS[meal]}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <KeyboardDoneAccessory />
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
  flex: { flex: 1 },

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
  sideBtn: { width: 64 },
  backText: { fontSize: 16, color: c.primary, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', color: c.text },

  searchRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginVertical: 10,
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
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: c.text },

  // Search results
  listContent: { paddingHorizontal: 12, paddingBottom: 8 },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
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
  searchResultLeft: { flex: 1 },
  searchResultName: { fontSize: 15, fontWeight: '600', color: c.text },
  searchResultBrand: { fontSize: 12, color: c.textFaint, marginTop: 2 },
  searchResultServing: { fontSize: 12, color: c.textMuted, marginTop: 4 },
  searchResultRight: { alignItems: 'flex-end', gap: 2, marginRight: 10 },
  searchResultCals: { fontSize: 14, fontWeight: '700', color: c.text },
  searchResultMacro: { fontSize: 11, color: c.textFaint },
  addBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadgeText: { fontSize: 20, color: c.primary, fontWeight: '300' },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: c.textFaint, marginTop: 8 },

  // Meal builder
  content: { padding: 16, paddingBottom: 32 },

  aiBox: {
    backgroundColor: c.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  aiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: c.gray700,
    marginBottom: 10,
  },
  aiInput: {
    minHeight: 72,
    fontSize: 15,
    color: c.text,
    lineHeight: 21,
    marginBottom: 12,
  },
  aiBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  aiBtnDisabled: { backgroundColor: c.borderStrong },
  aiBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  emptyMeal: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyMealIcon: { fontSize: 42, marginBottom: 12 },
  emptyMealText: {
    fontSize: 14,
    color: c.textFaint,
    textAlign: 'center',
    lineHeight: 20,
  },

  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  itemsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textMuted,
  },

  itemCard: {
    backgroundColor: c.card,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  itemCardExpanded: { borderColor: c.primary },
  itemSummary: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  itemLeft: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: c.text },
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
  chevron: { fontSize: 13, color: c.textFaint, fontWeight: '600' },

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
    paddingBottom: 12,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.cardMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  footerBtns: { flexDirection: 'row', gap: 10 },
  saveMealBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.primary,
    alignItems: 'center',
  },
  saveMealBtnText: { fontSize: 15, fontWeight: '700', color: c.primary },
  addAllBtn: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: c.primary,
    alignItems: 'center',
  },
  addAllBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
});
