import { BusFront, Clapperboard, Ellipsis, ReceiptText, ShoppingBasket, UtensilsCrossed } from 'lucide-react';

export const CATEGORY_ICONS = {
  'Food': UtensilsCrossed,
  'Transport': BusFront,
  'Shopping': ShoppingBasket,
  'Entertainment': Clapperboard,
  'Bills': ReceiptText,
  'Other': Ellipsis
};

export const getCategoryIcon = (category) => {
  const Icon = CATEGORY_ICONS[category] || Ellipsis;
  return Icon;
};
