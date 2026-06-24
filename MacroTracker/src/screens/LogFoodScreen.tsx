import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Food, MealType, ServingUnit } from '../types';
import { useStore } from '../store/useStore';
import { searchFoods } from '../data/foods';
import { searchFoodsApi, lookupBarcode } from '../services/foodApi';
import { BarcodeScanner } from '../components/BarcodeScanner';
import Svg, { Rect } from 'react-native-svg';
import { availableUnits, defaultAmount, toMultiplier } from '../utils/serving';

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

export function LogFoodScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>(() => searchFoods(''));
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [unit, setUnit] = useState<ServingUnit>('serving');
  const [amount, setAmount] = useState('1');
  const addEntry = useStore((s) => s.addEntry);
  const addRecentFood = useStore((s) => s.addRecentFood);
  const recentFoods = useStore((s) => s.recentFoods);

  // Debounced live search against USDA (falls back to local foods offline).
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchFoodsApi(query, controller.signal)
        .then((r) => {
          if (active) {
            setResults(r);
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
  }, [query]);

  function handleSelectFood(food: Food) {
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

  const showRecents = query.trim() === '' && recentFoods.length > 0;

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
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search foods..."
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              placeholderTextColor="#9CA3AF"
            />
            {loading && <ActivityIndicator size="small" color="#10B981" />}
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
            <Text style={styles.scanBtnIcon}>📷</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={results}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            showRecents ? (
              <View style={styles.recentSection}>
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
                <Text style={styles.allFoodsLabel}>All Foods</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
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
          )}
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <ActivityIndicator color="#10B981" />
                <Text style={styles.emptySubtext}>Searching foods…</Text>
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
                  <Text style={[styles.previewValue, { color: '#3B82F6' }]}>
                    {preview.protein}g
                  </Text>
                  <Text style={styles.previewLabel}>protein</Text>
                </View>
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: '#F59E0B' }]}>
                    {preview.carbs}g
                  </Text>
                  <Text style={styles.previewLabel}>carbs</Text>
                </View>
                <View style={styles.previewItem}>
                  <Text style={[styles.previewValue, { color: '#EF4444' }]}>
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
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="done"
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
      </KeyboardAvoidingView>

      <BarcodeScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
      />

      {scanLoading && (
        <View style={styles.scanOverlay}>
          <View style={styles.scanOverlayBox}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.scanOverlayText}>Looking up product…</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    padding: 4,
    width: 60,
  },
  backText: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
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
    backgroundColor: '#fff',
    borderRadius: 14,
    height: 46,
    shadowColor: '#000',
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
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanOverlayBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
  },
  scanOverlayText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
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
    color: '#9CA3AF',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 160,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recentChipName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  recentChipCals: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 2,
  },
  allFoodsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 2,
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
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  unitBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  unitBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  unitBtnTextActive: {
    color: '#10B981',
  },
  foodItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  foodItemSelected: {
    borderWidth: 2,
    borderColor: '#10B981',
  },
  foodItemLeft: {
    flex: 1,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  foodBrand: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  foodServing: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  foodItemRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  foodCals: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  foodMacro: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  addPanel: {
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
  addPanelHeader: {
    marginBottom: 12,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
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
    color: '#111827',
  },
  previewLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  servingsLabel: {
    fontSize: 13,
    color: '#6B7280',
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
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsBtnText: {
    fontSize: 20,
    fontWeight: '300',
    color: '#374151',
  },
  servingsInput: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  addBtn: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
