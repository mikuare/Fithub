import {
  Activity, AlertTriangle, Apple, ArrowDown, ArrowUp, Award, BatteryCharging, BedDouble,
  Banknote, Beef, Bike, BookOpen, Brain, Calendar, CalendarCheck, CalendarHeart,
  CalendarPlus, CalendarRange, ChartNoAxesCombined, CheckCheck, ChevronsDown, ChevronsUp, Circle, CircleCheckBig,
  ClipboardCheck, ClipboardList, CreditCard, Droplets, Dumbbell, FileBarChart, Flag, Flame,
  Footprints, HeartPulse, IdCard, Info, Layers, LayoutDashboard, Leaf, Medal, Moon,
  MoreHorizontal, Move, PersonStanding, Repeat, Route, ScanLine, ScrollText, Settings,
  Sparkles, Star, Store, Sunrise, Target, Timer, TrendingUp, Trophy, User, UserRoundCog,
  Users, Wrench, type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Explicit registry of the icons referenced by name from data files and
 * navigation config.
 *
 * A namespace import (`import * as Lucide`) would be shorter but defeats
 * tree-shaking entirely — it pulled roughly 780 kB of icons into the bundle.
 * Listing them keeps the payload to only what the app actually renders.
 */
const REGISTRY: Record<string, ComponentType<LucideProps>> = {
  Activity, AlertTriangle, Apple, ArrowDown, ArrowUp, Award, BatteryCharging, BedDouble,
  Banknote, Beef, Bike, BookOpen, Brain, Calendar, CalendarCheck, CalendarHeart,
  CalendarPlus, CalendarRange, ChartNoAxesCombined, CheckCheck, ChevronsDown, ChevronsUp, Circle, CircleCheckBig,
  ClipboardCheck, ClipboardList, CreditCard, Droplets, Dumbbell, FileBarChart, Flag, Flame,
  Footprints, HeartPulse, IdCard, Info, Layers, LayoutDashboard, Leaf, Medal, Moon,
  MoreHorizontal, Move, PersonStanding, Repeat, Route, ScanLine, ScrollText, Settings,
  Sparkles, Star, Store, Sunrise, Target, Timer, TrendingUp, Trophy, User, UserRoundCog,
  Users, Wrench,
};

/** Name-addressed icon so config and data files can reference icons as strings. */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = REGISTRY[name] ?? Circle;
  return <Cmp aria-hidden {...props} />;
}

/** Exposed for tests: guarantees every string name in the app resolves. */
export function hasIcon(name: string): boolean {
  return name in REGISTRY;
}
