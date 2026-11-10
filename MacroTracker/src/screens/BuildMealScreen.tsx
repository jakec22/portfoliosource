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
import { showPrompt } from '../store/usePrompt';
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
  // Shown under the description box, where the text that caused it is.
  const [aiError, setAiError] = useState<string | null>(null);

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
      setAiError('Type what you ate and roughly how much.');
      return;
    }
    setAiError(null);
    setAiLoading(true);
    try {
      const analyzed = await analyzeMealText(text);
      if (analyzed.length === 0) {
        setAiError('No foods recognised. Name the foods and their portions.');
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
    showPrompt({
      title: 'Save as meal',
      message: 'Name it so you can log the whole thing in one tap.',
      placeholder: 'Sunday breakfast',
      submitLabel: 'Save meal',
      // Matches the cap on the other save-meal prompt; both write the same
      // list, so one of them allowing longer names would be the bug.
      maxLength: 60,
      onSubmit: (name) => {
        const saved: SavedMeal = {
          id: `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          items: items.map((it) => ({ food: it.food, servings: itemMultiplier(it) })),
          createdAt: Date.now(),
        };
        saveMealToStore(saved);
        Alert.alert(
          'Saved',
          `“${name}” is now in your Saved Meals — tap it to log it in one tap next time.`
        );
      },
    });
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
            <View style={styles.backRow}>
              <Icon name="back" size="sm" color={c.primary} />
              <Text style={styles.backText}>Back</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.title}>Build a Meal</Text>
          <View style={styles.sideBtn} />
        </View>

        {/* Search bar — always visible */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Icon name="search" size="sm" color={c.textFaint} />
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
              <View style={styles.aiLabelRow}>
                <Icon name="aiEstimate" size="sm" color={c.primary} />
                <Text style={styles.aiLabel}>Generate with AI</Text>
              </View>
              <TextInput
                style={styles.aiInput}
                placeholder={
                  'e.g. grilled salmon with roasted sweet potato and steamed broccoli, ' +
                  'medium portions'
                }
                placeholderTextColor={c.textFaint}
                value={description}
                onChangeText={(v) => { setDescription(v); setAiError(null); }}
                multiline
                textAlignVertical="top"
              />
              {aiError ? <Text style={styles.aiError}>{aiError}</Text> : null}
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
                  // Loading always pairs with aiBtnDisabled's borderStrong
                  // background (not primary), so the spinner needs a neutral
                  // color that reads on that muted surface in every pack.
                  <ActivityIndicator color={c.textMuted} size="small" />
                ) : (
                  <Text style={styles.aiBtnText}>Generate meal breakdown</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Empty state */}
            {items.length === 0 && (
              <View style={styles.emptyMeal}>
                <Icon name="meal" size="hero" color={c.textFaint} style={styles.emptyMealIcon} />
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
                          <Icon name={isExpanded ? 'up' : 'down'} size="sm" color={c.textFaint} />
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
                                hitSlop={5}
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
                                hitSlop={5}
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
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: c.card,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  sideBtn: { width: 64 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  backText: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.primary },
  title: { ...type.subhead(c), color: c.text },

  searchRow: {
    flexDirection: 'row',
    marginHorizontal: space.md,
    marginVertical: space.sm,
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
  searchInput: { ...type.body(c), flex: 1, color: c.text },

  // Search results
  listContent: { paddingHorizontal: space.md, paddingBottom: space.sm },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
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
  searchResultLeft: { flex: 1 },
  searchResultName: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.text },
  searchResultBrand: { ...type.caption(c), color: c.textFaint, marginTop: space.xxs },
  searchResultServing: { ...type.caption(c), color: c.textMuted, marginTop: space.xs },
  searchResultRight: { alignItems: 'flex-end', gap: space.xxs, marginRight: space.sm },
  searchResultCals: { ...type.bodyStrong(c), color: c.text },
  searchResultMacro: { ...type.micro(c), color: c.textFaint },
  addBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBadgeText: { ...type.heading(c), color: c.primary },
  emptyBox: { alignItems: 'center', paddingVertical: space.xxxl },
  emptyText: { ...type.body(c), color: c.textFaint, marginTop: space.sm },

  // Meal builder
  content: { padding: space.lg, paddingBottom: space.xxl },

  aiBox: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.lg,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  aiLabel: {
    ...type.captionStrong(c),
    color: c.gray700,
  },
  aiError: {
    ...type.caption(c),
    color: c.danger,
    marginTop: space.xs,
  },
  aiInput: {
    ...type.body(c),
    minHeight: 72,
    color: c.text,
    marginBottom: space.md,
  },
  aiBtn: {
    backgroundColor: c.primary,
    borderRadius: radius.control,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  aiBtnDisabled: { backgroundColor: c.borderStrong },
  aiBtnText: { ...type.bodyStrong(c), color: c.onPrimary },

  emptyMeal: {
    alignItems: 'center',
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
  emptyMealIcon: { marginBottom: space.md },
  emptyMealText: {
    ...type.body(c),
    color: c.textFaint,
    textAlign: 'center',
  },

  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  itemsLabel: {
    ...type.overline(c),
    color: c.textFaint,
  },
  itemsCount: {
    ...type.captionStrong(c),
    color: c.textMuted,
  },

  itemCard: {
    backgroundColor: c.card,
    borderRadius: radius.card,
    marginBottom: space.sm,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  itemCardExpanded: { borderColor: c.primary },
  itemSummary: { flexDirection: 'row', alignItems: 'center', padding: space.lg },
  itemLeft: { flex: 1 },
  itemName: { ...type.body(c), fontFamily: c.fontBodySemi, color: c.text },
  itemMacros: { ...type.caption(c), color: c.textMuted, marginTop: space.xs },
  itemRight: { alignItems: 'flex-end', gap: space.xs, marginLeft: space.md },
  amountBadge: {
    ...type.bodyStrong(c),
    color: c.primary,
    backgroundColor: c.primarySoft,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.control,
  },
  chevron: { ...type.captionStrong(c), color: c.textFaint },

  editor: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  divider: { height: 1, backgroundColor: c.border, marginBottom: space.md },
  unitRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  unitBtn: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: c.border,
  },
  unitBtnActive: { backgroundColor: c.primarySoft, borderColor: c.primary },
  unitBtnText: { ...type.captionStrong(c), color: c.textMuted },
  unitBtnTextActive: { color: c.primary },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  amountLabel: { ...type.caption(c), color: c.textMuted, flex: 1 },
  amountControl: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: c.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { ...type.heading(c), color: c.gray700 },
  amountInput: {
    ...type.body(c),
    fontFamily: c.fontBodySemi,
    width: 64,
    height: 34,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.control,
    textAlign: 'center',
    color: c.text,
    backgroundColor: c.input,
  },
  previewRow: {
    flexDirection: 'row',
    backgroundColor: c.cardMuted,
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.md,
    justifyContent: 'space-around',
  },
  macroStat: { alignItems: 'center' },
  macroStatValue: { ...type.bodyStrong(c) },
  macroStatLabel: { ...type.micro(c), color: c.textFaint, marginTop: space.xxs },
  removeBtn: { alignItems: 'center', paddingVertical: space.sm },
  removeBtnText: { ...type.captionStrong(c), color: c.danger },

  // Footer
  footer: {
    backgroundColor: c.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: space.xl,
    paddingBottom: space.md,
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
    borderRadius: radius.card,
    padding: space.md,
    marginBottom: space.md,
  },
  footerBtns: { flexDirection: 'row', gap: space.sm },
  saveMealBtn: {
    flex: 1,
    paddingVertical: space.lg,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: c.primary,
    alignItems: 'center',
  },
  saveMealBtnText: { ...type.bodyStrong(c), color: c.primary },
  addAllBtn: {
    flex: 2,
    paddingVertical: space.lg,
    borderRadius: radius.control,
    backgroundColor: c.primary,
    alignItems: 'center',
  },
  addAllBtnText: { ...type.bodyStrong(c), color: c.onPrimary },
});
