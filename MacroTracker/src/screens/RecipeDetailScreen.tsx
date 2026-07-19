import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActionSheetIOS,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import type { Food, MealType } from '../types';
import { todayString } from '../utils/date';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  route: { params: { recipeId: string } };
  navigation: any;
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export function RecipeDetailScreen({ route, navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { recipeId } = route.params;
  const recipe = useStore((s) => s.recipes.find((r) => r.id === recipeId));
  const deleteRecipe = useStore((s) => s.deleteRecipe);
  const addEntry = useStore((s) => s.addEntry);

  if (!recipe) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Recipe not found.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Back to Recipes</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function logToMeal(meal: MealType) {
    if (!recipe) return;
    const now = Date.now();
    const food: Food = {
      id: `recipe-${recipe.id}`,
      name: recipe.name,
      brand: 'Recipe',
      serving_size: 1,
      serving_unit: 'serving',
      macros: {
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
      },
    };
    addEntry({
      id: `${now}-${Math.random()}`,
      food,
      servings: 1,
      amount: 1,
      unit: 'serving',
      meal,
      timestamp: now,
      date: todayString(),
    });
    Alert.alert('Logged', `Added 1 serving of ${recipe.name} to ${MEAL_LABELS[meal]}.`);
  }

  function handleLogToToday() {
    const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Breakfast', 'Lunch', 'Dinner', 'Snacks'], cancelButtonIndex: 0 },
        (index) => {
          if (index === 0) return;
          logToMeal(meals[index - 1]);
        }
      );
    } else {
      Alert.alert('Log to meal', undefined, [
        ...meals.map((m) => ({ text: MEAL_LABELS[m], onPress: () => logToMeal(m) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  function handleDelete() {
    Alert.alert('Delete recipe', `Remove “${recipe!.name}” from your recipes?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRecipe(recipe!.id);
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Recipes</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.delete}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{recipe.name}</Text>
        <Text style={styles.subtitle}>
          {recipe.servings} serving{recipe.servings === 1 ? '' : 's'}
        </Text>
        {recipe.sourceUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(recipe.sourceUrl!)}>
            <Text style={styles.sourceLink} numberOfLines={1}>
              {recipe.sourceUrl}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <Stat label="Calories" value={String(recipe.calories)} c={c} />
          <Stat label="Protein" value={`${recipe.protein}g`} c={c} />
          <Stat label="Carbs" value={`${recipe.carbs}g`} c={c} />
          <Stat label="Fat" value={`${recipe.fat}g`} c={c} />
        </View>
        <Text style={styles.perServing}>per serving</Text>

        <TouchableOpacity style={styles.logBtn} onPress={handleLogToToday} activeOpacity={0.85}>
          <Text style={styles.logBtnText}>Log to Today</Text>
        </TouchableOpacity>

        {recipe.ingredients.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <View style={styles.card}>
              {recipe.ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.ingredientText}>
                    {ing.amount ? `${ing.amount} ` : ''}
                    {ing.name}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {recipe.steps.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Steps</Text>
            <View style={styles.card}>
              {recipe.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, c }: { label: string; value: string; c: Theme }) {
  const styles = makeStyles(c);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: c.textMuted },
  link: { fontSize: 16, color: c.primary, fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { fontSize: 16, color: c.primary, fontWeight: '600' },
  delete: { fontSize: 15, color: c.danger, fontWeight: '600' },

  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: c.text },
  subtitle: { fontSize: 14, color: c.textMuted, marginTop: 4 },
  sourceLink: { fontSize: 12, color: c.primary, marginTop: 6 },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.card,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 16,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: c.primary },
  statLabel: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  perServing: { fontSize: 11, color: c.textFaint, textAlign: 'center', marginTop: 4 },

  logBtn: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 16,
  },
  logBtnText: { color: c.onPrimary, fontWeight: '700', fontSize: 15 },

  sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginTop: 22, marginBottom: 10 },
  card: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
  },

  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  bullet: { fontSize: 14, color: c.primary, fontWeight: '800' },
  ingredientText: { flex: 1, fontSize: 14, color: c.text, lineHeight: 20 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  stepNum: {
    fontSize: 12,
    fontWeight: '800',
    color: c.onPrimary,
    backgroundColor: c.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
  stepText: { flex: 1, fontSize: 14, color: c.text, lineHeight: 20 },
});
