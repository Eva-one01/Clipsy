import type { ComponentProps } from 'react';
import type Feather from '@expo/vector-icons/Feather';
import { t, type TKey } from '@/i18n';
import type { TxType } from '@/store/types';

type IconName = ComponentProps<typeof Feather>['name'];

export interface Category {
  key: string;
  icon: IconName;
}

export function categoryLabel(key: string): string {
  return t(`cat.${key}` as TKey) ;
}

export const expenseCategories: Category[] = [
  { key: 'food', icon: 'coffee' },
  { key: 'transport', icon: 'navigation' },
  { key: 'home', icon: 'home' },
  { key: 'bills', icon: 'zap' },
  { key: 'health', icon: 'heart' },
  { key: 'shopping', icon: 'shopping-bag' },
  { key: 'leisure', icon: 'film' },
  { key: 'education', icon: 'book-open' },
  { key: 'subscriptions', icon: 'repeat' },
  { key: 'other', icon: 'more-horizontal' },
];

export const incomeCategories: Category[] = [
  { key: 'salary', icon: 'briefcase' },
  { key: 'freelance', icon: 'layers' },
  { key: 'investments', icon: 'trending-up' },
  { key: 'gift', icon: 'gift' },
  { key: 'other_in', icon: 'plus-circle' },
];

export function categoriesFor(type: TxType) {
  return type === 'income' ? incomeCategories : expenseCategories;
}

export function findCategory(key: string): Category {
  return (
    expenseCategories.find((c) => c.key === key) ??
    incomeCategories.find((c) => c.key === key) ?? { key, icon: 'circle' }
  );
}
