import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Food, MealType } from '../types';
import { useStore } from '../store/useStore';
import { searchFoods } from '../data/foods';
import { todayString } from '../utils/date';

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

export function LogFoodScreen({ route, navigation }: Props) {
  const { meal, date } = route.params;
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [servings, setServings] = useState('1');
  const addEntry = useStore((s) => s.addEntry);

  const results = useMemo(() => searchFoods(query), [query]);

  function handleSelectFood(food: Food) {
    setSelectedFood(food);
    setServings('1');
  }

  function handleAdd() {
    if (!selectedFood) return;
    const s = parseFloat(servings);
    if (isNaN(s) || s <= 0) {
      Alert.alert('Invalid servings', 'Please enter a valid number of servings.');
      return;
    }
    addEntry({
      id: `${Date.now()}-${Math.random()}`,
      food: selectedFood,
      servings: s,
      meal,
      timestamp: Date.now(),
      date,
    });
    navigation.goBack();
  }

  const preview = selectedFood
    ? {
        calories: Math.round(selectedFood.macros.calories * (parseFloat(servings) || 0)),
        protein: Math.round(selectedFood.macros.protein * (parseFloat(servings) || 0)),
        carbs: Math.round(selectedFood.macros.carbs * (parseFloat(servings) || 0)),
        fat: Math.round(selectedFood.macros.fat * (parseFloat(servings) || 0)),
      }
    : null;

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
        </View>

        <FlatList
          data={results}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
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
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No foods found</Text>
              <Text style={styles.emptySubtext}>
                Try a different search term
              </Text>
            </View>
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

            <View style={styles.servingsRow}>
              <Text style={styles.servingsLabel}>
                Servings ({selectedFood.serving_size}{selectedFood.serving_unit} each):
              </Text>
              <View style={styles.servingsControl}>
                <TouchableOpacity
                  style={styles.servingsBtn}
                  onPress={() => {
                    const v = Math.max(0.5, (parseFloat(servings) || 1) - 0.5);
                    setServings(v.toString());
                  }}
                >
                  <Text style={styles.servingsBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.servingsInput}
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={styles.servingsBtn}
                  onPress={() => {
                    const v = (parseFloat(servings) || 1) + 0.5;
                    setServings(v.toString());
                  }}
                >
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
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
