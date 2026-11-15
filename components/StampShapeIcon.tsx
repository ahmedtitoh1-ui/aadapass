import React from 'react';
import {
  Award,
  CheckCircle2,
  Coffee,
  Crown,
  Flame,
  Gem,
  Gift,
  Heart,
  Leaf,
  Moon,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Utensils,
  Zap,
} from 'lucide-react';
import { StampShape } from '@/lib/types';

export interface StampShapeIconProps {
  shape?: StampShape;
  className?: string;
}

export function StampShapeIcon({ shape = 'star', className = 'w-4 h-4' }: StampShapeIconProps) {
  switch (shape) {
    case 'coffee':
      return <Coffee className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'crown':
      return <Crown className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'check':
      return <CheckCircle2 className={className} />;
    case 'gift':
      return <Gift className={className} />;
    case 'diamond':
      return <Gem className={className} />;
    case 'utensils':
      return <Utensils className={className} />;
    case 'scissors':
      return <Scissors className={className} />;
    case 'shopping-bag':
      return <ShoppingBag className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'moon':
      return <Moon className={className} />;
    case 'shield':
      return <ShieldCheck className={className} />;
    case 'smile':
      return <Smile className={className} />;
    case 'leaf':
      return <Leaf className={className} />;
    case 'star':
    default:
      return <Star className={className} />;
  }
}

export default StampShapeIcon;
