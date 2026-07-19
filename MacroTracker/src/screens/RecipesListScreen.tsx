import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { useTheme } from '../theme/useTheme';
import type { Theme } from '../theme';

interface Props {
  navigation: any;
}

export function RecipesListScreen({ navigation }: Props) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const recipes = useStore((s) => s.recipes);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.bg}
      />
      <View style={styles.header}>
        <Text style={styles.title}>Recipes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewRecipe')}>
          <Text style={styles.newLink}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {recipes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No recipes yet. Import one from a website link, or paste a recipe (or an
              Instagram caption) as text — tap “+ New” to get started.
            </Text>
          </View>
        ) : (
          recipes.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('RecipeDetail', { recipeId: r.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {r.servings} serving{r.servings === 1 ? '' : 's'} · {r.calories} cal/serving ·{' '}
                  {r.ingredients.length} ingredient{r.ingredients.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.cardArrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  newLink: { fontSize: 15, fontWeight: '700', color: c.primary },
  content: { padding: 16, paddingBottom: 40 },

  emptyCard: { backgroundColor: c.card, borderRadius: 14, padding: 20 },
  emptyText: { fontSize: 14, color: c.textMuted, lineHeight: 20, textAlign: 'center' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardName: { fontSize: 16, fontWeight: '700', color: c.text },
  cardMeta: { fontSize: 12, color: c.textFaint, marginTop: 3 },
  cardArrow: { fontSize: 22, color: c.textFaint, marginLeft: 8 },
});
