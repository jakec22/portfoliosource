import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import type { ParsedRecipe } from '../services/recipeImport';
import type { RecipeIngredient } from '../types';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  route: { params: { parsed: ParsedRecipe; sourceUrl?: string } };
  navigation: any;
}

// Review + light editing of a just-parsed (not yet saved) recipe before it's
// added to the library. Ingredients/steps can be edited or removed; add a new
// blank line if the AI missed one.
export function RecipeReviewScreen({ route, navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const addRecipe = useStore((s) => s.addRecipe);
  const { parsed, sourceUrl } = route.params;

  const [name, setName] = useState(parsed.name);
  const [servings, setServings] = useState(String(parsed.servings));
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(parsed.ingredients);
  const [steps, setSteps] = useState<string[]>(parsed.steps);

  function updateIngredient(i: number, patch: Partial<RecipeIngredient>) {
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)));
  }
  function removeIngredient(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addIngredient() {
    setIngredients((prev) => [...prev, { name: '', amount: '' }]);
  }

  function updateStep(i: number, text: string) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? text : s)));
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addStep() {
    setSteps((prev) => [...prev, '']);
  }

  function handleSave() {
    const cleanName = name.trim() || 'Recipe';
    const cleanIngredients = ingredients
      .map((i) => ({ name: i.name.trim(), amount: i.amount?.trim() || undefined }))
      .filter((i) => i.name);
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (cleanIngredients.length === 0 && cleanSteps.length === 0) {
      Alert.alert('Nothing to save', 'Add at least one ingredient or step.');
      return;
    }
    const now = Date.now();
    const recipe = {
      id: `recipe-${now}-${Math.random()}`,
      name: cleanName,
      sourceUrl,
      servings: Math.max(1, parseInt(servings, 10) || 1),
      ingredients: cleanIngredients,
      steps: cleanSteps,
      calories: parsed.calories,
      protein: parsed.protein,
      carbs: parsed.carbs,
      fat: parsed.fat,
      createdAt: now,
    };
    addRecipe(recipe);
    navigation.replace('RecipeDetail', { recipeId: recipe.id });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review Recipe</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.save}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Recipe name"
            placeholderTextColor={c.textFaint}
          />

          <View style={styles.servingsRow}>
            <Text style={styles.servingsLabel}>Servings</Text>
            <TextInput
              style={styles.servingsInput}
              value={servings}
              onChangeText={(v) => setServings(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
          </View>

          {/* Per-serving macro estimate — read-only; based on the ingredient list. */}
          <View style={styles.statsRow}>
            <Stat label="Calories" value={String(parsed.calories)} c={c} />
            <Stat label="Protein" value={`${parsed.protein}g`} c={c} />
            <Stat label="Carbs" value={`${parsed.carbs}g`} c={c} />
            <Stat label="Fat" value={`${parsed.fat}g`} c={c} />
          </View>

          <Text style={styles.sectionTitle}>Ingredients</Text>
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.ingredientRow}>
              <TextInput
                style={[styles.ingredientInput, styles.ingredientAmount]}
                value={ing.amount ?? ''}
                onChangeText={(v) => updateIngredient(i, { amount: v })}
                placeholder="amount"
                placeholderTextColor={c.textFaint}
              />
              <TextInput
                style={[styles.ingredientInput, styles.ingredientName]}
                value={ing.name}
                onChangeText={(v) => updateIngredient(i, { name: v })}
                placeholder="ingredient"
                placeholderTextColor={c.textFaint}
              />
              <TouchableOpacity onPress={() => removeIngredient(i)} hitSlop={8}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={addIngredient} style={styles.addLine}>
            <Text style={styles.addLineText}>+ Add ingredient</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Steps</Text>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNum}>{i + 1}.</Text>
              <TextInput
                style={styles.stepInput}
                value={s}
                onChangeText={(v) => updateStep(i, v)}
                placeholder="Step description"
                placeholderTextColor={c.textFaint}
                multiline
              />
              <TouchableOpacity onPress={() => removeStep(i)} hitSlop={8}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={addStep} style={styles.addLine}>
            <Text style={styles.addLineText}>+ Add step</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.card,
  },
  cancel: { fontSize: 16, color: c.danger },
  title: { fontSize: 16, fontWeight: '700', color: c.text },
  save: { fontSize: 16, color: c.primary, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },

  nameInput: {
    fontSize: 20,
    fontWeight: '800',
    color: c.text,
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    marginBottom: 12,
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  servingsLabel: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
  servingsInput: {
    backgroundColor: c.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 15,
    color: c.text,
    width: 60,
    textAlign: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: c.card,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: c.primary },
  statLabel: { fontSize: 11, color: c.textFaint, marginTop: 2 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginTop: 8, marginBottom: 10 },

  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ingredientInput: {
    backgroundColor: c.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: c.text,
  },
  ingredientAmount: { flex: 0.35 },
  ingredientName: { flex: 0.65 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  stepNum: { fontSize: 14, fontWeight: '700', color: c.textFaint, marginTop: 10, width: 18 },
  stepInput: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: c.text,
    minHeight: 40,
    textAlignVertical: 'top',
  },

  removeText: { fontSize: 15, color: c.textFaint, fontWeight: '700', marginTop: 8 },

  addLine: { paddingVertical: 8 },
  addLineText: { color: c.primary, fontWeight: '600', fontSize: 14 },
});
